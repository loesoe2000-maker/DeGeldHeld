/**
 * lib/inbound-handler.ts — the ONE canonical inbound-webhook handler.
 *
 * Resend routes every inbound email for the domain to a single webhook
 * endpoint, so we can't lean on per-address URLs. This handler:
 *
 *   1. Svix-verifies the request (lib/inbound-verify.ts) → 401 if invalid.
 *   2. Parses the `email.received` metadata, then hydrates the full email
 *      (body + headers + attachment content) via the Resend API — the
 *      webhook itself carries metadata only.
 *   3. Routes on subject-token / thread-id / recipient:
 *        [PROOF-<id>]  | bewijs@  → proof verification
 *        [NEGOTIATION-<id>] | In-Reply-To thread | auto@ → auto-pingpong
 *        inbox@ (or apex)        → bill OCR + analysis reply
 *        anything else           → 200 no-op (NEVER 500 → no retry storm)
 *
 * /api/inbound, /api/inbound/proof and /api/inbound/router all delegate
 * here, so a misconfigured Resend endpoint still works.
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyResendWebhook } from "@/lib/inbound-verify";
import {
  parseReceivedEvent,
  fetchReceivedEmail,
  fetchAttachmentBuffer,
  type FetchedEmail,
} from "@/lib/resend-receiving";
import { userForFromAddress } from "@/lib/inbound";
import { extractBill, hashImage, parseInvoiceDate } from "@/lib/ocr";
import { prisma } from "@/lib/db";
import { sendEmail, escapeHtml } from "@/lib/email";
import { currencyForCountry } from "@/lib/format";
import { dispatch } from "@/lib/auto-pingpong";
import { recordProof } from "@/lib/outcome-proof";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

type AttachmentBuf = { filename: string; contentType: string; buffer: Buffer };

function localPart(addr: string): string {
  const at = addr.indexOf("@");
  return (at >= 0 ? addr.slice(0, at) : addr).toLowerCase();
}

function recipientsHave(email: FetchedEmail, localname: string): boolean {
  return email.to.some((t) => localPart(t) === localname);
}

/** Fetch every attachment's bytes (10MB cap enforced in the API client). */
async function collectAttachments(email: FetchedEmail): Promise<AttachmentBuf[]> {
  const out: AttachmentBuf[] = [];
  for (const meta of email.attachments) {
    const dl = await fetchAttachmentBuffer(email.emailId, meta.id);
    if (dl) out.push({ filename: meta.filename, contentType: dl.contentType, buffer: dl.buffer });
  }
  return out;
}

/** Scrape the last currency amount from an email body (proof text fallback). */
function lastAmountCents(text: string): number | null {
  const matches = [
    ...text.matchAll(
      /(?:€|EUR|£|GBP)\s*([0-9]{1,4}(?:[.,][0-9]{2}))|([0-9]{1,4}(?:[.,][0-9]{2}))\s*(?:euro|EUR|€|£|pound)/gi,
    ),
  ];
  const last = matches[matches.length - 1];
  if (!last) return null;
  const num = Number((last[1] ?? last[2] ?? "").replace(",", "."));
  return Number.isFinite(num) ? Math.round(num * 100) : null;
}

// ---- bill-forward branch (inbox@) -------------------------------------

function userScopedHash(rawHash: string, userId: string): string {
  return `${rawHash}-${userId.slice(0, 8)}`;
}

async function replySignupRequired(to: string): Promise<void> {
  await sendEmail({
    to,
    subject: "DeGeldHeld — we konden je niet vinden",
    html: `<p>Hoi,</p>
<p>We zagen een factuur bij <strong>inbox@degeldheld.com</strong>, maar dit e-mailadres staat
nog niet in onze database.</p>
<p>Maak gratis een account aan op <a href="${APP_URL}/login">${APP_URL}/login</a>
en stuur de factuur opnieuw — dan analyseren we 'm direct.</p>
<p>— DeGeldHeld</p>`,
    text: `Hoi,

We zagen een factuur bij inbox@degeldheld.com, maar dit e-mailadres staat nog niet in onze database.
Maak gratis een account aan op ${APP_URL}/login en stuur de factuur opnieuw.

— DeGeldHeld`,
  });
}

async function replyAnalysis(
  to: string,
  bills: Array<{ id: string; provider: string; amountCents: number }>,
): Promise<void> {
  if (bills.length === 0) return;
  const lines = bills.map(
    (b) => `• ${b.provider} — €${(b.amountCents / 100).toFixed(2).replace(".", ",")} → ${APP_URL}/onderhandel/email?bill=${b.id}`,
  );
  await sendEmail({
    to,
    subject: `DeGeldHeld — we zagen je factuur${bills.length > 1 ? "s" : ""}`,
    text: `Bedankt voor het doorsturen.

We hebben ${bills.length} factuur${bills.length > 1 ? "rekening" : ""} herkend:
${lines.join("\n")}

Open een link om direct de onderhandel-mail te genereren.

— DeGeldHeld`,
    html: `<p>Bedankt voor het doorsturen.</p>
<p>We hebben ${bills.length} factuur${bills.length > 1 ? "rekening" : ""} herkend:</p>
<ul>${bills
      .map(
        (b) =>
          `<li><strong>${escapeHtml(b.provider)}</strong> — €${(b.amountCents / 100).toFixed(2).replace(".", ",")} —
       <a href="${APP_URL}/onderhandel/email?bill=${b.id}">Genereer onderhandel-mail</a> ·
       <a href="${APP_URL}/onderhandel/analyse?bill=${b.id}">Analyse</a></li>`,
      )
      .join("")}</ul>
<p>— DeGeldHeld</p>`,
  });
}

async function handleBillForward(email: FetchedEmail, atts: AttachmentBuf[]) {
  const user = await userForFromAddress(email.from);
  if (!user) {
    try {
      await replySignupRequired(email.from);
    } catch {
      /* never block on outbound mail */
    }
    return NextResponse.json({ ok: true, sender: "unknown", replied: true });
  }

  const createdBills: Array<{ id: string; provider: string; amountCents: number }> = [];
  for (const att of atts) {
    const ct = att.contentType.toLowerCase();
    if (!ct.startsWith("image/") && ct !== "application/pdf") continue;

    const imageHash = userScopedHash(hashImage(att.buffer), user.id);
    const dup = await prisma.bill.findUnique({ where: { imageHash } });
    if (dup) {
      createdBills.push({ id: dup.id, provider: dup.provider, amountCents: dup.amountCents });
      continue;
    }

    const ocr = await extractBill(att.buffer, att.contentType);
    const priorBills = await prisma.bill.count({ where: { userId: user.id } });
    const bill = await prisma.bill.create({
      data: {
        userId: user.id,
        provider: ocr.provider ?? "Onbekend",
        category: ocr.category ?? "OVERIG",
        amountCents: ocr.amountCents ?? 0,
        monthlyCents: ocr.monthlyAmountCents,
        totalCents: ocr.totalAmountCents,
        plan: ocr.plan,
        period: ocr.period,
        invoiceDate: parseInvoiceDate(ocr.period),
        customerNumber: ocr.customerNumber,
        country: ocr.country ?? undefined,
        currency: currencyForCountry(ocr.country),
        imageHash,
        rawOcr: ocr.rawText.slice(0, 4000),
        position: priorBills,
        nextRecheckAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    createdBills.push({ id: bill.id, provider: bill.provider, amountCents: bill.amountCents });
  }

  if (createdBills.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, reason: "no-supported-attachments" });
  }
  try {
    await replyAnalysis(user.email, createdBills);
  } catch {
    /* never block */
  }
  return NextResponse.json({ ok: true, processed: createdBills.length });
}

// ---- proof-by-from fallback (bewijs@ without a token) -----------------

async function handleProofByFrom(email: FetchedEmail, atts: AttachmentBuf[]) {
  const negotiation = await prisma.negotiation.findFirst({
    where: { user: { email: email.from } },
    orderBy: { createdAt: "desc" },
    include: { bill: true, user: true },
  });
  if (!negotiation) {
    return NextResponse.json({ ok: true, reason: "no matching negotiation" });
  }
  if (negotiation.user.email?.toLowerCase() !== email.from) {
    return NextResponse.json({ ok: true, reason: "from-address does not match user" });
  }

  let newAmountCents: number | null = null;
  const att = atts[0];
  if (att) {
    try {
      const ocr = await extractBill(att.buffer, att.contentType);
      newAmountCents = ocr.monthlyAmountCents ?? ocr.amountCents ?? null;
    } catch {
      /* fall through to text scrape */
    }
  }
  if (newAmountCents == null) newAmountCents = lastAmountCents(email.text);

  const oldMonthly = negotiation.bill.monthlyCents ?? negotiation.bill.amountCents;
  const result = await recordProof({
    negotiationId: negotiation.id,
    kind: "forwarded_email",
    storageUrl: null,
    newAmountCents,
    oldMonthlyCents: oldMonthly,
    rawNote: email.subject,
  });
  return NextResponse.json({ ok: true, ...result });
}

// ---- the canonical entry-point ----------------------------------------

export async function handleInbound(req: Request): Promise<Response> {
  const rawBody = await req.text();

  if (!verifyResendWebhook(rawBody, req.headers)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, reason: "bad json" }, { status: 200 });
  }

  const meta = parseReceivedEvent(json);
  if (!meta) {
    return NextResponse.json({ ok: true, reason: "not an email.received event" }, { status: 200 });
  }

  // Hydrate the full email (body + headers + attachment metadata). A failure
  // here is transient/infra → 502 so Resend retries (never a silent drop).
  let email: FetchedEmail | null = null;
  try {
    email = await fetchReceivedEmail(meta.emailId);
  } catch (e) {
    Sentry.captureException(e, { tags: { module: "inbound-handler", stage: "fetch" } });
  }
  if (!email) {
    return NextResponse.json({ ok: false, reason: "could not fetch email" }, { status: 502 });
  }

  try {
    const atts = await collectAttachments(email);

    // Proof + negotiation by subject-token / thread-id → reuse dispatch().
    const attachmentsBase64 = atts.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      base64: a.buffer.toString("base64"),
    }));
    const dispatched = await dispatch({
      from: email.from,
      subject: email.subject,
      text: email.text,
      inReplyTo: email.inReplyTo,
      references: email.references,
      messageId: email.messageId,
      attachmentsBase64,
    });
    if (dispatched.kind !== "unknown") {
      return NextResponse.json({ ok: true, routed: dispatched.kind, result: dispatched });
    }

    // No token/thread match → fall back on the recipient address.
    if (recipientsHave(email, "bewijs")) {
      return await handleProofByFrom(email, atts);
    }
    if (recipientsHave(email, "inbox") || email.attachments.length > 0) {
      return await handleBillForward(email, atts);
    }
    return NextResponse.json({ ok: true, reason: "no match" }, { status: 200 });
  } catch (e) {
    // Business-logic failure must not 500 (Resend would retry forever).
    Sentry.captureException(e, { tags: { module: "inbound-handler", stage: "route" } });
    return NextResponse.json({ ok: false, reason: "handler error" }, { status: 200 });
  }
}

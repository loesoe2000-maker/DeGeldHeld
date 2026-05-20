/**
 * /api/inbound — Resend inbound webhook.
 *
 * Flow:
 *   1. Verify HMAC sig (resend-signature header against RESEND_WEBHOOK_SECRET)
 *   2. Parse payload → {from, subject, text, attachments[]}
 *   3. Match user by from-email. Unknown sender → reply with signup link + 200.
 *   4. For each attachment image/pdf: extractBill + prisma.bill.create
 *   5. Reply via Resend with analyse/email-deeplinks
 */

import { NextResponse } from "next/server";
import {
  verifyResendSignature,
  parseInboundPayload,
  userForFromAddress,
  RESEND_SIGNATURE_HEADER,
} from "@/lib/inbound";
import { extractBill, hashImage, parseInvoiceDate } from "@/lib/ocr";
import { prisma } from "@/lib/db";
import { sendEmail, escapeHtml } from "@/lib/email";
import { currencyForCountry } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

function userScopedHash(rawHash: string, userId: string): string {
  // Same scheme as upload route: rawHash + userId-suffix to avoid global collisions
  return `${rawHash}-${userId.slice(0, 8)}`;
}

async function replySignupRequired(to: string) {
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

async function replyAnalysis(to: string, bills: Array<{ id: string; provider: string; amountCents: number }>) {
  if (bills.length === 0) return;
  const lines = bills.map(
    (b) =>
      `• ${b.provider} — €${(b.amountCents / 100).toFixed(2).replace(".", ",")} → ${APP_URL}/onderhandel/email?bill=${b.id}`,
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

export async function POST(req: Request) {
  // Raw body required for HMAC verification — must clone before .json().
  const rawBody = await req.text();
  const sig = req.headers.get(RESEND_SIGNATURE_HEADER);
  if (!verifyResendSignature(rawBody, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsed: ReturnType<typeof parseInboundPayload> = null;
  try {
    parsed = parseInboundPayload(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  if (!parsed) return NextResponse.json({ error: "Missing from address" }, { status: 400 });

  if (parsed.attachments.length === 0) {
    // Still 200 — webhook delivery succeeded, just nothing to do.
    return NextResponse.json({ ok: true, processed: 0, reason: "no-attachments" }, { status: 400 });
  }

  const user = await userForFromAddress(parsed.from);
  if (!user) {
    try {
      await replySignupRequired(parsed.from);
    } catch {
      // never block on outbound mail
    }
    return NextResponse.json({ ok: true, sender: "unknown", replied: true });
  }

  const createdBills: Array<{ id: string; provider: string; amountCents: number }> = [];
  for (const att of parsed.attachments) {
    const ct = att.contentType.toLowerCase();
    if (!ct.startsWith("image/") && ct !== "application/pdf") continue;

    const buf = Buffer.from(att.base64, "base64");
    const rawHash = hashImage(buf);
    const imageHash = userScopedHash(rawHash, user.id);

    const dup = await prisma.bill.findUnique({ where: { imageHash } });
    if (dup) {
      createdBills.push({ id: dup.id, provider: dup.provider, amountCents: dup.amountCents });
      continue;
    }

    const ocr = await extractBill(buf, att.contentType);
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
    return NextResponse.json({ ok: true, processed: 0, reason: "no-supported-attachments" }, { status: 400 });
  }

  try {
    await replyAnalysis(user.email, createdBills);
  } catch {
    // never block
  }

  return NextResponse.json({ ok: true, processed: createdBills.length });
}

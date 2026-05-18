/**
 * POST /api/inbound/proof — Resend webhook for forwarded savings-proof
 * emails (provider confirmations / new invoices the user forwards to
 * bewijs@degeldheld.com).
 *
 *  401 — missing / invalid HMAC signature
 *  503 — FEATURE_PROOF_REQUIRED disabled
 *  200 — handled (even if we couldn't match; webhook must not retry on
 *        parse failures, only on signature failures).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";
import {
  PROOF_SIG_HEADER,
  verifyProofSignature,
  parseProofPayload,
  extractProofToken,
} from "@/lib/proof-inbound";
import { extractBill } from "@/lib/ocr";
import { recordProof } from "@/lib/outcome-proof";
import { extractThreadId } from "@/lib/email-thread";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get(PROOF_SIG_HEADER);

  if (!verifyProofSignature(rawBody, sig)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (!isEnabled("PROOF_REQUIRED")) {
    return NextResponse.json({ error: "feature disabled" }, { status: 503 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, reason: "bad json" }, { status: 200 });
  }
  const payload = parseProofPayload(parsed);
  if (!payload) {
    return NextResponse.json({ ok: false, reason: "unparseable" }, { status: 200 });
  }

  // Step 1: locate the target Negotiation.
  // Priority: explicit [PROOF-<id>] in subject → In-Reply-To thread-id
  //   → fallback by from-address (last open negotiation for that user).
  const token = extractProofToken(payload.subject);
  let negotiation = token
    ? await prisma.negotiation.findFirst({
        where: { id: token },
        include: { bill: true, user: true },
      })
    : null;

  if (!negotiation) {
    const threadId = extractThreadId(payload.inReplyTo);
    if (threadId) {
      negotiation = await prisma.negotiation.findUnique({
        where: { providerThreadId: threadId },
        include: { bill: true, user: true },
      });
    }
  }
  if (!negotiation) {
    negotiation = await prisma.negotiation.findFirst({
      where: { user: { email: payload.from } },
      orderBy: { createdAt: "desc" },
      include: { bill: true, user: true },
    });
  }
  if (!negotiation) {
    return NextResponse.json({ ok: false, reason: "no matching negotiation" }, { status: 200 });
  }
  if (negotiation.user.email?.toLowerCase() !== payload.from) {
    return NextResponse.json({ ok: false, reason: "from-address does not match user" }, { status: 200 });
  }

  // Step 2: extract a new monthly amount from the first attachment OR
  // from the email body via the same Groq OCR pipeline.
  let newAmountCents: number | null = null;
  const att = payload.attachmentsBase64[0];
  if (att) {
    try {
      const buf = Buffer.from(att.base64, "base64");
      const ocr = await extractBill(buf, att.contentType);
      newAmountCents = ocr.monthlyAmountCents ?? ocr.amountCents ?? null;
    } catch {
      /* fall through to text scrape */
    }
  }
  if (newAmountCents == null) {
    // text fallback — last currency amount in the body
    const matches = [
      ...payload.text.matchAll(
        /(?:€|EUR|£|GBP)\s*([0-9]{1,4}(?:[.,][0-9]{2}))|([0-9]{1,4}(?:[.,][0-9]{2}))\s*(?:euro|EUR|€|£|pound)/gi,
      ),
    ];
    const last = matches[matches.length - 1];
    if (last) {
      const num = Number((last[1] ?? last[2] ?? "").replace(",", "."));
      if (Number.isFinite(num)) newAmountCents = Math.round(num * 100);
    }
  }

  const oldMonthly = negotiation.bill.monthlyCents ?? negotiation.bill.amountCents;
  const result = await recordProof({
    negotiationId: negotiation.id,
    kind: "forwarded_email",
    storageUrl: null,
    newAmountCents,
    oldMonthlyCents: oldMonthly,
    rawNote: payload.subject,
  });

  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}

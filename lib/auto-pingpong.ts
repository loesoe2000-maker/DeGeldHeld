/**
 * lib/auto-pingpong.ts — v12 inbound discriminator.
 *
 * The Resend inbound webhook (`/api/inbound/router`) routes a single
 * incoming mail to one of three handlers:
 *
 *   [PROOF-<billId>]        → proof-flow (DEEL 2 of v11)
 *   [NEGOTIATION-<negId>]   → auto-pingpong counter-mail generation
 *   In-Reply-To matches a Negotiation thread → auto-pingpong fallback
 *   anything else           → ack 200, no-op
 *
 * The discriminator is pure: given a subject + headers, it returns a
 * routing intent. The actual side effects (DB writes, user
 * notification, sendEmail) happen in the callee module (inbound-router
 * for negotiation; proof-inbound + outcome-proof for proof).
 *
 * Hard rule: this module NEVER puts a counter-mail on the wire to the
 * provider. That stays gated behind /api/negotiations/round/[id]/
 * confirm-send. The webhook can only WRITE rows + notify the user.
 */

import { prisma } from "@/lib/db";
import {
  extractProofSubjectToken,
  extractNegotiationSubjectToken,
  extractThreadId,
} from "@/lib/email-thread";
import {
  routeInboundReply,
  type InboundRouterPayload,
  type RouteResult,
} from "@/lib/inbound-router";
import { recordProof } from "@/lib/outcome-proof";
import { extractBill } from "@/lib/ocr";
import { isEnabled } from "@/lib/feature-flags";

export type DiscriminatedIntent =
  | { kind: "proof"; billId: string }
  | { kind: "negotiation"; negotiationId: string | null; viaThreadId: boolean }
  | { kind: "unknown" };

/**
 * Pure routing decision. No DB calls, no side effects — caller decides
 * which side-effecting handler to invoke based on this.
 */
export function discriminate(payload: {
  subject: string;
  inReplyTo: string | null;
  references: string | null;
}): DiscriminatedIntent {
  const proofToken = extractProofSubjectToken(payload.subject);
  if (proofToken) return { kind: "proof", billId: proofToken };

  const negToken = extractNegotiationSubjectToken(payload.subject);
  if (negToken) return { kind: "negotiation", negotiationId: negToken, viaThreadId: false };

  // In-Reply-To fallback — caller has to look up the negotiation by
  // thread-id since that's a DB read.
  const threadId =
    extractThreadId(payload.inReplyTo) ?? extractThreadId(payload.references);
  if (threadId) return { kind: "negotiation", negotiationId: null, viaThreadId: true };

  return { kind: "unknown" };
}

export type DispatchResult =
  | { kind: "proof"; ok: boolean; proofId?: string; verdict?: string; reason?: string }
  | { kind: "negotiation"; result: RouteResult }
  | { kind: "unknown" };

/**
 * Dispatch — does the actual side-effects. Caller is the webhook
 * route handler; it has already verified HMAC + feature flag.
 *
 * The proof-branch runs OCR on the first attachment OR scrapes the
 * body, then calls recordProof() which is the single side-effect
 * entry-point for proof bookkeeping.
 */
export async function dispatch(
  payload: InboundRouterPayload & { attachmentsBase64?: { filename: string; contentType: string; base64: string }[] },
): Promise<DispatchResult> {
  const intent = discriminate(payload);

  if (intent.kind === "proof") {
    // Resolve the bill — the token in the subject is a Bill.id, the
    // sprint spec uses billId not negotiationId for the PROOF token.
    const bill = await prisma.bill.findUnique({
      where: { id: intent.billId },
      include: { negotiation: true, user: { select: { email: true } } },
    });
    if (!bill || !bill.negotiation) {
      return { kind: "proof", ok: false, reason: "bill or negotiation not found" };
    }
    if (bill.user?.email && bill.user.email.toLowerCase() !== payload.from) {
      return { kind: "proof", ok: false, reason: "from-address does not match user" };
    }
    let newAmountCents: number | null = null;
    const att = payload.attachmentsBase64?.[0];
    if (att) {
      try {
        const buf = Buffer.from(att.base64, "base64");
        const ocr = await extractBill(buf, att.contentType);
        newAmountCents = ocr.monthlyAmountCents ?? ocr.amountCents ?? null;
      } catch {
        /* ignore — fall through to text scrape */
      }
    }
    if (newAmountCents == null) {
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
    const oldMonthly = bill.monthlyCents ?? bill.amountCents;
    const { proofId, verdict } = await recordProof({
      negotiationId: bill.negotiation.id,
      kind: "forwarded_email",
      storageUrl: null,
      newAmountCents,
      oldMonthlyCents: oldMonthly,
      rawNote: payload.subject,
    });
    return { kind: "proof", ok: true, proofId, verdict: verdict.verdict };
  }

  if (intent.kind === "negotiation") {
    // Feature-flag gate: auto-pingpong only generates counter-drafts when
    // AUTO_PINGPONG is on. Off → no-op (the canonical handler returns 200,
    // no retry storm). The proof branch above is intentionally NOT gated
    // here — it has its own gate inside recordProof.
    if (!isEnabled("AUTO_PINGPONG")) {
      return { kind: "negotiation", result: { ok: false, reason: "feature-disabled" } };
    }
    // routeInboundReply does its own thread-id extraction — it falls
    // back to In-Reply-To even if we don't pass a NEGOTIATION token.
    // For subject-token routing we patch the payload so the thread
    // lookup hits the explicit id.
    if (intent.negotiationId) {
      const neg = await prisma.negotiation.findUnique({
        where: { id: intent.negotiationId },
        select: { providerThreadId: true },
      });
      if (neg?.providerThreadId) {
        const patched: InboundRouterPayload = {
          ...payload,
          inReplyTo: `<${neg.providerThreadId}@${process.env.RESEND_INBOUND_DOMAIN ?? "degeldheld.com"}>`,
        };
        const result = await routeInboundReply(patched);
        return { kind: "negotiation", result };
      }
      return { kind: "negotiation", result: { ok: false, reason: "no-match" } };
    }
    const result = await routeInboundReply(payload);
    return { kind: "negotiation", result };
  }

  return { kind: "unknown" };
}

/**
 * lib/outcome-proof.ts — v11 revenue verification helpers.
 *
 * Verifying a savings claim requires one piece of evidence (forwarded
 * email, screenshot, or a follow-up bill). This module is the single
 * source of truth for the verify/reject decision so the inbound
 * webhook, the direct-upload endpoint, and the recheck-savings cron
 * all behave the same.
 */

import { prisma } from "@/lib/db";
import { feeForVerifiedSavings, shouldChargeVerifiedFee } from "@/lib/payments";

/** Minimum percentage drop between old and new monthly amount to count
 *  as a real saving. Anything smaller is likely OCR noise.  */
export const MIN_SAVINGS_DROP_PCT = 0.05;

/** Yearly threshold below which we do NOT trigger a fee. */
export const MIN_VERIFIED_YEARLY_SAVINGS_CENTS = 5000; // €50/jaar

export type ProofVerdict =
  | { verdict: "verified"; deltaCents: number; yearlySavingsCents: number }
  | { verdict: "rejected"; reason: string };

/**
 * Decide whether a new amount represents a verified saving relative to
 * the original bill. Pure function — no side effects, no DB calls.
 */
export function evaluateProof(opts: {
  oldMonthlyCents: number;
  newAmountCents: number | null;
}): ProofVerdict {
  if (opts.newAmountCents == null || opts.newAmountCents <= 0) {
    return { verdict: "rejected", reason: "no amount extracted from proof" };
  }
  if (opts.oldMonthlyCents <= 0) {
    return { verdict: "rejected", reason: "original bill amount missing" };
  }
  if (opts.newAmountCents >= opts.oldMonthlyCents) {
    return { verdict: "rejected", reason: "new amount is not lower than the original" };
  }
  const deltaCents = opts.oldMonthlyCents - opts.newAmountCents;
  const dropPct = deltaCents / opts.oldMonthlyCents;
  if (dropPct < MIN_SAVINGS_DROP_PCT) {
    return {
      verdict: "rejected",
      reason: `drop of ${(dropPct * 100).toFixed(1)}% is below the ${(
        MIN_SAVINGS_DROP_PCT * 100
      ).toFixed(0)}% minimum threshold`,
    };
  }
  return {
    verdict: "verified",
    deltaCents,
    yearlySavingsCents: deltaCents * 12,
  };
}

export type ProofKind = "forwarded_email" | "new_bill" | "screenshot" | "manual";

/**
 * Persist an OutcomeProof row and, if the verdict is "verified", flip
 * the parent Negotiation into SUCCESS state with verified savings.
 *
 * This is the single side-effect entry-point — every caller must go
 * through here so the bookkeeping stays consistent.
 */
export async function recordProof(opts: {
  negotiationId: string;
  kind: ProofKind;
  storageUrl?: string | null;
  newAmountCents: number | null;
  oldMonthlyCents: number;
  rawNote?: string;
}): Promise<{ proofId: string; verdict: ProofVerdict }> {
  const verdict = evaluateProof({
    oldMonthlyCents: opts.oldMonthlyCents,
    newAmountCents: opts.newAmountCents,
  });

  const proof = await prisma.outcomeProof.create({
    data: {
      negotiationId: opts.negotiationId,
      kind: opts.kind,
      storageUrl: opts.storageUrl ?? null,
      parsedAmountCents: opts.newAmountCents ?? null,
      verifiedAt: verdict.verdict === "verified" ? new Date() : null,
      verificationStatus: verdict.verdict,
      verifierNote: verdict.verdict === "rejected" ? verdict.reason : opts.rawNote ?? null,
    },
  });

  if (verdict.verdict === "verified") {
    // Fetch the userId once so the optional fee-eligibility check
    // (admin bypass + flag-off short-circuit) can reuse it.
    const neg = await prisma.negotiation.findUnique({
      where: { id: opts.negotiationId },
      select: { userId: true },
    });
    const feeCents = feeForVerifiedSavings(verdict.yearlySavingsCents);
    const charge = neg
      ? await shouldChargeVerifiedFee({
          userId: neg.userId,
          actualSavingsCents: verdict.yearlySavingsCents,
        })
      : false;

    await prisma.negotiation.update({
      where: { id: opts.negotiationId },
      data: {
        // Charge path → BILLED_PENDING_PAYMENT so the user sees the
        // fee CTA on /uitkomst. Non-charge (admin/flag-off/sub-floor)
        // jumps straight to SUCCESS — same as legacy.
        state: charge && feeCents > 0 ? "BILLED_PENDING_PAYMENT" : "SUCCESS",
        proofVerifiedAt: new Date(),
        actualSavingsCents: verdict.yearlySavingsCents,
        feeAmountCents: charge ? feeCents : null,
        feeInvoicedAt: charge && feeCents > 0 ? new Date() : null,
      },
    });
  }

  return { proofId: proof.id, verdict };
}

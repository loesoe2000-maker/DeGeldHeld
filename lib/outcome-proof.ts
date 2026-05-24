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
import { feeForVerifiedSavings, shouldChargeVerifiedFee, chargeFeeOffSession } from "@/lib/payments";
import { sendEmail } from "@/lib/email";
import { categoryAllowsFee } from "@/lib/category-strategy";
import type { Category } from "@/lib/providers";

const APP_URL = process.env.APP_URL ?? "https://www.degeldheld.com";

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
    // Fetch userId (+ email/billId + category for the v30 fee-integrity gate).
    const neg = await prisma.negotiation.findUnique({
      where: { id: opts.negotiationId },
      select: {
        userId: true,
        billId: true,
        user: { select: { email: true } },
        bill: { select: { category: true } },
      },
    });
    const feeCents = feeForVerifiedSavings(verdict.yearlySavingsCents);
    // v30 fee-integrity: TELECOM (en andere TYPE_B-categorieën) triggeren géén
    // NCNP-fee — de "lever" is daar advies, geen e-mail-onderhandeling.
    // Defensief: onbekende/ontbrekende categorie → fee toestaan (legacy
    // negotiation-rijen zonder bill-include blijven werken zoals voorheen).
    const categoryFeeAllowed = neg?.bill?.category
      ? categoryAllowsFee(neg.bill.category as Category)
      : true;
    const charge = neg && categoryFeeAllowed
      ? await shouldChargeVerifiedFee({
          userId: neg.userId,
          actualSavingsCents: verdict.yearlySavingsCents,
        })
      : false;

    const baseData = {
      proofVerifiedAt: new Date(),
      actualSavingsCents: verdict.yearlySavingsCents,
    };

    if (charge && feeCents > 0 && neg) {
      // v19: try to charge the fee off-session against a saved card. On
      // success → FEE_PAID (no manual step). On failure / no card →
      // BILLED_PENDING_PAYMENT (the existing manual pay flow + a mail).
      const result = await chargeFeeOffSession({
        userId: neg.userId,
        negotiationId: opts.negotiationId,
        feeCents,
      });
      if (result.ok) {
        await prisma.negotiation.update({
          where: { id: opts.negotiationId },
          data: {
            ...baseData,
            state: "FEE_PAID",
            feeAmountCents: feeCents,
            feeInvoicedAt: new Date(),
            feePaidAt: new Date(),
            feePaymentIntentId: result.paymentIntentId,
          },
        });
      } else {
        await prisma.negotiation.update({
          where: { id: opts.negotiationId },
          data: {
            ...baseData,
            state: "BILLED_PENDING_PAYMENT",
            feeAmountCents: feeCents,
            feeInvoicedAt: new Date(),
          },
        });
        // Best-effort fallback mail with the manual pay link.
        if (neg.user?.email) {
          try {
            const link = `${APP_URL}/onderhandel/${neg.billId}/uitkomst`;
            const eur = (feeCents / 100).toFixed(2).replace(".", ",");
            await sendEmail({
              to: neg.user.email,
              subject: "Je onderhandeling is gelukt — rond de fee af",
              text: `Goed nieuws — je onderhandeling is gelukt en de besparing is bevestigd!

We konden de fee (€${eur}) niet automatisch afschrijven. Rond 'm hier handmatig af:
${link}

— DeGeldHeld`,
              html: `<p>Goed nieuws — je onderhandeling is gelukt en de besparing is bevestigd!</p>
<p>We konden de fee (<strong>€${eur}</strong>) niet automatisch afschrijven.</p>
<p><a href="${link}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Rond de betaling af</a></p>
<p>— DeGeldHeld</p>`,
            });
          } catch {
            /* never block on outbound mail */
          }
        }
      }
    } else {
      // No charge (admin / flag-off / sub-floor) → straight to SUCCESS.
      await prisma.negotiation.update({
        where: { id: opts.negotiationId },
        data: { ...baseData, state: "SUCCESS", feeAmountCents: null, feeInvoicedAt: null },
      });
    }
  }

  return { proofId: proof.id, verdict };
}

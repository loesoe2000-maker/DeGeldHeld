/**
 * lib/recheck-savings.ts — pure helpers for the recheck-savings cron.
 *
 * Cron runs daily at 09:30 UTC and reminds users 28-35 days after a
 * negotiation closed to forward their *new* bill so we can verify
 * the savings.
 */

import type { Negotiation } from "@prisma/client";

/** Window (in days) since EMAIL_SENT/COUNTER_SENT we ask for a recheck. */
export const RECHECK_WINDOW_DAYS = { min: 28, max: 35 } as const;

/** Pure: is this negotiation due for a recheck-savings reminder? */
export function isDueForRecheck(
  neg: Pick<Negotiation, "state" | "emailSentAt" | "proofVerifiedAt" | "closedAt">,
  now: Date = new Date(),
): boolean {
  // Already verified — nothing to chase.
  if (neg.proofVerifiedAt) return false;
  // Open negotiations have nothing to verify yet.
  // ACCEPTED = multi-round-succes: zonder recheck nooit bewijs → nooit fee.
  const eligibleStates = ["EMAIL_SENT", "COUNTER_SENT", "SUCCESS_UNVERIFIED", "ACCEPTED"];
  if (!eligibleStates.includes(neg.state)) return false;
  // Anker op de SLUITING als die er is: een multi-round-deal wordt vaak pas
  // weken ná de eerste mail geaccepteerd — ankeren op emailSentAt liet het
  // 28-35-dagen-venster dan al verstreken zijn op het moment van acceptatie,
  // waardoor ACCEPTED nooit een bewijs-verzoek kreeg → nooit fee.
  const anchor = neg.closedAt ?? neg.emailSentAt;
  if (!anchor) return false;
  const ageDays = (now.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000);
  return ageDays >= RECHECK_WINDOW_DAYS.min && ageDays <= RECHECK_WINDOW_DAYS.max;
}

/**
 * Compute the verified yearly saving from before/after bills.
 * Returns null when the new bill isn't actually cheaper.
 */
export function diffYearlySavings(
  oldMonthlyCents: number,
  newMonthlyCents: number,
): number | null {
  if (oldMonthlyCents <= 0 || newMonthlyCents <= 0) return null;
  const delta = oldMonthlyCents - newMonthlyCents;
  // Min ~€1/maand verschil om OCR-jitter te negeren.
  if (delta < 100) return null;
  return delta * 12;
}

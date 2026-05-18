/**
 * lib/fraud-detection.ts — v11 anti-fraud scoring.
 *
 * Pure-function scoring engine. Caller (the cron + admin panel) feeds
 * an aggregated `UserSignals` snapshot — the function returns a
 * 0-100 score plus the human-readable reasons.
 *
 * Thresholds and weights are tuned conservatively so first-time
 * legit users (who skip proof once) don't get flagged. A score of
 * >=50 is the "flag for admin review" threshold.
 */

export const FRAUD_FLAG_THRESHOLD = 50;

/** Known disposable / throwaway email domains. Conservative list. */
export const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "yopmail.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "trashmail.com",
  "throwawaymail.com",
  "fakeinbox.com",
  "dispostable.com",
  "getnada.com",
  "maildrop.cc",
  "tempr.email",
]);

export type UserSignals = {
  email: string;
  /** Negotiations in last 30 days that ended in SUCCESS_UNVERIFIED. */
  unverifiedClaims30d: number;
  /** Total negotiations the user has ever closed. */
  totalClaims: number;
  /** Subset of totalClaims for which a verified proof exists. */
  verifiedClaims: number;
  /** Distinct providers across all bills, including reuploads. */
  distinctProviders: number;
  /** Number of bills with a duplicate imageHash across the account. */
  duplicateImageHashes: number;
};

export type SuspicionResult = {
  score: number;
  reasons: string[];
};

export function suspicionScore(signals: UserSignals): SuspicionResult {
  const reasons: string[] = [];
  let score = 0;

  if (signals.unverifiedClaims30d > 5) {
    score += 30;
    reasons.push(
      `>5 SUCCESS_UNVERIFIED claims in 30d (${signals.unverifiedClaims30d}) — +30`,
    );
  }

  if (signals.duplicateImageHashes > 0) {
    // Same image reused (potentially marked as different providers).
    score += 50;
    reasons.push(
      `${signals.duplicateImageHashes} bill(s) with a duplicate imageHash — +50`,
    );
  }

  if (signals.totalClaims >= 3 && signals.verifiedClaims === 0) {
    score += 25;
    reasons.push(
      `0/${signals.totalClaims} claims ever verified — +25`,
    );
  }

  const domain = extractDomain(signals.email);
  if (domain && DISPOSABLE_DOMAINS.has(domain)) {
    score += 40;
    reasons.push(`disposable email domain "${domain}" — +40`);
  }

  return { score: Math.min(100, score), reasons };
}

function extractDomain(email: string): string | null {
  const m = /@([^@\s]+)\s*$/.exec(email.toLowerCase());
  return m ? m[1] : null;
}

export function isFlaggable(result: SuspicionResult): boolean {
  return result.score >= FRAUD_FLAG_THRESHOLD;
}

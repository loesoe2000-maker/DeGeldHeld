/**
 * lib/anti-bot.ts — v15 DEEL 5 reusable anti-bot guards.
 *
 * Combines three cheap signals into a single decision helper:
 *   - User-Agent blocklist (curl, python-requests, etc).
 *   - Time-to-submit (bots submit instantly).
 *   - Honeypot field presence.
 *
 * Turnstile is the heavyweight gate; this module catches the bots
 * that don't bother trying. Each signal stays independently
 * testable so we can tune thresholds without touching call sites.
 *
 * Hard rule: every helper here is conservative. False-positives
 * (rejecting a legit user) are worse than false-negatives — Turnstile
 * + rate-limit are the safety net.
 */

/** Known automation User-Agents we refuse outright. */
export const BOT_USER_AGENT_PATTERNS: RegExp[] = [
  /curl\//i,
  /\bwget\b/i,
  /python-requests/i,
  /python-urllib/i,
  /go-http-client/i,
  /scrapy/i,
  /headlesschrome/i,
  /\bbot\b/i,
  /spider/i,
  /crawler/i,
];

export function looksLikeBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false; // ambiguous; let Turnstile decide
  return BOT_USER_AGENT_PATTERNS.some((rx) => rx.test(ua));
}

/** Minimum render → submit gap before we accept the request. */
export const MIN_HUMAN_FORM_TIME_MS = 2000;

export function submittedTooFast(renderedAt: number | null | undefined, now: number = Date.now()): boolean {
  if (!renderedAt || !Number.isFinite(renderedAt)) return false;
  return now - renderedAt < MIN_HUMAN_FORM_TIME_MS;
}

export function honeypotFilled(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.trim().length > 0;
}

/** Compose all three into a single decision. */
export type AntiBotInput = {
  userAgent?: string | null;
  honeypot?: string | null;
  renderedAt?: number | null;
};

export type AntiBotVerdict =
  | { ok: true }
  | { ok: false; reason: "user-agent" | "honeypot" | "too-fast" };

export function evaluateAntiBot(input: AntiBotInput, now: number = Date.now()): AntiBotVerdict {
  if (honeypotFilled(input.honeypot)) return { ok: false, reason: "honeypot" };
  if (submittedTooFast(input.renderedAt, now)) return { ok: false, reason: "too-fast" };
  if (looksLikeBotUserAgent(input.userAgent)) return { ok: false, reason: "user-agent" };
  return { ok: true };
}

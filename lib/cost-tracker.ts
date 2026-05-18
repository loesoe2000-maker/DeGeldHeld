/**
 * lib/cost-tracker.ts — v14 DEEL 9 (minimal).
 *
 * Goal: pure cost-estimation helper that callers can use to log Groq
 * token usage to Sentry (or stdout) WITHOUT introducing a new
 * DailyApiCost Prisma table. v14 spec mentions a table but the user
 * explicitly said "no new features, only hardening + verification";
 * we therefore keep cost-tracking observable but stateless. A future
 * full implementation can swap the in-memory log for the Prisma
 * variant without changing call sites.
 *
 * Pure — no DB, no side effects on the hot path beyond optional
 * Sentry breadcrumbs.
 */

import * as Sentry from "@sentry/nextjs";

/** Public pricing snapshots (per-million tokens, cents). Indicative. */
export const GROQ_TEXT_COST_PER_MTOK_CENTS = 60; // llama-3.3-70b-versatile blended
export const GROQ_VISION_COST_PER_MTOK_CENTS = 110; // llama-4-scout blended

export type GroqCall = {
  kind: "text" | "vision";
  promptTokens: number;
  completionTokens: number;
};

/** Compute the cost of a single Groq call in cents (rounded up). */
export function costOfCall(c: GroqCall): number {
  const rate =
    c.kind === "vision"
      ? GROQ_VISION_COST_PER_MTOK_CENTS
      : GROQ_TEXT_COST_PER_MTOK_CENTS;
  const total = c.promptTokens + c.completionTokens;
  return Math.ceil((total * rate) / 1_000_000);
}

/**
 * Daily budget check. If the running total for the current UTC day
 * exceeds `DAILY_BUDGET_CENTS_WARN`, fire a Sentry message with
 * level=warning so the on-call gets paged on overruns.
 *
 * We keep the running total in-memory per process — Vercel rotates
 * workers so this is a soft signal, not an accounting ledger. The
 * hard cap lives in Vercel "Spend Management" (€15/maand cap;
 * documented in RUNBOOK).
 */
export const DAILY_BUDGET_CENTS_WARN = 5000; // €50/day → roughly €1500/month ceiling

const _dailyTotals = new Map<string, number>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function recordGroqCost(c: GroqCall): { dayCents: number; warned: boolean } {
  const key = todayKey();
  const add = costOfCall(c);
  const prev = _dailyTotals.get(key) ?? 0;
  const total = prev + add;
  _dailyTotals.set(key, total);

  let warned = false;
  if (prev < DAILY_BUDGET_CENTS_WARN && total >= DAILY_BUDGET_CENTS_WARN) {
    try {
      Sentry.captureMessage(
        `[cost-tracker] daily Groq spend crossed €${(DAILY_BUDGET_CENTS_WARN / 100).toFixed(0)} (today: €${(total / 100).toFixed(2)})`,
        { level: "warning", tags: { module: "cost-tracker", day: key } },
      );
    } catch {
      /* sentry unavailable */
    }
    warned = true;
  }
  return { dayCents: total, warned };
}

/** Test-only: reset the in-memory tallies. */
export function __resetCostTracker(): void {
  _dailyTotals.clear();
}

/** Test-only: peek at today's running total. */
export function todaySpentCents(): number {
  return _dailyTotals.get(todayKey()) ?? 0;
}

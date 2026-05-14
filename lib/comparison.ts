import { MARKET_PLANS, type SeedPlan } from "@/lib/market_db";
import type { Category } from "@/lib/providers";

export type Alternative = {
  plan: SeedPlan;
  monthlySavingsCents: number;
  yearlySavingsCents: number;
  percentSaved: number;
};

export type ComparisonResult = {
  current: { provider: string; category: Category; amountCents: number };
  topAlternatives: Alternative[];
  bestSavingsCents: number;
  bestSavingsPct: number;
};

const SAME_PROVIDER_RETENTION_DISCOUNT_PCT = 0.12; // assume 12% retention discount achievable

export function getCheaperAlternatives(
  currentProvider: string,
  category: Category,
  currentAmountCents: number,
  topN = 3,
): Alternative[] {
  const candidates = MARKET_PLANS.filter(
    (p) => p.category === category && p.priceCents < currentAmountCents,
  );

  // Prefer different providers (real switch); same-provider retention is option of last resort.
  const sorted = candidates.sort((a, b) => {
    const aSameProv = a.provider.toLowerCase() === currentProvider.toLowerCase() ? 1 : 0;
    const bSameProv = b.provider.toLowerCase() === currentProvider.toLowerCase() ? 1 : 0;
    if (aSameProv !== bSameProv) return aSameProv - bSameProv;
    return a.priceCents - b.priceCents;
  });

  return sorted.slice(0, topN).map((plan) => {
    const monthly = currentAmountCents - plan.priceCents;
    return {
      plan,
      monthlySavingsCents: monthly,
      yearlySavingsCents: monthly * 12,
      percentSaved: monthly / currentAmountCents,
    };
  });
}

export function buildComparison(input: {
  provider: string;
  category: Category;
  amountCents: number;
}): ComparisonResult {
  const top = getCheaperAlternatives(input.provider, input.category, input.amountCents);
  const best = top[0];
  return {
    current: input,
    topAlternatives: top,
    bestSavingsCents: best?.yearlySavingsCents ?? 0,
    bestSavingsPct: best?.percentSaved ?? 0,
  };
}

export function estimateRetentionSavings(currentAmountCents: number): number {
  return Math.round(currentAmountCents * SAME_PROVIDER_RETENTION_DISCOUNT_PCT);
}

export function isMeaningfulSaving(yearlyCents: number): boolean {
  // Exclude tiny "wins" — only present when ≥€20 per jaar.
  return yearlyCents >= 2000;
}

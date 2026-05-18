import { MARKET_PLANS, planCountry, type SeedPlan } from "@/lib/market_db";
import type { Category, Country } from "@/lib/providers";
import { ruleFor, type ComparisonUnit } from "@/lib/categories";

export type { ComparisonUnit };

/**
 * Regio-monopolie categorieën: hier heeft de consument géén keuze in
 * leverancier (water/gemeente in NL/BE, gemeente-belasting wereldwijd).
 * Onderhandelen heeft hier weinig zin — UI toont een aparte message-card.
 */
export function isMonopolyCategory(category: Category, country: Country = "NL"): boolean {
  if (category === "GEMEENTE") return true;
  if (category === "WATER" && (country === "NL" || country === "BE" || country === "DE")) return true;
  return false;
}

export function comparisonUnitFor(cat: Category): ComparisonUnit {
  return ruleFor(cat).comparisonUnit;
}

export function unitLabelFor(cat: Category): string {
  switch (ruleFor(cat).comparisonUnit) {
    case "monthly_eur":
      return "€/maand";
    case "per_kwh":
      return "€/kWh";
    case "per_m3":
      return "€/m³";
    case "per_year":
      return "€/jaar";
    case "interest_pct":
      return "% rente";
    case "monitoring_only":
      return "monitoring";
  }
}

export type Alternative = {
  plan: SeedPlan;
  monthlySavingsCents: number;
  yearlySavingsCents: number;
  percentSaved: number;
  /** Why this alternative? short NL string voor user-uitleg */
  rationale: string;
};

export type MarketRange = {
  minCents: number;
  maxCents: number;
  medianCents: number;
  /** 0..100 — userPercentile=100 ⇒ user behoort tot duurste, 0 ⇒ goedkoopste */
  userPercentile: number;
  sampleSize: number;
};

export type ComparisonResult = {
  current: { provider: string; category: Category; amountCents: number };
  topAlternatives: Alternative[];
  bestSavingsCents: number;
  bestSavingsPct: number;
  /** Markt-range voor deze categorie (NL+EU samen). */
  marketRange: MarketRange;
  /** 0..100 — hoe zeker zijn we dat besparing realistisch is */
  confidencePct: number;
};

const SAME_PROVIDER_RETENTION_DISCOUNT_PCT = 0.12;

export function getCheaperAlternatives(
  currentProvider: string,
  category: Category,
  currentAmountCents: number,
  topN = 3,
  country: Country = "NL",
): Alternative[] {
  const candidates = MARKET_PLANS.filter((p) => {
    if (p.category !== category) return false;
    if (p.priceCents >= currentAmountCents) return false;
    const c = planCountry(p);
    return c === country || c === "INT";
  });

  const sorted = candidates.sort((a, b) => {
    const aSameProv = a.provider.toLowerCase() === currentProvider.toLowerCase() ? 1 : 0;
    const bSameProv = b.provider.toLowerCase() === currentProvider.toLowerCase() ? 1 : 0;
    if (aSameProv !== bSameProv) return aSameProv - bSameProv;
    return a.priceCents - b.priceCents;
  });

  return sorted.slice(0, topN).map((plan, idx) => {
    const monthly = currentAmountCents - plan.priceCents;
    const pct = monthly / currentAmountCents;
    return {
      plan,
      monthlySavingsCents: monthly,
      yearlySavingsCents: monthly * 12,
      percentSaved: pct,
      rationale: rationaleFor(plan, pct, idx, currentProvider),
    };
  });
}

function rationaleFor(
  plan: SeedPlan,
  pct: number,
  index: number,
  currentProvider: string,
): string {
  if (plan.provider.toLowerCase() === currentProvider.toLowerCase()) {
    return `Goedkoper pakket binnen ${plan.provider} — overstappen via klantenservice.`;
  }
  if (index === 0) {
    return `Goedkoopste alternatief in markt — ${Math.round(pct * 100)}% korting bij overstap.`;
  }
  if (pct >= 0.3) {
    return `Aantrekkelijke besparing (${Math.round(pct * 100)}%) — sterke onderhandelingspositie.`;
  }
  if (pct >= 0.15) {
    return `Solide alternatief met ${Math.round(pct * 100)}% korting — geschikt als retentie-leverage.`;
  }
  return `Lichte besparing van ${Math.round(pct * 100)}% — nuttig als markt-vergelijking.`;
}

/**
 * Compute market price range for a category.
 * userPercentile = 100 → user is most expensive in market.
 */
export function getMarketRange(
  category: Category,
  userAmountCents: number,
  country: Country = "NL",
): MarketRange {
  const prices = MARKET_PLANS.filter((p) => {
    if (p.category !== category) return false;
    const c = planCountry(p);
    return c === country || c === "INT";
  })
    .map((p) => p.priceCents)
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return {
      minCents: userAmountCents,
      maxCents: userAmountCents,
      medianCents: userAmountCents,
      userPercentile: 50,
      sampleSize: 0,
    };
  }

  const minCents = prices[0];
  const maxCents = prices[prices.length - 1];
  const medianCents = prices[Math.floor(prices.length / 2)];
  const cheaperCount = prices.filter((p) => p < userAmountCents).length;
  const userPercentile = Math.round((cheaperCount / prices.length) * 100);

  return { minCents, maxCents, medianCents, userPercentile, sampleSize: prices.length };
}

/**
 * Confidence dat aanbevolen besparing realistisch is. 0..100.
 * Factoren:
 *  - Aantal alternatieven (meer = robuuster)
 *  - Provider bekend in registry
 *  - Sample-size markt
 *  - Penalty: te grote spread (waarschijnlijk feature-mismatch)
 *  - Penalty: user al onder de median
 */
export function computeConfidence(opts: {
  alternatives: Alternative[];
  range: MarketRange;
  currentAmountCents: number;
  providerKnown: boolean;
}): number {
  let score = 50;
  if (opts.alternatives.length >= 3) score += 20;
  else if (opts.alternatives.length >= 1) score += 10;
  if (opts.providerKnown) score += 10;
  if (opts.range.sampleSize >= 10) score += 10;
  else if (opts.range.sampleSize >= 5) score += 5;
  const best = opts.alternatives[0];
  if (best && best.percentSaved > 0.7) score -= 20;
  if (opts.currentAmountCents <= opts.range.medianCents) score -= 10;
  return Math.max(0, Math.min(100, score));
}

export function buildComparison(input: {
  provider: string;
  category: Category;
  amountCents: number;
  providerKnown?: boolean;
  country?: Country;
}): ComparisonResult {
  const country: Country = input.country ?? "NL";
  const top = getCheaperAlternatives(
    input.provider,
    input.category,
    input.amountCents,
    3,
    country,
  );
  const best = top[0];
  const range = getMarketRange(input.category, input.amountCents, country);
  const confidencePct = computeConfidence({
    alternatives: top,
    range,
    currentAmountCents: input.amountCents,
    providerKnown: input.providerKnown ?? true,
  });
  return {
    current: { provider: input.provider, category: input.category, amountCents: input.amountCents },
    topAlternatives: top,
    bestSavingsCents: best?.yearlySavingsCents ?? 0,
    bestSavingsPct: best?.percentSaved ?? 0,
    marketRange: range,
    confidencePct,
  };
}

export function estimateRetentionSavings(currentAmountCents: number): number {
  return Math.round(currentAmountCents * SAME_PROVIDER_RETENTION_DISCOUNT_PCT);
}

export function isMeaningfulSaving(yearlyCents: number): boolean {
  return yearlyCents >= 2000;
}

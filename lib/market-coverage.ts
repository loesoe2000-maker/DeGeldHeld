/**
 * lib/market-coverage.ts — v18 honesty gate.
 *
 * Which (category, country) combinations do we actually have
 * validated market data for? Energie/water/hypotheek/verzekering
 * use NL-only medians (lib/market-prices.ts); comparing a DE/FR
 * invoice against NL prices would be misleading, so the analyse
 * page must NOT show a concrete € savings for those.
 *
 * TELECOM/STREAMING/ABONNEMENT-class have INT plans in MARKET_PLANS
 * so they're meaningful cross-country.
 */
import type { Category, Country } from "@/lib/providers";
import { MARKET_PLANS, planCountry } from "@/lib/market_db";

/** Categories whose market data is NL-only (dated medians). */
const NL_ONLY_CATEGORIES: ReadonlySet<Category> = new Set<Category>([
  "ENERGIE",
  "WATER",
  "HYPOTHEEK",
  "VERZEKERING",
  "GEMEENTE",
]);

/**
 * Do we have validated market data to compare this (category, country)?
 *
 *  - NL is always covered for every category we support.
 *  - NL-only categories return false for any non-NL country.
 *  - Other categories (TELECOM/STREAMING/etc) are covered for a
 *    country when MARKET_PLANS holds at least one plan for that
 *    country OR an INT plan (universal).
 */
export function hasMarketData(category: Category, country: Country): boolean {
  if (country === "NL") return true;
  if (NL_ONLY_CATEGORIES.has(category)) return false;
  // Non-NL, non-NL-only category: need a real plan in that country or INT.
  return MARKET_PLANS.some((p) => {
    if (p.category !== category) return false;
    const c = planCountry(p);
    return c === country || c === "INT";
  });
}

/** Friendly NL country label for the honesty banner. */
export function countryLabel(country: Country): string {
  const map: Record<string, string> = {
    NL: "Nederlandse",
    BE: "Belgische",
    DE: "Duitse",
    FR: "Franse",
    UK: "Britse",
    US: "Amerikaanse",
    ES: "Spaanse",
    IT: "Italiaanse",
    INT: "internationale",
  };
  return map[country] ?? country;
}

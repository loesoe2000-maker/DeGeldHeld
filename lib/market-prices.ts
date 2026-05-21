/**
 * lib/market-prices.ts — v18 single dated source of truth.
 *
 * All hardcoded market medians/rates/premiums live HERE, with one
 * `PRICES_AS_OF` date. The category modules
 * (lib/categories/{energie,hypotheek,verzekering,water}.ts) import
 * from this file instead of carrying their own constants — so a
 * monthly refresh is one edit in one place.
 *
 * Refresh procedure: see RUNBOOK.md "Markt-prijzen verversen".
 * Sources: ACM energie-tariefoverzicht, hypotheekrente-overzichten,
 * verzekering-vergelijkers (Independer/Pricewise), drinkwaterbedrijven.
 */
import type { Category } from "@/lib/providers";

/** ISO date the medians below were last verified. Bump on every refresh. */
export const PRICES_AS_OF = "2026-05-20";

/**
 * v22: a single market plan-price with a MANDATORY source. Because `source`
 * is required, a price without a verifiable URL simply does not compile —
 * that's the point: no hallucinated prices ever land in the comparison.
 *
 * Only NL-market, currently-supported categories (telecom, streaming, gym,
 * software, opslag, OV, bank — NOT hypotheek/verzekering, those are gated).
 */
export type MarketPlan = {
  provider: string;
  category: Category;
  plan: string; // tarief-/pakketnaam zoals afgedrukt op de bron
  priceCents: number; // maandprijs in cents
  source: string; // URL waar deze prijs vandaan komt (VERPLICHT)
  verifiedAt: string; // ISO-datum van de fetch
};

/**
 * SOURCED plans — elke entry draagt de URL waar 'ie vandaan komt + de
 * fetch-datum. Per categorie gevuld in v22 DEEL 5.
 *
 * REFRESH-PROCEDURE (maandelijks, navolgbaar):
 *   1. Open per categorie de provider-/officiële tariefpagina's (de `source`
 *      URLs hieronder zijn de te-controleren bronnen).
 *   2. Werk priceCents bij naar het afgedrukte maandtarief; update verifiedAt.
 *   3. Kun je een prijs niet meer verifiëren? → verwijder 'm (liever een gat
 *      dan een verouderde/verzonnen prijs). Bump PRICES_AS_OF.
 *   Bron-categorieën: TELECOM, STREAMING, GYM, SOFTWARE/OPSLAG, OV.
 */
export const SOURCED_MARKET_PLANS: MarketPlan[] = [
  // ===== STREAMING — geverifieerd 2026-05-20 (publieke prijspagina's) =====
  { provider: "Spotify", category: "STREAMING", plan: "Premium Individual", priceCents: 1299, source: "https://www.spotify.com/nl/premium/", verifiedAt: "2026-05-20" },
  { provider: "Spotify", category: "STREAMING", plan: "Premium Student", priceCents: 699, source: "https://www.spotify.com/nl/premium/", verifiedAt: "2026-05-20" },
  { provider: "Spotify", category: "STREAMING", plan: "Premium Duo", priceCents: 1799, source: "https://www.spotify.com/nl/premium/", verifiedAt: "2026-05-20" },
  { provider: "Spotify", category: "STREAMING", plan: "Premium Family", priceCents: 2199, source: "https://www.spotify.com/nl/premium/", verifiedAt: "2026-05-20" },
  { provider: "Netflix", category: "STREAMING", plan: "Basis", priceCents: 999, source: "https://help.netflix.com/nl/node/24926", verifiedAt: "2026-05-20" },
  { provider: "Netflix", category: "STREAMING", plan: "Standaard", priceCents: 1599, source: "https://help.netflix.com/nl/node/24926", verifiedAt: "2026-05-20" },
  { provider: "Netflix", category: "STREAMING", plan: "Premium", priceCents: 2099, source: "https://help.netflix.com/nl/node/24926", verifiedAt: "2026-05-20" },
  { provider: "Disney+", category: "STREAMING", plan: "Standaard met reclame", priceCents: 699, source: "https://www.disneyplus.com/nl-nl", verifiedAt: "2026-05-20" },
  { provider: "Disney+", category: "STREAMING", plan: "Standaard", priceCents: 1099, source: "https://www.disneyplus.com/nl-nl", verifiedAt: "2026-05-20" },
  { provider: "Disney+", category: "STREAMING", plan: "Premium", priceCents: 1599, source: "https://www.disneyplus.com/nl-nl", verifiedAt: "2026-05-20" },

  // ===== SOFTWARE — geverifieerd 2026-05-20 =====
  { provider: "Microsoft 365", category: "SOFTWARE", plan: "Personal (maandelijks)", priceCents: 1000, source: "https://www.microsoft.com/nl-nl/microsoft-365/buy/compare-all-microsoft-365-products", verifiedAt: "2026-05-20" },
  { provider: "Microsoft 365", category: "SOFTWARE", plan: "Family (maandelijks)", priceCents: 1300, source: "https://www.microsoft.com/nl-nl/microsoft-365/buy/compare-all-microsoft-365-products", verifiedAt: "2026-05-20" },

  // ===== OPSLAG (cloud) — geverifieerd 2026-05-20 =====
  { provider: "iCloud+", category: "OPSLAG", plan: "50 GB", priceCents: 99, source: "https://support.apple.com/nl-nl/108047", verifiedAt: "2026-05-20" },
  { provider: "iCloud+", category: "OPSLAG", plan: "200 GB", priceCents: 299, source: "https://support.apple.com/nl-nl/108047", verifiedAt: "2026-05-20" },
  { provider: "iCloud+", category: "OPSLAG", plan: "2 TB", priceCents: 999, source: "https://support.apple.com/nl-nl/108047", verifiedAt: "2026-05-20" },
  { provider: "iCloud+", category: "OPSLAG", plan: "6 TB", priceCents: 2999, source: "https://support.apple.com/nl-nl/108047", verifiedAt: "2026-05-20" },
  { provider: "iCloud+", category: "OPSLAG", plan: "12 TB", priceCents: 5999, source: "https://support.apple.com/nl-nl/108047", verifiedAt: "2026-05-20" },
  { provider: "Google One", category: "OPSLAG", plan: "Basic 100 GB", priceCents: 199, source: "https://one.google.com/about/plans", verifiedAt: "2026-05-20" },
  { provider: "Google One", category: "OPSLAG", plan: "AI Plus 2 TB", priceCents: 999, source: "https://one.google.com/about/plans", verifiedAt: "2026-05-20" },
  { provider: "Google One", category: "OPSLAG", plan: "AI Pro 5 TB", priceCents: 2199, source: "https://one.google.com/about/plans", verifiedAt: "2026-05-20" },
  { provider: "Dropbox", category: "OPSLAG", plan: "Plus 2 TB", priceCents: 999, source: "https://www.dropbox.com/plans", verifiedAt: "2026-05-20" },
];

/** Energie — NL medians (cents). */
export const ENERGY_MEDIANS = {
  kwhVastCents: 28,
  kwhVariabelCents: 31,
  vastrechtCents: 600,
  m3VastCents: 132,
  m3VariabelCents: 148,
  defaultJaarverbruikKwh: 2800,
  defaultJaarverbruikM3: 1100,
} as const;

/** Hypotheek — NL market rates per rentevaste-periode (%). */
export const MORTGAGE_RATES: Record<number, number> = {
  10: 3.8,
  15: 3.95,
  20: 4.1,
  30: 4.3,
};

/** Gemiddelde oversluitkosten (cents). */
export const OVERSLUITKOSTEN_CENTS = 300_000; // €3.000

/** Verzekering — NL auto-premie ranges per dekking (cents/maand). */
export const INSURANCE_PREMIUMS = {
  WA: { low: 950, median: 1450, high: 2200 },
  "WA+": { low: 1700, median: 2350, high: 3100 },
  CASCO: { low: 3200, median: 4250, high: 5800 },
  UNKNOWN: { low: 1450, median: 2350, high: 4250 },
} as const;

/** Water — NL all-in median (cents/m³) + verbruik. */
export const WATER_MEDIANS = {
  m3Cents: 140,
  avgPerPersonM3: 45,
  defaultHousehold: 2,
} as const;

/** Days since the prices were last verified. */
export function priceAgeDays(now: Date = new Date()): number {
  const asOf = new Date(PRICES_AS_OF + "T00:00:00Z");
  const ms = now.getTime() - asOf.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/** True when the prices are older than `maxDays` (default 120). */
export function pricesAreStale(maxDays = 120, now: Date = new Date()): boolean {
  return priceAgeDays(now) > maxDays;
}

/** Human-friendly NL date for UI footnotes. */
export function pricesAsOfLabel(): string {
  const d = new Date(PRICES_AS_OF + "T00:00:00Z");
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

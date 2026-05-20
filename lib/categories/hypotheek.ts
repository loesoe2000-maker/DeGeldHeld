/**
 * lib/categories/hypotheek.ts — hypotheek oversluit-rekensom (mei 2026).
 *
 * Markt-rentes (NL, mei 2026):
 *  - 10 jaar vast: 3,80%
 *  - 15 jaar vast: 3,95%
 *  - 20 jaar vast: 4,10%
 *  - 30 jaar vast: 4,30%
 *  - Variabel:     4,90%
 *
 * v18: rates + oversluitkosten live in lib/market-prices.ts.
 */

import { MORTGAGE_RATES, OVERSLUITKOSTEN_CENTS as _OVERSLUITKOSTEN_CENTS } from "@/lib/market-prices";

export type MortgageBill = {
  restschuldCents: number;
  rentePercentage: number;          // huidige rente bv 4.8
  rentevasteJaren: number;          // 10/15/20/30
  looptijdJaren: number;            // resterend
  maandlastCents?: number | null;
};

/** @deprecated import from lib/market-prices.ts — re-exported for compat. */
export const MARKET_RATES: Record<number, number> = MORTGAGE_RATES;

export const OVERSLUITKOSTEN_CENTS = _OVERSLUITKOSTEN_CENTS;

export type MortgageComparison = {
  yourRatePct: number;
  marketRatePct: number;
  rateDeltaPct: number;
  yourYearlyInterestCents: number;
  marketYearlyInterestCents: number;
  yearlySavingsGrossCents: number;     // voor oversluitkosten
  yearlySavingsNetCents: number;       // na amortisering oversluitkosten (5jr)
  oversluitWorthIt: boolean;
  paybackMonths: number;               // hoe lang tot break-even
  notes: string[];
};

function nearestRate(rentevasteJaren: number): number {
  const opts = Object.keys(MARKET_RATES).map(Number).sort((a, b) => a - b);
  let best = opts[0];
  for (const k of opts) {
    if (Math.abs(k - rentevasteJaren) < Math.abs(best - rentevasteJaren)) best = k;
  }
  return MARKET_RATES[best];
}

export function compareMortgage(bill: MortgageBill): MortgageComparison {
  const marketPct = nearestRate(bill.rentevasteJaren);
  const yourPct = bill.rentePercentage;
  const delta = yourPct - marketPct;

  const yourYearlyInterest = Math.round(bill.restschuldCents * (yourPct / 100));
  const marketYearlyInterest = Math.round(bill.restschuldCents * (marketPct / 100));
  const yearlySavingsGross = yourYearlyInterest - marketYearlyInterest;

  // amortise oversluitkosten over 5 jaar
  const amortPerYear = OVERSLUITKOSTEN_CENTS / 5;
  const yearlySavingsNet = Math.round(yearlySavingsGross - amortPerYear);

  const paybackMonths = yearlySavingsGross > 0
    ? Math.ceil((OVERSLUITKOSTEN_CENTS / yearlySavingsGross) * 12)
    : Number.POSITIVE_INFINITY;

  const oversluitWorthIt = yearlySavingsNet > 0 && paybackMonths <= 60;

  const notes: string[] = [];
  if (delta < 0.3) notes.push("Je rente zit dicht bij markt — oversluiten loont niet");
  if (delta > 1.0) notes.push(`Rente ${delta.toFixed(2)}% boven markt — sterke oversluit-case`);
  if (paybackMonths > 60) notes.push("Terugverdientijd >5 jaar; alleen oversluiten als looptijd dat dekt");
  if (paybackMonths <= 24) notes.push("Terugverdientijd <2 jaar — direct oversluiten");

  return {
    yourRatePct: yourPct,
    marketRatePct: marketPct,
    rateDeltaPct: Number(delta.toFixed(3)),
    yourYearlyInterestCents: yourYearlyInterest,
    marketYearlyInterestCents: marketYearlyInterest,
    yearlySavingsGrossCents: yearlySavingsGross,
    yearlySavingsNetCents: yearlySavingsNet,
    oversluitWorthIt,
    paybackMonths: paybackMonths === Number.POSITIVE_INFINITY ? -1 : paybackMonths,
    notes,
  };
}

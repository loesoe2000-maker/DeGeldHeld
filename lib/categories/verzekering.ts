/**
 * lib/categories/verzekering.ts — autoverzekering-vergelijking (mei 2026).
 */

export type InsuranceCoverageType = "WA" | "WA+" | "CASCO" | "UNKNOWN";

export type InsuranceBill = {
  type: InsuranceCoverageType;
  deductibleCents?: number | null;
  premiumMonthlyCents: number;
  voertuig?: string | null;          // bv "Volkswagen Polo 2018"
};

export type InsuranceAlternative = {
  name: string;
  premiumMonthlyCents: number;
  yearlySavingsCents: number;
  notes: string;
};

const MARKET_PREMIUM_BY_TYPE: Record<InsuranceCoverageType, { low: number; median: number; high: number }> = {
  WA:    { low: 950,  median: 1450, high: 2200 },
  "WA+": { low: 1700, median: 2350, high: 3100 },
  CASCO: { low: 3200, median: 4250, high: 5800 },
  UNKNOWN: { low: 1450, median: 2350, high: 4250 },
};

const MARKET_ALTERNATIVES: Record<InsuranceCoverageType, Array<{ name: string; cents: number; notes: string }>> = {
  WA: [
    { name: "Inshared",      cents: 980,  notes: "Online-only, geen tussenpersoon" },
    { name: "Centraal Beheer", cents: 1080, notes: "Geen-gedoe afhandeling, vlot bij claim" },
    { name: "FBTO",           cents: 1150, notes: "Modulair, eigen risico instelbaar" },
  ],
  "WA+": [
    { name: "Inshared",       cents: 1720, notes: "Goedkoopste tussenklasse" },
    { name: "Promovendum",    cents: 1850, notes: "Voor hoger-opgeleiden, korting" },
    { name: "Univé",          cents: 1990, notes: "Schadevrije jaren blijven behouden" },
  ],
  CASCO: [
    { name: "Centraal Beheer", cents: 3290, notes: "Vaste prijs eerste 3 jaar" },
    { name: "ANWB",            cents: 3450, notes: "Pechhulp inbegrepen" },
    { name: "Univé",           cents: 3680, notes: "Klantbeoordeling 8,4" },
  ],
  UNKNOWN: [
    { name: "Inshared", cents: 1450, notes: "Premium 25% onder gemiddelde NL" },
    { name: "Centraal Beheer", cents: 1700, notes: "Goede schadeservice" },
    { name: "FBTO", cents: 1850, notes: "Modulair samen te stellen" },
  ],
};

export type InsuranceComparison = {
  type: InsuranceCoverageType;
  yourPremiumCents: number;
  marketMedianCents: number;
  percentile: "low" | "median" | "high";
  alternatives: InsuranceAlternative[];
  potentialAnnualSavingsCents: number;
  notes: string[];
};

export function compareInsurance(bill: InsuranceBill): InsuranceComparison {
  const ranges = MARKET_PREMIUM_BY_TYPE[bill.type] ?? MARKET_PREMIUM_BY_TYPE.UNKNOWN;

  let percentile: InsuranceComparison["percentile"] = "median";
  if (bill.premiumMonthlyCents < ranges.low * 1.05) percentile = "low";
  else if (bill.premiumMonthlyCents > ranges.high * 0.95) percentile = "high";

  const alts = (MARKET_ALTERNATIVES[bill.type] ?? MARKET_ALTERNATIVES.UNKNOWN)
    .filter((a) => a.cents < bill.premiumMonthlyCents)
    .map((a) => ({
      name: a.name,
      premiumMonthlyCents: a.cents,
      yearlySavingsCents: (bill.premiumMonthlyCents - a.cents) * 12,
      notes: a.notes,
    }))
    .sort((a, b) => a.premiumMonthlyCents - b.premiumMonthlyCents)
    .slice(0, 3);

  const potential = alts[0]?.yearlySavingsCents ?? 0;

  const notes: string[] = [];
  if (bill.type === "UNKNOWN") notes.push("Dekking-type niet gedetecteerd; ranges zijn marktbreed");
  if (percentile === "high") notes.push("Je premie zit in de top-25% — sterke overstap-case");
  if (bill.deductibleCents != null && bill.deductibleCents < 15000) {
    notes.push("Eigen risico onder €150 — kost premie; overweeg verhoging");
  }

  return {
    type: bill.type,
    yourPremiumCents: bill.premiumMonthlyCents,
    marketMedianCents: ranges.median,
    percentile,
    alternatives: alts,
    potentialAnnualSavingsCents: potential,
    notes,
  };
}

/**
 * lib/categories/energie.ts — energie-specifieke vergelijking.
 *
 * Markt-medianen (NL, mei 2026):
 *  - kWh stroom (vast):    €0,28
 *  - kWh stroom (variabel): €0,31
 *  - vastrecht:            €6/mnd
 *  - m³ gas (vast):        €1,32
 *  - m³ gas (variabel):    €1,48
 *
 * Source: ACM tariefoverzicht mei 2026 (placeholder — vervang door
 * scripts/update_prices.ts feed wanneer beschikbaar).
 */

export type EnergyContractType = "vast" | "variabel" | "dynamisch" | "unknown";

export type EnergyBill = {
  kwhPriceCents?: number | null;       // detected kWh-prijs in cents
  m3PriceCents?: number | null;        // detected m³ gas in cents
  vastrechtCents?: number | null;      // vastrecht /mnd in cents
  jaarverbruikKwh?: number | null;
  jaarverbruikM3?: number | null;
  contractType?: EnergyContractType;
};

export const ENERGY_MEDIANS = {
  kwhVastCents: 28,
  kwhVariabelCents: 31,
  vastrechtCents: 600,
  m3VastCents: 132,
  m3VariabelCents: 148,
  defaultJaarverbruikKwh: 2800,
  defaultJaarverbruikM3: 1100,
};

export type EnergyComparison = {
  marketKwhCents: number;
  marketM3Cents: number;
  marketVastrechtCents: number;
  yourKwhCents: number | null;
  yourM3Cents: number | null;
  yourVastrechtCents: number | null;
  annualSavingsCents: number;        // €/jaar bij overstap naar markt-mediaan
  kwhOverpayCents: number;            // verschil in cents per kWh
  notes: string[];
};

export function compareEnergy(bill: EnergyBill): EnergyComparison {
  const isVast = bill.contractType === "vast";
  const marketKwh = isVast ? ENERGY_MEDIANS.kwhVastCents : ENERGY_MEDIANS.kwhVariabelCents;
  const marketM3 = isVast ? ENERGY_MEDIANS.m3VastCents : ENERGY_MEDIANS.m3VariabelCents;
  const marketVast = ENERGY_MEDIANS.vastrechtCents;

  const yourKwh = bill.kwhPriceCents ?? null;
  const yourM3 = bill.m3PriceCents ?? null;
  const yourVast = bill.vastrechtCents ?? null;

  const jaarKwh = bill.jaarverbruikKwh ?? ENERGY_MEDIANS.defaultJaarverbruikKwh;
  const jaarM3 = bill.jaarverbruikM3 ?? ENERGY_MEDIANS.defaultJaarverbruikM3;

  const kwhOverpay = yourKwh != null ? Math.max(0, yourKwh - marketKwh) : 0;
  const m3Overpay = yourM3 != null ? Math.max(0, yourM3 - marketM3) : 0;
  const vastOverpay = yourVast != null ? Math.max(0, yourVast - marketVast) : 0;

  const annualSavings =
    kwhOverpay * jaarKwh +
    m3Overpay * jaarM3 +
    vastOverpay * 12;

  const notes: string[] = [];
  if (bill.contractType === "dynamisch") {
    notes.push(
      "Dynamisch contract — je tarief volgt de groothandel-/spotprijs per uur; vergelijking gebruikt de variabele markt-mediaan als richtlijn.",
    );
  }
  if (yourKwh == null && yourM3 == null) {
    notes.push("Geen tarieven uit de factuur gehaald — besparing geschat op gemiddeld NL-verbruik.");
  } else {
    if (yourKwh == null) notes.push("kWh-prijs niet gedetecteerd — schatting gebaseerd op gemiddeld verbruik");
    if (yourM3 == null) notes.push("m³ gas-prijs niet gedetecteerd");
  }
  if (kwhOverpay > 5) notes.push(`Je betaalt €${(kwhOverpay / 100).toFixed(2)}/kWh boven markt-mediaan`);

  return {
    marketKwhCents: marketKwh,
    marketM3Cents: marketM3,
    marketVastrechtCents: marketVast,
    yourKwhCents: yourKwh,
    yourM3Cents: yourM3,
    yourVastrechtCents: yourVast,
    annualSavingsCents: Math.round(annualSavings),
    kwhOverpayCents: kwhOverpay,
    notes,
  };
}

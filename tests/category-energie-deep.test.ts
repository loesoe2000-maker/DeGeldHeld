import { describe, it, expect } from "vitest";
import { compareEnergy, ENERGY_MEDIANS } from "@/lib/categories/energie";

describe("v17 compareEnergy — deep coverage", () => {
  it("vast contract uses vaste medians", () => {
    const r = compareEnergy({ contractType: "vast", kwhPriceCents: 30, m3PriceCents: 140 });
    expect(r.marketKwhCents).toBe(ENERGY_MEDIANS.kwhVastCents);
    expect(r.marketM3Cents).toBe(ENERGY_MEDIANS.m3VastCents);
  });

  it("variabel contract uses variabele medians", () => {
    const r = compareEnergy({ contractType: "variabel", kwhPriceCents: 35, m3PriceCents: 160 });
    expect(r.marketKwhCents).toBe(ENERGY_MEDIANS.kwhVariabelCents);
    expect(r.marketM3Cents).toBe(ENERGY_MEDIANS.m3VariabelCents);
  });

  it("dynamisch is treated as variabel + adds a spotprijs note", () => {
    const r = compareEnergy({ contractType: "dynamisch", kwhPriceCents: 35 });
    expect(r.marketKwhCents).toBe(ENERGY_MEDIANS.kwhVariabelCents);
    expect(r.notes.join(" ").toLowerCase()).toMatch(/spot|groothandel|dynamisch/);
  });

  it("stroom-only bill (m3 null) → savings only on kWh", () => {
    // kWh €0,05 boven variabele markt (€0,31): your=36, market=31 → 5c/kWh
    const r = compareEnergy({ contractType: "variabel", kwhPriceCents: 36, m3PriceCents: null });
    expect(r.yourM3Cents).toBeNull();
    // savings = 5c × 2800 kWh = 14000c = €140
    expect(r.annualSavingsCents).toBe(5 * ENERGY_MEDIANS.defaultJaarverbruikKwh);
  });

  it("gas-only bill (kwh null) → savings only on m³", () => {
    // m³ €0,12 boven variabele markt (€1,48): your=160, market=148 → 12c/m³
    const r = compareEnergy({ contractType: "variabel", kwhPriceCents: null, m3PriceCents: 160 });
    expect(r.yourKwhCents).toBeNull();
    // savings = 12c × 1100 m³ = 13200c = €132
    expect(r.annualSavingsCents).toBe(12 * ENERGY_MEDIANS.defaultJaarverbruikM3);
  });

  it("both null → estimate note, savings 0 (no overpay detectable)", () => {
    const r = compareEnergy({ contractType: "unknown", kwhPriceCents: null, m3PriceCents: null });
    expect(r.annualSavingsCents).toBe(0);
    expect(r.notes.join(" ").toLowerCase()).toMatch(/geen tarieven|geschat/);
  });

  it("cheaper-than-market (negative overpay) → savings 0, never negative", () => {
    // your kWh €0,20 < market variabel €0,31 → no overpay
    const r = compareEnergy({ contractType: "variabel", kwhPriceCents: 20, m3PriceCents: 100 });
    expect(r.annualSavingsCents).toBe(0);
    expect(r.kwhOverpayCents).toBe(0);
  });

  it("hand-calc: kWh €0,05 boven markt × 2800 = €140/jaar", () => {
    const r = compareEnergy({
      contractType: "variabel",
      kwhPriceCents: ENERGY_MEDIANS.kwhVariabelCents + 5,
      m3PriceCents: ENERGY_MEDIANS.m3VariabelCents, // exactly market → 0 gas overpay
    });
    expect(r.annualSavingsCents).toBe(5 * ENERGY_MEDIANS.defaultJaarverbruikKwh); // 14000c
  });

  it("vastrecht overpay counts × 12 months", () => {
    const r = compareEnergy({
      contractType: "vast",
      kwhPriceCents: ENERGY_MEDIANS.kwhVastCents, // 0 overpay
      m3PriceCents: ENERGY_MEDIANS.m3VastCents, // 0 overpay
      vastrechtCents: ENERGY_MEDIANS.vastrechtCents + 100, // €1/mnd over
    });
    expect(r.annualSavingsCents).toBe(100 * 12); // €12/jaar
  });

  it("custom jaarverbruik scales savings", () => {
    const r = compareEnergy({
      contractType: "variabel",
      kwhPriceCents: ENERGY_MEDIANS.kwhVariabelCents + 10,
      m3PriceCents: ENERGY_MEDIANS.m3VariabelCents,
      jaarverbruikKwh: 5000,
    });
    expect(r.annualSavingsCents).toBe(10 * 5000); // 50000c = €500
  });
});

import { describe, it, expect } from "vitest";
import { compareEnergy, ENERGY_MEDIANS } from "../lib/categories/energie";

describe("categories/energie/compareEnergy", () => {
  it("flags overpay when kWh-prijs > markt", () => {
    const r = compareEnergy({
      kwhPriceCents: 35,
      m3PriceCents: 150,
      vastrechtCents: 700,
      jaarverbruikKwh: 3000,
      jaarverbruikM3: 1200,
      contractType: "variabel",
    });
    expect(r.kwhOverpayCents).toBe(35 - ENERGY_MEDIANS.kwhVariabelCents);
    expect(r.annualSavingsCents).toBeGreaterThan(0);
  });

  it("returns zero savings when on or under market", () => {
    const r = compareEnergy({
      kwhPriceCents: 25,
      m3PriceCents: 130,
      vastrechtCents: 500,
      contractType: "vast",
    });
    expect(r.annualSavingsCents).toBe(0);
  });

  it("falls back to default verbruik when not provided", () => {
    const r = compareEnergy({
      kwhPriceCents: 40,
      contractType: "variabel",
    });
    expect(r.annualSavingsCents).toBeGreaterThan(0);
    // m³-prijs niet gedetecteerd → note aanwezig
    expect(r.notes.some((n) => /m³|gedetecteerd/.test(n))).toBe(true);
  });

  it("notes when kWh not detected", () => {
    const r = compareEnergy({ contractType: "variabel" });
    expect(r.notes.length).toBeGreaterThan(0);
    expect(r.annualSavingsCents).toBe(0);
  });

  it("uses 'vast' rates when contractType=vast", () => {
    const r = compareEnergy({ contractType: "vast" });
    expect(r.marketKwhCents).toBe(ENERGY_MEDIANS.kwhVastCents);
    expect(r.marketM3Cents).toBe(ENERGY_MEDIANS.m3VastCents);
  });
});

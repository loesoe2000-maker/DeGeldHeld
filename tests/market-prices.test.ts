import { describe, it, expect } from "vitest";
import {
  PRICES_AS_OF,
  ENERGY_MEDIANS,
  MORTGAGE_RATES,
  INSURANCE_PREMIUMS,
  WATER_MEDIANS,
  priceAgeDays,
  pricesAreStale,
  pricesAsOfLabel,
} from "@/lib/market-prices";
import { ENERGY_MEDIANS as ENERGIE_RE } from "@/lib/categories/energie";
import { MARKET_RATES, OVERSLUITKOSTEN_CENTS } from "@/lib/categories/hypotheek";
import { WATER_MEDIANS as WATER_RE } from "@/lib/categories/water";

describe("v18 market-prices — single dated source", () => {
  it("PRICES_AS_OF is an ISO date", () => {
    expect(PRICES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("priceAgeDays computes days since PRICES_AS_OF", () => {
    const asOf = new Date(PRICES_AS_OF + "T00:00:00Z");
    const plus10 = new Date(asOf.getTime() + 10 * 24 * 60 * 60 * 1000);
    expect(priceAgeDays(plus10)).toBe(10);
  });

  it("pricesAreStale flips at the maxDays boundary", () => {
    const asOf = new Date(PRICES_AS_OF + "T00:00:00Z");
    const day119 = new Date(asOf.getTime() + 119 * 24 * 60 * 60 * 1000);
    const day121 = new Date(asOf.getTime() + 121 * 24 * 60 * 60 * 1000);
    expect(pricesAreStale(120, day119)).toBe(false);
    expect(pricesAreStale(120, day121)).toBe(true);
  });

  it("pricesAsOfLabel renders a Dutch date string", () => {
    expect(pricesAsOfLabel()).toMatch(/\d{4}/);
  });
});

describe("v18 refactor — category modules return the SAME numbers (no behaviour change)", () => {
  it("energie medians come from the single source", () => {
    expect(ENERGIE_RE).toBe(ENERGY_MEDIANS);
    expect(ENERGIE_RE.kwhVariabelCents).toBe(31);
  });

  it("hypotheek rates come from the single source", () => {
    expect(MARKET_RATES).toBe(MORTGAGE_RATES);
    expect(MARKET_RATES[10]).toBe(3.8);
    expect(OVERSLUITKOSTEN_CENTS).toBe(300_000);
  });

  it("water medians come from the single source", () => {
    expect(WATER_RE).toBe(WATER_MEDIANS);
    expect(WATER_RE.m3Cents).toBe(140);
  });

  it("insurance premiums exist for all coverage types", () => {
    for (const t of ["WA", "WA+", "CASCO", "UNKNOWN"] as const) {
      expect(INSURANCE_PREMIUMS[t].median).toBeGreaterThan(0);
    }
  });
});

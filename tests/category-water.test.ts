import { describe, it, expect } from "vitest";
import { compareWater, WATER_MEDIANS } from "@/lib/categories/water";

describe("v17 compareWater — monopoly-aware", () => {
  it("always flags isMonopoly + states overstappen kan niet", () => {
    const r = compareWater({});
    expect(r.isMonopoly).toBe(true);
    const joined = r.notes.join(" ").toLowerCase();
    expect(joined).toContain("monopolie");
    // Must explicitly say switching is impossible — never frame
    // switching as the savings lever.
    expect(joined).toMatch(/overstappen kan niet/);
    expect(joined).not.toMatch(/stap over en bespaar/);
  });

  it("always returns reduction tips (never empty)", () => {
    const r = compareWater({});
    expect(r.reductionTips.length).toBeGreaterThanOrEqual(3);
    expect(r.reductionTips.join(" ").toLowerCase()).toMatch(/douche|perlator|lek/);
  });

  it("estimates household usage from size × 45 m³ when verbruik unknown", () => {
    const r = compareWater({ householdSize: 3 });
    expect(r.avgHouseholdM3).toBe(3 * WATER_MEDIANS.avgPerPersonM3);
  });

  it("defaults to 2-person household when size unknown", () => {
    const r = compareWater({});
    expect(r.avgHouseholdM3).toBe(WATER_MEDIANS.defaultHousehold * WATER_MEDIANS.avgPerPersonM3);
  });

  it("uses detected m³ rate when available, market median otherwise", () => {
    const withRate = compareWater({ m3PriceCents: 130 });
    expect(withRate.yourM3Cents).toBe(130);
    const withoutRate = compareWater({});
    expect(withoutRate.yourM3Cents).toBeNull();
    expect(withoutRate.marketM3Cents).toBe(WATER_MEDIANS.m3Cents);
  });

  it("estimated annual cost = verbruik × price + vastrecht", () => {
    const r = compareWater({
      m3PriceCents: 140,
      jaarverbruikM3: 100,
      vastrechtCents: 5000,
    });
    // 100 × 140 + 5000 = 19000
    expect(r.estimatedAnnualCents).toBe(19000);
  });

  it("flags high usage when verbruik >125% of household average", () => {
    const r = compareWater({ householdSize: 2, jaarverbruikM3: 150 });
    // avg = 90, 150 > 112.5 → lekkage-note
    expect(r.notes.join(" ").toLowerCase()).toMatch(/lekkage|meer dan gemiddeld/);
  });

  it("notes when m³ rate not detected", () => {
    const r = compareWater({});
    expect(r.notes.join(" ").toLowerCase()).toMatch(/niet uit je factuur|schatting/);
  });

  it("never produces a negative or NaN annual cost", () => {
    const r = compareWater({ m3PriceCents: null, jaarverbruikM3: null, vastrechtCents: null });
    expect(Number.isFinite(r.estimatedAnnualCents)).toBe(true);
    expect(r.estimatedAnnualCents).toBeGreaterThan(0);
  });
});

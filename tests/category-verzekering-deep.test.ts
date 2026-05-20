import { describe, it, expect } from "vitest";
import { compareInsurance } from "@/lib/categories/verzekering";

describe("v17 compareInsurance — deep coverage", () => {
  it("WA / WA+ / CASCO / UNKNOWN each pick their own market range", () => {
    const wa = compareInsurance({ type: "WA", premiumMonthlyCents: 1450 });
    const waPlus = compareInsurance({ type: "WA+", premiumMonthlyCents: 2350 });
    const casco = compareInsurance({ type: "CASCO", premiumMonthlyCents: 4250 });
    expect(wa.marketMedianCents).toBe(1450);
    expect(waPlus.marketMedianCents).toBe(2350);
    expect(casco.marketMedianCents).toBe(4250);
  });

  it("premie in top-25% → percentile=high + sterke overstap note", () => {
    const r = compareInsurance({ type: "CASCO", premiumMonthlyCents: 5700 });
    expect(r.percentile).toBe("high");
    expect(r.notes.join(" ").toLowerCase()).toMatch(/top-25|sterke overstap/);
  });

  it("premie onder markt → percentile=low, no pricier alternatives", () => {
    const r = compareInsurance({ type: "WA", premiumMonthlyCents: 970 });
    expect(r.percentile).toBe("low");
    // every alternative must be cheaper than your premium
    for (const a of r.alternatives) {
      expect(a.premiumMonthlyCents).toBeLessThan(970);
    }
  });

  it("alternatives are sorted cheapest→priciest, max 3", () => {
    const r = compareInsurance({ type: "WA+", premiumMonthlyCents: 3000 });
    expect(r.alternatives.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < r.alternatives.length; i++) {
      expect(r.alternatives[i].premiumMonthlyCents).toBeGreaterThanOrEqual(
        r.alternatives[i - 1].premiumMonthlyCents,
      );
    }
  });

  it("eigen risico <€150 → note over verhogen", () => {
    const r = compareInsurance({
      type: "CASCO",
      premiumMonthlyCents: 4250,
      deductibleCents: 10000, // €100
    });
    expect(r.notes.join(" ").toLowerCase()).toMatch(/eigen risico|verhoging/);
  });

  it("eigen risico ≥€150 → no verhogen note", () => {
    const r = compareInsurance({
      type: "CASCO",
      premiumMonthlyCents: 4250,
      deductibleCents: 30000, // €300
    });
    expect(r.notes.join(" ").toLowerCase()).not.toMatch(/eigen risico onder/);
  });

  it("potentialAnnualSavings = (premie − goedkoopste alt) × 12", () => {
    const r = compareInsurance({ type: "WA", premiumMonthlyCents: 1500 });
    // cheapest WA alt = Inshared @ 980 → (1500-980)*12 = 6240
    expect(r.potentialAnnualSavingsCents).toBe((1500 - 980) * 12);
  });

  it("UNKNOWN coverage → marktbrede note + UNKNOWN ranges", () => {
    const r = compareInsurance({ type: "UNKNOWN", premiumMonthlyCents: 2350 });
    expect(r.notes.join(" ").toLowerCase()).toMatch(/niet gedetecteerd|marktbreed/);
    expect(r.marketMedianCents).toBe(2350);
  });

  it("very cheap premium → no alternatives + 0 potential savings", () => {
    const r = compareInsurance({ type: "WA", premiumMonthlyCents: 500 });
    expect(r.alternatives.length).toBe(0);
    expect(r.potentialAnnualSavingsCents).toBe(0);
  });
});

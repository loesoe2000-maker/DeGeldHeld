import { describe, it, expect } from "vitest";
import { compareInsurance } from "../lib/categories/verzekering";

describe("categories/verzekering/compareInsurance", () => {
  it("flags high percentile when premium above range", () => {
    const r = compareInsurance({ type: "WA", premiumMonthlyCents: 2300 });
    expect(r.percentile).toBe("high");
    expect(r.alternatives.length).toBeGreaterThan(0);
    expect(r.alternatives[0].premiumMonthlyCents).toBeLessThan(2300);
  });

  it("returns 3 alternatives max", () => {
    const r = compareInsurance({ type: "WA", premiumMonthlyCents: 3000 });
    expect(r.alternatives.length).toBeLessThanOrEqual(3);
  });

  it("low percentile when premium near range.low", () => {
    const r = compareInsurance({ type: "WA", premiumMonthlyCents: 970 });
    expect(r.percentile).toBe("low");
  });

  it("annual savings computed correctly", () => {
    const r = compareInsurance({ type: "WA", premiumMonthlyCents: 2000 });
    if (r.alternatives.length > 0) {
      const a = r.alternatives[0];
      expect(a.yearlySavingsCents).toBe((2000 - a.premiumMonthlyCents) * 12);
    }
  });

  it("returns notes for high deductible warning", () => {
    const r = compareInsurance({ type: "WA+", premiumMonthlyCents: 2500, deductibleCents: 10000 });
    expect(r.notes.some((n) => n.toLowerCase().includes("eigen risico"))).toBe(true);
  });

  it("CASCO uses CASCO alternatives", () => {
    const r = compareInsurance({ type: "CASCO", premiumMonthlyCents: 5000 });
    expect(r.alternatives[0]?.premiumMonthlyCents).toBeGreaterThan(3000);
  });

  it("UNKNOWN type still returns sensible output", () => {
    const r = compareInsurance({ type: "UNKNOWN", premiumMonthlyCents: 3000 });
    expect(r.alternatives.length).toBeGreaterThan(0);
    expect(r.notes.length).toBeGreaterThan(0);
  });
});

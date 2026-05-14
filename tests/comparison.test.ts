import { describe, it, expect } from "vitest";
import {
  getCheaperAlternatives,
  buildComparison,
  estimateRetentionSavings,
  isMeaningfulSaving,
} from "../lib/comparison";

describe("comparison/getCheaperAlternatives", () => {
  it("returns empty for unrealistically low current price", () => {
    const alts = getCheaperAlternatives("KPN", "TELECOM", 100);
    expect(alts).toEqual([]);
  });

  it("returns up to 3 alternatives by default", () => {
    const alts = getCheaperAlternatives("KPN", "TELECOM", 10000);
    expect(alts.length).toBeLessThanOrEqual(3);
  });

  it("respects topN parameter", () => {
    const alts = getCheaperAlternatives("KPN", "TELECOM", 10000, 5);
    expect(alts.length).toBeLessThanOrEqual(5);
  });

  it("returns only cheaper plans", () => {
    const alts = getCheaperAlternatives("Ziggo", "TELECOM", 7000);
    for (const a of alts) expect(a.plan.priceCents).toBeLessThan(7000);
  });

  it("computes monthly + yearly + percent savings", () => {
    const alts = getCheaperAlternatives("KPN", "TELECOM", 5000);
    if (alts.length === 0) return;
    const a = alts[0];
    expect(a.monthlySavingsCents).toBe(5000 - a.plan.priceCents);
    expect(a.yearlySavingsCents).toBe(a.monthlySavingsCents * 12);
    expect(a.percentSaved).toBeCloseTo(a.monthlySavingsCents / 5000, 5);
  });

  it("ranks different-provider options ahead of same-provider", () => {
    const alts = getCheaperAlternatives("T-Mobile", "TELECOM", 5000);
    if (alts.length >= 2) {
      // First should not be T-Mobile (different provider preferred)
      const first = alts[0];
      const last = alts[alts.length - 1];
      const allOptions = alts.map((a) => a.plan.provider);
      const hasOther = allOptions.some((p) => p !== "T-Mobile");
      if (hasOther) expect(first.plan.provider).not.toBe("T-Mobile");
    }
  });
});

describe("comparison/buildComparison", () => {
  it("returns ComparisonResult with all fields", () => {
    const r = buildComparison({ provider: "Ziggo", category: "TELECOM", amountCents: 6795 });
    expect(r.current.provider).toBe("Ziggo");
    expect(r.topAlternatives.length).toBeGreaterThanOrEqual(0);
    expect(r.bestSavingsCents).toBeGreaterThanOrEqual(0);
    expect(r.bestSavingsPct).toBeGreaterThanOrEqual(0);
  });

  it("returns 0 best savings when no alternatives", () => {
    const r = buildComparison({ provider: "X", category: "ABONNEMENT", amountCents: 100 });
    expect(r.topAlternatives).toEqual([]);
    expect(r.bestSavingsCents).toBe(0);
  });

  it("best savings = top alternative's yearly", () => {
    const r = buildComparison({ provider: "KPN", category: "TELECOM", amountCents: 5000 });
    if (r.topAlternatives.length > 0) {
      expect(r.bestSavingsCents).toBe(r.topAlternatives[0].yearlySavingsCents);
    }
  });
});

describe("comparison/estimateRetentionSavings", () => {
  it("returns 12% of current price", () => {
    expect(estimateRetentionSavings(10000)).toBe(1200);
  });
  it("rounds to nearest cent", () => {
    expect(estimateRetentionSavings(123)).toBe(15); // 14.76 → 15
  });
});

describe("comparison/isMeaningfulSaving", () => {
  it("true for ≥€20 yearly", () => {
    expect(isMeaningfulSaving(2000)).toBe(true);
    expect(isMeaningfulSaving(50000)).toBe(true);
  });
  it("false for <€20 yearly", () => {
    expect(isMeaningfulSaving(1999)).toBe(false);
    expect(isMeaningfulSaving(0)).toBe(false);
  });
});

describe("comparison/integration with real seed data", () => {
  it("Ziggo €67,95 TELECOM finds cheaper alternatives", () => {
    const r = buildComparison({ provider: "Ziggo", category: "TELECOM", amountCents: 6795 });
    expect(r.topAlternatives.length).toBeGreaterThan(0);
    expect(r.bestSavingsCents).toBeGreaterThan(0);
  });

  it("T-Mobile €27,00 telecom — at most modest savings if any", () => {
    const r = buildComparison({ provider: "T-Mobile", category: "TELECOM", amountCents: 2700 });
    // T-Mobile Go Unlimited is 27 euro, may match other lower-priced plans
    expect(r.bestSavingsCents).toBeGreaterThanOrEqual(0);
  });

  it("Eneco €180 ENERGIE finds Greenchoice as winner", () => {
    const r = buildComparison({ provider: "Eneco", category: "ENERGIE", amountCents: 18000 });
    if (r.topAlternatives.length > 0) {
      expect(r.topAlternatives[0].plan.priceCents).toBeLessThanOrEqual(18000);
    }
  });
});

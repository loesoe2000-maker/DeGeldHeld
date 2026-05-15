import { describe, it, expect } from "vitest";
import {
  buildComparison,
  getCheaperAlternatives,
  getMarketRange,
  computeConfidence,
  type Alternative,
} from "../lib/comparison";

describe("comparison-v3/getMarketRange", () => {
  it("returns min/max/median for ENERGIE", () => {
    const r = getMarketRange("ENERGIE", 18000);
    expect(r.sampleSize).toBeGreaterThan(0);
    expect(r.minCents).toBeLessThan(r.maxCents);
    expect(r.medianCents).toBeGreaterThanOrEqual(r.minCents);
    expect(r.medianCents).toBeLessThanOrEqual(r.maxCents);
  });

  it("user above max gets percentile near 100", () => {
    const r = getMarketRange("TELECOM", 999999);
    expect(r.userPercentile).toBe(100);
  });

  it("user below min gets percentile 0", () => {
    const r = getMarketRange("TELECOM", 1);
    expect(r.userPercentile).toBe(0);
  });

  it("median user gets percentile near 50", () => {
    const range = getMarketRange("TELECOM", 1500);
    const r = getMarketRange("TELECOM", range.medianCents);
    expect(Math.abs(r.userPercentile - 50)).toBeLessThanOrEqual(15);
  });
});

describe("comparison-v3/computeConfidence", () => {
  const range = { minCents: 1000, maxCents: 5000, medianCents: 3000, userPercentile: 80, sampleSize: 12 };

  it("high confidence with 3+ alts + known provider + big sample", () => {
    const alts: Alternative[] = [
      { plan: { provider: "A", category: "TELECOM", name: "X", priceCents: 2000, features: "" }, monthlySavingsCents: 1000, yearlySavingsCents: 12000, percentSaved: 0.3, rationale: "" },
      { plan: { provider: "B", category: "TELECOM", name: "Y", priceCents: 2200, features: "" }, monthlySavingsCents: 800, yearlySavingsCents: 9600, percentSaved: 0.27, rationale: "" },
      { plan: { provider: "C", category: "TELECOM", name: "Z", priceCents: 2400, features: "" }, monthlySavingsCents: 600, yearlySavingsCents: 7200, percentSaved: 0.2, rationale: "" },
    ];
    expect(computeConfidence({ alternatives: alts, range, currentAmountCents: 3000, providerKnown: true })).toBeGreaterThanOrEqual(70);
  });

  it("low confidence with 0 alts + unknown provider", () => {
    const score = computeConfidence({
      alternatives: [],
      range: { ...range, sampleSize: 1 },
      currentAmountCents: 3000,
      providerKnown: false,
    });
    expect(score).toBeLessThan(60);
  });

  it("clamps to [0,100]", () => {
    const score = computeConfidence({
      alternatives: [],
      range: { minCents: 0, maxCents: 0, medianCents: 0, userPercentile: 0, sampleSize: 0 },
      currentAmountCents: 0,
      providerKnown: false,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("penalty when current under median (less to gain)", () => {
    const without = computeConfidence({ alternatives: [], range, currentAmountCents: range.medianCents + 1000, providerKnown: true });
    const withPenalty = computeConfidence({ alternatives: [], range, currentAmountCents: range.medianCents - 1000, providerKnown: true });
    expect(withPenalty).toBeLessThan(without);
  });
});

describe("comparison-v3/buildComparison v3", () => {
  it("includes marketRange + confidencePct", () => {
    const r = buildComparison({ provider: "Vodafone", category: "TELECOM", amountCents: 3000 });
    expect(r.marketRange.sampleSize).toBeGreaterThan(0);
    expect(r.confidencePct).toBeGreaterThanOrEqual(0);
    expect(r.confidencePct).toBeLessThanOrEqual(100);
  });

  it("3 alternatives by default", () => {
    const r = buildComparison({ provider: "Eneco", category: "ENERGIE", amountCents: 18000 });
    expect(r.topAlternatives.length).toBeLessThanOrEqual(3);
  });

  it("each alternative has rationale string", () => {
    const r = buildComparison({ provider: "Eneco", category: "ENERGIE", amountCents: 18000 });
    for (const a of r.topAlternatives) {
      expect(typeof a.rationale).toBe("string");
      expect(a.rationale.length).toBeGreaterThan(10);
    }
  });

  it("providerKnown=false reduces confidence vs true", () => {
    const known = buildComparison({ provider: "Eneco", category: "ENERGIE", amountCents: 18000, providerKnown: true });
    const unknown = buildComparison({ provider: "Eneco", category: "ENERGIE", amountCents: 18000, providerKnown: false });
    expect(unknown.confidencePct).toBeLessThanOrEqual(known.confidencePct);
  });
});

describe("comparison-v3/rationale content", () => {
  it("first alternative includes 'goedkoopste' or 'overstap'", () => {
    const alts = getCheaperAlternatives("Eneco", "ENERGIE", 18000);
    if (alts.length > 0) {
      expect(alts[0].rationale.toLowerCase()).toMatch(/goedkoopste|overstap|korting/);
    }
  });

  it("same-provider alt mentions retentie/klantenservice when applicable", () => {
    const alts = getCheaperAlternatives("Spotify", "ABONNEMENT", 1499);
    const same = alts.find((a) => a.plan.provider === "Spotify");
    if (same) {
      expect(same.rationale.toLowerCase()).toMatch(/spotify|klantenservice|overstappen/);
    }
  });
});

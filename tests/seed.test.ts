import { describe, it, expect } from "vitest";
import { MARKET_PLANS, uniqueProviders, plansForCategory } from "../lib/market_db";
import { NL_PROVIDERS, listProvidersByCategory } from "../lib/providers";
import { buildComparison, getCheaperAlternatives } from "../lib/comparison";

describe("seed/market_db coverage", () => {
  it("seed covers >=14 unique NL providers", () => {
    expect(uniqueProviders().length).toBeGreaterThanOrEqual(14);
  });

  it("each MARKET_PLAN provider is in NL_PROVIDERS registry", () => {
    const known = new Set(NL_PROVIDERS.map((p) => p.canonical));
    for (const plan of MARKET_PLANS) {
      expect(known.has(plan.provider)).toBe(true);
    }
  });

  it("4 main categories represented in plans", () => {
    const cats = new Set(MARKET_PLANS.map((p) => p.category));
    expect(cats.has("TELECOM")).toBe(true);
    expect(cats.has("ENERGIE")).toBe(true);
    expect(cats.has("VERZEKERING")).toBe(true);
    expect(cats.has("HYPOTHEEK")).toBe(true);
  });

  it("each category has >=3 providers (after v2 additions)", () => {
    expect(listProvidersByCategory("TELECOM").length).toBeGreaterThanOrEqual(3);
    expect(listProvidersByCategory("ENERGIE").length).toBeGreaterThanOrEqual(3);
    expect(listProvidersByCategory("VERZEKERING").length).toBeGreaterThanOrEqual(3);
    expect(listProvidersByCategory("HYPOTHEEK").length).toBeGreaterThanOrEqual(3);
  });

  it("price ranges are realistic (telecom: 5-100 eur)", () => {
    for (const p of plansForCategory("TELECOM")) {
      expect(p.priceCents).toBeGreaterThanOrEqual(500);
      expect(p.priceCents).toBeLessThanOrEqual(10000);
    }
  });

  it("price ranges are realistic (energie: 100-300 eur)", () => {
    for (const p of plansForCategory("ENERGIE")) {
      expect(p.priceCents).toBeGreaterThanOrEqual(10000);
      expect(p.priceCents).toBeLessThanOrEqual(30000);
    }
  });
});

describe("seed/getCheaperAlternatives integration", () => {
  it("Ziggo €67,95 produces top 3 alternatives", () => {
    const alts = getCheaperAlternatives("Ziggo", "TELECOM", 6795, 3);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.length).toBeLessThanOrEqual(3);
    for (const a of alts) {
      expect(a.plan.priceCents).toBeLessThan(6795);
    }
  });

  it("Eneco €180 ENERGIE finds Vandebron / Budget Energie as candidates", () => {
    const alts = getCheaperAlternatives("Eneco", "ENERGIE", 18000, 5);
    expect(alts.length).toBeGreaterThan(0);
    const names = alts.map((a) => a.plan.provider);
    // At least one of the v2-added cheap providers should appear
    const hasCheap = names.some((n) => n === "Vandebron" || n === "Budget Energie" || n === "Greenchoice");
    expect(hasCheap).toBe(true);
  });

  it("buildComparison returns yearly savings >0 when alternatives exist", () => {
    const r = buildComparison({ provider: "Ziggo", category: "TELECOM", amountCents: 6795 });
    if (r.topAlternatives.length > 0) {
      expect(r.bestSavingsCents).toBeGreaterThan(0);
    }
  });

  it("topN parameter respected", () => {
    expect(getCheaperAlternatives("Ziggo", "TELECOM", 7000, 1).length).toBeLessThanOrEqual(1);
    expect(getCheaperAlternatives("Ziggo", "TELECOM", 7000, 5).length).toBeLessThanOrEqual(5);
  });

  it("returns empty array when current price is impossibly low", () => {
    expect(getCheaperAlternatives("X", "TELECOM", 1, 3)).toEqual([]);
  });
});

describe("seed/idempotency markers", () => {
  it("uniqueProviders returns deduplicated list", () => {
    const u = uniqueProviders();
    expect(new Set(u).size).toBe(u.length);
  });

  it("plans-per-provider count is consistent", () => {
    for (const provider of uniqueProviders()) {
      const plans = MARKET_PLANS.filter((p) => p.provider === provider);
      expect(plans.length).toBeGreaterThan(0);
    }
  });
});

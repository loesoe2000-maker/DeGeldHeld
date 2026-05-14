import { describe, it, expect } from "vitest";
import {
  MARKET_PLANS,
  plansForCategory,
  plansForProvider,
  cheapestPlan,
  uniqueProviders,
} from "../lib/market_db";

describe("market_db/registry", () => {
  it("contains 24+ plans", () => {
    expect(MARKET_PLANS.length).toBeGreaterThanOrEqual(24);
  });

  it("covers 14+ unique providers", () => {
    expect(uniqueProviders().length).toBeGreaterThanOrEqual(14);
  });

  it("all priceCents are positive integers", () => {
    for (const p of MARKET_PLANS) {
      expect(Number.isInteger(p.priceCents)).toBe(true);
      expect(p.priceCents).toBeGreaterThan(0);
    }
  });

  it("each plan has features text", () => {
    for (const p of MARKET_PLANS) expect(p.features.length).toBeGreaterThan(0);
  });

  it("covers all 4 main categories", () => {
    const cats = new Set(MARKET_PLANS.map((p) => p.category));
    expect(cats.has("TELECOM")).toBe(true);
    expect(cats.has("ENERGIE")).toBe(true);
    expect(cats.has("VERZEKERING")).toBe(true);
    expect(cats.has("HYPOTHEEK")).toBe(true);
  });
});

describe("market_db/plansForCategory", () => {
  it("returns telecom plans only", () => {
    const t = plansForCategory("TELECOM");
    expect(t.length).toBeGreaterThan(0);
    for (const p of t) expect(p.category).toBe("TELECOM");
  });

  it("returns energie plans only", () => {
    const e = plansForCategory("ENERGIE");
    for (const p of e) expect(p.category).toBe("ENERGIE");
  });
});

describe("market_db/plansForProvider", () => {
  it("returns matching provider plans", () => {
    const ts = plansForProvider("T-Mobile");
    expect(ts.length).toBeGreaterThan(0);
    for (const p of ts) expect(p.provider).toBe("T-Mobile");
  });

  it("is case-insensitive", () => {
    expect(plansForProvider("t-mobile").length).toBeGreaterThan(0);
  });

  it("returns empty for unknown provider", () => {
    expect(plansForProvider("nonsense")).toEqual([]);
  });
});

describe("market_db/cheapestPlan", () => {
  it("returns lowest-priced plan in category", () => {
    const cheapest = cheapestPlan("TELECOM");
    expect(cheapest).not.toBeNull();
    const allTelecom = plansForCategory("TELECOM");
    const minPrice = Math.min(...allTelecom.map((p) => p.priceCents));
    expect(cheapest!.priceCents).toBe(minPrice);
  });

  it("returns null when no plans", () => {
    expect(cheapestPlan("ABONNEMENT")).toBeNull();
  });
});

describe("market_db/uniqueProviders", () => {
  it("contains no duplicates", () => {
    const u = uniqueProviders();
    expect(new Set(u).size).toBe(u.length);
  });
});

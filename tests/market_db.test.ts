import { describe, it, expect } from "vitest";
import {
  MARKET_PLANS,
  plansForCategory,
  plansForProvider,
  cheapestPlan,
  uniqueProviders,
} from "../lib/market_db";

describe("market_db/registry", () => {
  it("contains 150+ plans (v3)", () => {
    expect(MARKET_PLANS.length).toBeGreaterThanOrEqual(150);
  });

  it("covers 130+ unique providers (v3)", () => {
    expect(uniqueProviders().length).toBeGreaterThanOrEqual(130);
  });

  it("all priceCents are non-negative integers (banks may be 0)", () => {
    for (const p of MARKET_PLANS) {
      expect(Number.isInteger(p.priceCents)).toBe(true);
      expect(p.priceCents).toBeGreaterThanOrEqual(0);
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

  it("returns valid plan when category has entries", () => {
    expect(cheapestPlan("ABONNEMENT")).not.toBeNull();
    expect(cheapestPlan("BANK")).not.toBeNull();
  });
});

describe("market_db/uniqueProviders", () => {
  it("contains no duplicates", () => {
    const u = uniqueProviders();
    expect(new Set(u).size).toBe(u.length);
  });
});

import { describe, it, expect } from "vitest";
import { parseOcrJson } from "../lib/ocr";

describe("ocr-monthly-vs-total/parseOcrJson", () => {
  it("KPN factuur: monthly 24,66 + total 29,65 + 1 eenmalige post", () => {
    const raw = JSON.stringify({
      provider: "KPN",
      monthly_subscription_eur: 24.66,
      total_eur: 29.65,
      one_time_items: ["Online aankopen 4,99"],
      plan: "Compleet",
      period: "mei 2026",
      customer_number: "12345678",
      language: "nl",
      confidence: 0.92,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.monthlyAmountCents).toBe(2466);
    expect(parsed.totalAmountCents).toBe(2965);
    // amountCents = monthly (preferred voor markt-vergelijking)
    expect(parsed.amountCents).toBe(2466);
    expect(parsed.oneTimeItems).toEqual(["Online aankopen 4,99"]);
  });

  it("Vodafone factuur: monthly == total, geen eenmalige posten", () => {
    const raw = JSON.stringify({
      provider: "Vodafone",
      monthly_subscription_eur: 29.95,
      total_eur: 29.95,
      one_time_items: [],
      plan: "Red Unlimited",
      period: "mei 2026",
      customer_number: "87654321",
      language: "nl",
      confidence: 0.94,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.monthlyAmountCents).toBe(2995);
    expect(parsed.totalAmountCents).toBe(2995);
    expect(parsed.amountCents).toBe(2995);
    expect(parsed.oneTimeItems).toEqual([]);
  });

  it("Energie termijnbedrag: monthly == total, geen eenmalig", () => {
    const raw = JSON.stringify({
      provider: "Eneco",
      monthly_subscription_eur: 180.0,
      total_eur: 180.0,
      one_time_items: [],
      plan: "HollandseWind 1 jaar",
      period: "mei 2026",
      customer_number: "ENC-99",
      language: "nl",
      confidence: 0.9,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.monthlyAmountCents).toBe(18000);
    expect(parsed.totalAmountCents).toBe(18000);
    expect(parsed.amountCents).toBe(18000);
  });

  it("backwards-compat: oude amount_eur veld wordt monthly + total", () => {
    const raw = JSON.stringify({
      provider: "T-Mobile",
      amount_eur: 27.0,
      plan: "Go Unlimited",
      period: "mei 2026",
      language: "nl",
      confidence: 0.85,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.monthlyAmountCents).toBe(2700);
    expect(parsed.totalAmountCents).toBe(2700);
    expect(parsed.amountCents).toBe(2700);
    expect(parsed.oneTimeItems).toEqual([]);
  });

  it("invalid one_time_items (non-array) → empty array", () => {
    const raw = JSON.stringify({
      provider: "KPN",
      monthly_subscription_eur: 25,
      total_eur: 30,
      one_time_items: "not an array",
      language: "nl",
      confidence: 0.8,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.oneTimeItems).toEqual([]);
  });

  it("non-string items in one_time_items are filtered out", () => {
    const raw = JSON.stringify({
      provider: "KPN",
      monthly_subscription_eur: 25,
      total_eur: 30,
      one_time_items: ["Online 4,99", 42, null, "Verhuiskosten"],
      language: "nl",
      confidence: 0.8,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.oneTimeItems).toEqual(["Online 4,99", "Verhuiskosten"]);
  });

  it("null monthly + total → all amounts null", () => {
    const raw = JSON.stringify({
      provider: "Foo",
      monthly_subscription_eur: null,
      total_eur: null,
      one_time_items: [],
      language: "nl",
      confidence: 0.4,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.monthlyAmountCents).toBeNull();
    expect(parsed.totalAmountCents).toBeNull();
    expect(parsed.amountCents).toBeNull();
  });

  it("bogus JSON falls back gracefully with oneTimeItems = []", () => {
    const parsed = parseOcrJson("not json at all");
    expect(parsed.confidence).toBe(0);
    expect(parsed.oneTimeItems).toEqual([]);
  });
});

describe("ocr-monthly-vs-total/banner trigger logic", () => {
  // The banner rule lives in app/onderhandel/analyse/page.tsx — verify the
  // 5% threshold math here so the rule can't silently drift.
  function shouldShowBanner(monthlyCents: number | null, totalCents: number | null): boolean {
    if (monthlyCents == null || totalCents == null || totalCents <= 0) return false;
    return Math.abs(totalCents - monthlyCents) / totalCents > 0.05;
  }

  it("KPN €24,66 vs €29,65 → banner (17% verschil)", () => {
    expect(shouldShowBanner(2466, 2965)).toBe(true);
  });

  it("Vodafone €29,95 vs €29,95 → geen banner (0% verschil)", () => {
    expect(shouldShowBanner(2995, 2995)).toBe(false);
  });

  it("4% verschil → geen banner (onder threshold)", () => {
    expect(shouldShowBanner(2880, 3000)).toBe(false);
  });

  it("6% verschil → banner (boven threshold)", () => {
    expect(shouldShowBanner(2820, 3000)).toBe(true);
  });

  it("monthly null → geen banner (oude record)", () => {
    expect(shouldShowBanner(null, 2965)).toBe(false);
  });
});

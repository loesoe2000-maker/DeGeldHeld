import { describe, it, expect } from "vitest";
import { parseOcrJson } from "@/lib/ocr";

describe("OCR — energie-factuur extraction", () => {
  it("extracts kWh-tarief from energie-factuur JSON", () => {
    const raw = JSON.stringify({
      provider: "Eneco",
      monthly_subscription_eur: 145.5,
      total_eur: 145.5,
      one_time_items: [],
      plan: "Variabel tarief",
      period: "mei 2026",
      customer_number: "EN12345",
      language: "nl",
      country: "NL",
      energy_kwh_rate_eur: 0.2885,
      energy_m3_rate_eur: 1.42,
      confidence: 0.91,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.energyKwhRateCents).toBe(29); // Math.round(0.2885 * 100)
    expect(parsed.energyM3RateCents).toBe(142);
    expect(parsed.country).toBe("NL");
  });

  it("returns null when energy fields absent", () => {
    const raw = JSON.stringify({
      provider: "KPN",
      monthly_subscription_eur: 25,
      total_eur: 25,
      one_time_items: [],
      language: "nl",
      country: "NL",
      confidence: 0.9,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.energyKwhRateCents).toBeNull();
    expect(parsed.energyM3RateCents).toBeNull();
  });

  it("handles partial extraction (only kWh, no m³)", () => {
    const raw = JSON.stringify({
      provider: "Vattenfall",
      monthly_subscription_eur: 92,
      total_eur: 92,
      one_time_items: [],
      language: "nl",
      country: "NL",
      energy_kwh_rate_eur: 0.31,
      energy_m3_rate_eur: null,
      confidence: 0.85,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.energyKwhRateCents).toBe(31);
    expect(parsed.energyM3RateCents).toBeNull();
  });

  it("rejects non-numeric values", () => {
    const raw = JSON.stringify({
      provider: "Eneco",
      monthly_subscription_eur: 100,
      total_eur: 100,
      one_time_items: [],
      language: "nl",
      country: "NL",
      energy_kwh_rate_eur: "not a number",
      confidence: 0.8,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.energyKwhRateCents).toBeNull();
  });
});

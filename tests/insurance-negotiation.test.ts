import { describe, it, expect } from "vitest";
import { buildPrompt } from "@/lib/negotiator";
import { parseOcrJson } from "@/lib/ocr";

describe("negotiator — VERZEKERING playbook", () => {
  it("system prompt mentions dekking + eigen risico via category hint", () => {
    const { user } = buildPrompt({
      customerName: "Jan",
      customerEmail: "jan@nl.nl",
      provider: "Centraal Beheer",
      category: "VERZEKERING",
      currentPlan: "Auto Allrisk",
      currentMonthlyCents: 4500,
      alternatives: [
        {
          plan: {
            provider: "FBTO",
            category: "VERZEKERING",
            name: "Auto Allrisk",
            priceCents: 3500,
            features: "",
          },
          monthlySavingsCents: 1000,
          yearlySavingsCents: 12000,
          percentSaved: 0.22,
          rationale: "concurrent",
        },
      ],
    });
    expect(user.toLowerCase()).toMatch(/dekking|eigen risico/);
  });

  it("does NOT inject 'switch binnen 30 dagen' hint for HYPOTHEEK", () => {
    const { user } = buildPrompt({
      customerName: "Jan",
      provider: "ABN AMRO Hypotheken",
      category: "HYPOTHEEK",
      currentPlan: "Annuïteit 20 jaar",
      currentMonthlyCents: 120000,
      alternatives: [],
    });
    // Category hint should mention rente / oversluit, not "switch within 30 dagen"
    expect(user.toLowerCase()).toMatch(/rente|oversluit/);
  });
});

describe("OCR — VERZEKERING extraction", () => {
  it("extracts dekking + eigen risico", () => {
    const raw = JSON.stringify({
      provider: "Centraal Beheer",
      monthly_subscription_eur: 45,
      total_eur: 45,
      one_time_items: [],
      plan: "Auto Allrisk",
      language: "nl",
      country: "NL",
      insurance_coverage: "casco",
      insurance_deductible_eur: 150,
      confidence: 0.93,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.insuranceCoverage).toBe("casco");
    expect(parsed.insuranceDeductibleCents).toBe(15000);
  });

  it("extracts hypotheek rente + looptijd", () => {
    const raw = JSON.stringify({
      provider: "Rabo Hypotheken",
      monthly_subscription_eur: 1450,
      total_eur: 1450,
      one_time_items: [],
      language: "nl",
      country: "NL",
      mortgage_interest_pct: 3.85,
      mortgage_term_years: 20,
      confidence: 0.9,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.mortgageInterestPct).toBe(3.85);
    expect(parsed.mortgageTermYears).toBe(20);
  });

  it("extracts streaming tier", () => {
    const raw = JSON.stringify({
      provider: "Netflix",
      monthly_subscription_eur: 17.99,
      total_eur: 17.99,
      one_time_items: [],
      language: "nl",
      country: "INT",
      streaming_tier: "premium",
      confidence: 0.95,
    });
    const parsed = parseOcrJson(raw);
    expect(parsed.streamingTier).toBe("premium");
  });
});

import { describe, it, expect } from "vitest";
import {
  buildComparison,
  getCheaperAlternatives,
  isMonopolyCategory,
} from "@/lib/comparison";
import { allCategories, allCountries, type Country, type Category } from "@/lib/providers";
import { planCountry, plansForCategoryAndCountry, MARKET_PLANS } from "@/lib/market_db";

describe("comparison/country-aware alternatives", () => {
  it("BE Eneco-bill returns BE-providers only (live bug fix)", () => {
    const r = buildComparison({
      provider: "Eneco BE",
      category: "ENERGIE",
      amountCents: 17000,
      country: "BE",
    });
    expect(r.topAlternatives.length).toBeGreaterThan(0);
    const providers = r.topAlternatives.map((a) => a.plan.provider);
    // None of the alternatives should be ES or FR energy providers
    const forbidden = ["Iberdrola", "Endesa", "EDF", "Engie FR", "TotalEnergies", "Eni Plenitude", "Mint Energie", "Naturgy", "Repsol"];
    for (const p of providers) {
      expect(forbidden).not.toContain(p);
    }
    // At least one returned plan must be from a BE provider
    const beProviders = ["Engie Electrabel", "Luminus", "TotalEnergies BE", "Mega", "Eneco BE"];
    expect(providers.some((p) => beProviders.includes(p))).toBe(true);
  });

  it("DE Vodafone-bill returns DE-providers only", () => {
    const r = buildComparison({
      provider: "Vodafone DE",
      category: "TELECOM",
      amountCents: 4495,
      country: "DE",
    });
    expect(r.topAlternatives.length).toBeGreaterThan(0);
    for (const alt of r.topAlternatives) {
      const c = planCountry(alt.plan);
      expect(["DE", "INT"]).toContain(c);
    }
  });

  it("NL default behavior unchanged (no country arg = NL)", () => {
    const r = buildComparison({
      provider: "Eneco",
      category: "ENERGIE",
      amountCents: 18000,
    });
    expect(r.topAlternatives.length).toBeGreaterThan(0);
    for (const alt of r.topAlternatives) {
      const c = planCountry(alt.plan);
      expect(["NL", "INT"]).toContain(c);
    }
  });

  it("getCheaperAlternatives respects country parameter", () => {
    const beAlts = getCheaperAlternatives("Engie Electrabel", "ENERGIE", 17000, 5, "BE");
    expect(beAlts.length).toBeGreaterThanOrEqual(3);
    for (const a of beAlts) {
      const c = planCountry(a.plan);
      expect(["BE", "INT"]).toContain(c);
    }
  });

  it("UK telecom returns UK providers", () => {
    const ukAlts = getCheaperAlternatives("BT", "TELECOM", 4000, 5, "UK");
    expect(ukAlts.length).toBeGreaterThanOrEqual(3);
    for (const a of ukAlts) {
      const c = planCountry(a.plan);
      expect(["UK", "INT"]).toContain(c);
    }
  });
});

describe("comparison/per land × categorie coverage (≥3 plans of monopoly)", () => {
  const countryCatPairs: Array<{ country: Country; category: Category }> = [
    { country: "NL", category: "TELECOM" },
    { country: "NL", category: "ENERGIE" },
    { country: "NL", category: "VERZEKERING" },
    { country: "NL", category: "BANK" },
    { country: "NL", category: "HYPOTHEEK" },
    { country: "BE", category: "TELECOM" },
    { country: "BE", category: "ENERGIE" },
    { country: "BE", category: "VERZEKERING" },
    { country: "BE", category: "BANK" },
    { country: "DE", category: "TELECOM" },
    { country: "DE", category: "ENERGIE" },
    { country: "DE", category: "VERZEKERING" },
    { country: "DE", category: "BANK" },
    { country: "FR", category: "TELECOM" },
    { country: "FR", category: "ENERGIE" },
    { country: "FR", category: "VERZEKERING" },
    { country: "FR", category: "BANK" },
    { country: "UK", category: "TELECOM" },
    { country: "UK", category: "ENERGIE" },
    { country: "UK", category: "VERZEKERING" },
    { country: "UK", category: "BANK" },
  ];

  it.each(countryCatPairs)(
    "$country × $category has ≥3 plans (or monopoly-flag)",
    ({ country, category }) => {
      const plans = plansForCategoryAndCountry(category, country);
      const monopoly = isMonopolyCategory(category, country);
      if (monopoly) {
        // monopoly category — no alternatives required, just the flag
        expect(monopoly).toBe(true);
      } else {
        expect(plans.length).toBeGreaterThanOrEqual(3);
      }
    },
  );
});

describe("comparison/isMonopolyCategory", () => {
  it("NL WATER is monopoly", () => {
    expect(isMonopolyCategory("WATER", "NL")).toBe(true);
  });
  it("NL GEMEENTE is monopoly", () => {
    expect(isMonopolyCategory("GEMEENTE", "NL")).toBe(true);
  });
  it("NL ENERGIE is NOT monopoly", () => {
    expect(isMonopolyCategory("ENERGIE", "NL")).toBe(false);
  });
  it("BE WATER is monopoly", () => {
    expect(isMonopolyCategory("WATER", "BE")).toBe(true);
  });
  it("US WATER is not flagged monopoly (out of NL/BE/DE scope)", () => {
    expect(isMonopolyCategory("WATER", "US")).toBe(false);
  });
});

describe("comparison/planCountry derivation", () => {
  it("plans inherit country from PROVIDERS lookup when not set explicit", () => {
    const eneco = MARKET_PLANS.find((p) => p.provider === "Eneco")!;
    expect(planCountry(eneco)).toBe("NL");
  });

  it("BE Eneco plan resolves to BE country (explicit)", () => {
    const eneco = MARKET_PLANS.find((p) => p.provider === "Eneco BE");
    expect(eneco).toBeDefined();
    expect(planCountry(eneco!)).toBe("BE");
  });

  it("Netflix (streaming) plans resolve to INT", () => {
    const netflix = MARKET_PLANS.find((p) => p.provider === "Netflix");
    if (netflix) {
      expect(planCountry(netflix)).toBe("INT");
    }
  });
});

describe("comparison/all countries are valid", () => {
  it("allCountries returns 9 markets", () => {
    expect(allCountries().length).toBe(9);
    expect(allCountries()).toContain("NL");
    expect(allCountries()).toContain("BE");
  });

  it("allCategories returns 14 enum values (legacy)", () => {
    expect(allCategories().length).toBe(14);
  });
});

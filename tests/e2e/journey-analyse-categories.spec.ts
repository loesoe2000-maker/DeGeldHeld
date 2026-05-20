/**
 * v17 DEEL 2 — analyse page must feed REAL bill fields into the
 * category comparisons, not hardcoded literals.
 *
 * Source-level contract: read app/onderhandel/analyse/page.tsx and
 * assert the compare-calls reference bill.<field>, and that the old
 * hardcoded literals are gone.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../app/onderhandel/analyse/page.tsx"),
  "utf8",
);

test.describe("v17 analyse — real OCR fields wired", () => {
  test("ENERGIE block uses bill.energyKwhRateCents + energyM3RateCents", () => {
    expect(SRC).toMatch(/kwhPriceCents:\s*bill\.energyKwhRateCents/);
    expect(SRC).toMatch(/m3PriceCents:\s*bill\.energyM3RateCents/);
    expect(SRC).toMatch(/bill\.energyContractType/);
    // The old hardcoded contractType:"variabel" literal is gone.
    expect(SRC).not.toMatch(/contractType:\s*"variabel"/);
  });

  test("VERZEKERING block uses bill.insuranceCoverage + deductible", () => {
    expect(SRC).toMatch(/bill\.insuranceCoverage/);
    expect(SRC).toMatch(/deductibleCents:\s*bill\.insuranceDeductibleCents/);
    // The old hardcoded type:"UNKNOWN" literal in the compare-call is gone.
    expect(SRC).not.toMatch(/type:\s*"UNKNOWN"\s*as\s*InsuranceCoverageType/);
  });

  test("HYPOTHEEK block uses bill.mortgageInterestPct + mortgageTermYears", () => {
    expect(SRC).toMatch(/bill\.mortgageInterestPct/);
    expect(SRC).toMatch(/bill\.mortgageTermYears/);
    // The old hardcoded rentePercentage: 4.8 + restschuldCents:
    // 25_000_000 literals are gone.
    expect(SRC).not.toMatch(/rentePercentage:\s*4\.8/);
    expect(SRC).not.toMatch(/restschuldCents:\s*25_000_000/);
  });

  test("each block shows an estimate badge when the field is null", () => {
    expect(SRC).toMatch(/energie-estimate-badge/);
    expect(SRC).toMatch(/verzekering-estimate-badge/);
    expect(SRC).toMatch(/hypotheek-estimate-badge/);
  });

  test("restschuld estimate is clamped to a sane band (no silly tiny mortgage)", () => {
    expect(SRC).toMatch(/estRestschuldCents/);
    expect(SRC).toMatch(/5_000_000/); // €50k floor
    expect(SRC).toMatch(/100_000_000/); // €1M ceiling
  });
});

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

  // v22: VERZEKERING + HYPOTHEEK are gated (AFM licence). The render
  // blocks are removed and the page early-returns a "not supported" state.
  test("v22: hypotheek + verzekering are gated, not rendered", () => {
    expect(SRC).toMatch(/isSupportedCategory\(bill\.category\)/);
    expect(SRC).not.toMatch(/data-testid="cat-verzekering"/);
    expect(SRC).not.toMatch(/data-testid="cat-hypotheek"/);
  });

  test("energie estimate badge still present", () => {
    expect(SRC).toMatch(/energie-estimate-badge/);
  });
});

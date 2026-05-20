import { describe, it, expect } from "vitest";
import { hasMarketData, countryLabel } from "@/lib/market-coverage";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("v18 market-coverage — honesty gate", () => {
  it("NL is covered for every category", () => {
    expect(hasMarketData("ENERGIE", "NL")).toBe(true);
    expect(hasMarketData("WATER", "NL")).toBe(true);
    expect(hasMarketData("HYPOTHEEK", "NL")).toBe(true);
    expect(hasMarketData("VERZEKERING", "NL")).toBe(true);
    expect(hasMarketData("TELECOM", "NL")).toBe(true);
  });

  it("NL-only categories are NOT covered for non-NL countries", () => {
    expect(hasMarketData("ENERGIE", "DE")).toBe(false);
    expect(hasMarketData("ENERGIE", "FR")).toBe(false);
    expect(hasMarketData("WATER", "DE")).toBe(false);
    expect(hasMarketData("HYPOTHEEK", "BE")).toBe(false);
    expect(hasMarketData("VERZEKERING", "DE")).toBe(false);
  });

  it("TELECOM may be covered for non-NL when MARKET_PLANS has plans", () => {
    // BE telecom has plans in MARKET_PLANS (Proximus etc) → covered.
    expect(hasMarketData("TELECOM", "BE")).toBe(true);
  });

  it("countryLabel returns Dutch adjectives", () => {
    expect(countryLabel("DE")).toBe("Duitse");
    expect(countryLabel("FR")).toBe("Franse");
    expect(countryLabel("BE")).toBe("Belgische");
  });
});

describe("v18 analyse page — honest fallback contract", () => {
  const src = readFileSync(
    resolve(__dirname, "../app/onderhandel/analyse/page.tsx"),
    "utf8",
  );

  it("computes marketDataCovered from hasMarketData", () => {
    expect(src).toMatch(/marketDataCovered\s*=\s*hasMarketData/);
  });

  it("renders the coverage banner when NOT covered", () => {
    expect(src).toMatch(/!marketDataCovered/);
    expect(src).toMatch(/country-coverage-banner/);
    expect(src).toMatch(/indicatie/);
  });

  it("only shows the Comparison savings card when covered", () => {
    expect(src).toMatch(/\{marketDataCovered && \(\s*<div/);
  });

  it("category-specific blocks are gated behind marketDataCovered", () => {
    expect(src).toMatch(/marketDataCovered && bill\.category === "ENERGIE"/);
    expect(src).toMatch(/marketDataCovered && bill\.category === "WATER"/);
    expect(src).toMatch(/marketDataCovered && bill\.category === "VERZEKERING"/);
    expect(src).toMatch(/marketDataCovered && bill\.category === "HYPOTHEEK"/);
  });
});

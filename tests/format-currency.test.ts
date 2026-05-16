import { describe, it, expect } from "vitest";
import { formatCurrency, formatEurCents, currencyForCountry } from "@/lib/format";

describe("formatCurrency — multi-currency", () => {
  it("formats EUR with NL locale (komma decimaal)", () => {
    const s = formatCurrency(1570, "EUR");
    expect(s).toMatch(/15,70/);
    expect(s).toContain("€");
  });

  it("formats GBP with UK locale (point decimaal)", () => {
    const s = formatCurrency(1570, "GBP");
    expect(s).toMatch(/15\.70/);
    expect(s).toContain("£");
  });

  it("formats USD with US locale", () => {
    const s = formatCurrency(1570, "USD");
    expect(s).toMatch(/15\.70/);
    expect(s).toContain("$");
  });

  it("formats CHF with Swiss locale", () => {
    const s = formatCurrency(15700, "CHF");
    expect(s).toMatch(/157/);
    expect(s.toLowerCase()).toMatch(/chf|fr\./i);
  });

  it("respects showDecimals=false for round numbers", () => {
    const s = formatCurrency(10000, "EUR", undefined, { showDecimals: false });
    expect(s).not.toMatch(/,00|\.00/);
    expect(s).toMatch(/100/);
  });

  it("backwards-compat: formatEurCents still works", () => {
    const s = formatEurCents(1570);
    expect(s).toMatch(/15,70/);
    expect(s).toContain("€");
  });
});

describe("currencyForCountry — mapping", () => {
  it("EU countries → EUR", () => {
    for (const c of ["NL", "BE", "DE", "FR", "ES", "IT"]) {
      expect(currencyForCountry(c)).toBe("EUR");
    }
  });
  it("UK / GB → GBP", () => {
    expect(currencyForCountry("UK")).toBe("GBP");
    expect(currencyForCountry("GB")).toBe("GBP");
  });
  it("US → USD", () => {
    expect(currencyForCountry("US")).toBe("USD");
  });
  it("CH → CHF", () => {
    expect(currencyForCountry("CH")).toBe("CHF");
  });
  it("unknown / null → EUR fallback", () => {
    expect(currencyForCountry(null)).toBe("EUR");
    expect(currencyForCountry("XX")).toBe("EUR");
  });
});

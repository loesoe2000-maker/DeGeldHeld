import { describe, it, expect } from "vitest";
import { compareMortgage, MARKET_RATES } from "../lib/categories/hypotheek";

describe("categories/hypotheek/compareMortgage", () => {
  it("flags oversluiten-rendabel when rente >1% boven markt", () => {
    const r = compareMortgage({
      restschuldCents: 30_000_000,
      rentePercentage: 5.5,
      rentevasteJaren: 10,
      looptijdJaren: 25,
    });
    expect(r.rateDeltaPct).toBeGreaterThan(1);
    expect(r.yearlySavingsGrossCents).toBeGreaterThan(0);
    expect(r.oversluitWorthIt).toBe(true);
  });

  it("flags niet-rendabel when rente al onder markt", () => {
    const r = compareMortgage({
      restschuldCents: 30_000_000,
      rentePercentage: 3.5,
      rentevasteJaren: 10,
      looptijdJaren: 25,
    });
    expect(r.oversluitWorthIt).toBe(false);
  });

  it("uses nearest market rate for non-standard rentevasteJaren", () => {
    const r = compareMortgage({
      restschuldCents: 25_000_000,
      rentePercentage: 5.0,
      rentevasteJaren: 12,
      looptijdJaren: 28,
    });
    expect([MARKET_RATES[10], MARKET_RATES[15]]).toContain(r.marketRatePct);
  });

  it("includes oversluitkosten in net savings", () => {
    const r = compareMortgage({
      restschuldCents: 20_000_000,
      rentePercentage: 4.5,
      rentevasteJaren: 10,
      looptijdJaren: 25,
    });
    expect(r.yearlySavingsNetCents).toBeLessThan(r.yearlySavingsGrossCents);
  });

  it("payback months is positive when savings exist", () => {
    const r = compareMortgage({
      restschuldCents: 30_000_000,
      rentePercentage: 5.5,
      rentevasteJaren: 10,
      looptijdJaren: 25,
    });
    expect(r.paybackMonths).toBeGreaterThan(0);
    expect(r.paybackMonths).toBeLessThan(60);
  });

  it("payback months is -1 when no savings", () => {
    const r = compareMortgage({
      restschuldCents: 30_000_000,
      rentePercentage: 3.0,
      rentevasteJaren: 10,
      looptijdJaren: 25,
    });
    expect(r.paybackMonths).toBe(-1);
  });
});

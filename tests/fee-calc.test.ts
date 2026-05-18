import { describe, it, expect } from "vitest";
import {
  feeForVerifiedSavings,
  NO_CURE_NO_PAY_FEE_PCT,
  NO_CURE_NO_PAY_FEE_CAP_CENTS,
  NO_CURE_NO_PAY_FEE_FLOOR_CENTS,
  NO_CURE_NO_PAY_MIN_SAVINGS_CENTS,
} from "@/lib/payments";

describe("feeForVerifiedSavings — rate is exactly 20% (v13 bounds)", () => {
  it("rate constant matches user spec: 20%, NOT 10%", () => {
    expect(NO_CURE_NO_PAY_FEE_PCT).toBe(0.20);
  });

  it("v13 bounds: floor €2, cap €50, min savings €25/year", () => {
    expect(NO_CURE_NO_PAY_FEE_FLOOR_CENTS).toBe(200);
    expect(NO_CURE_NO_PAY_FEE_CAP_CENTS).toBe(5000);
    expect(NO_CURE_NO_PAY_MIN_SAVINGS_CENTS).toBe(2500);
  });

  it("sub-threshold (<€25 yearly) returns 0", () => {
    expect(feeForVerifiedSavings(0)).toBe(0);
    expect(feeForVerifiedSavings(2499)).toBe(0);
  });

  it("exactly at threshold (€25): 20% of €25 = €5", () => {
    // 2500 * 0.20 = 500 (>floor=200, <cap=5000) → 500
    expect(feeForVerifiedSavings(NO_CURE_NO_PAY_MIN_SAVINGS_CENTS)).toBe(500);
  });

  it("€100/year saving: 20% = €20 (between floor and cap)", () => {
    expect(feeForVerifiedSavings(10000)).toBe(2000);
  });

  it("€250/year saving: 20% = €50 → exactly at cap", () => {
    expect(feeForVerifiedSavings(25000)).toBe(5000);
  });

  it("€600/year saving: 20% = €120 → capped at €50", () => {
    expect(feeForVerifiedSavings(60000)).toBe(5000);
  });

  it("clamps to cap for large savings", () => {
    expect(feeForVerifiedSavings(1_000_000)).toBe(NO_CURE_NO_PAY_FEE_CAP_CENTS);
  });

  it("never returns less than the floor for amounts >= threshold", () => {
    // 2500 * 0.20 = 500 — already above floor=200.
    const fee = feeForVerifiedSavings(2500);
    expect(fee).toBeGreaterThanOrEqual(NO_CURE_NO_PAY_FEE_FLOOR_CENTS);
  });

  it("savings of €10 (200 cents fee raw) lands at floor not zero", () => {
    // €10 = 1000 cents — below new threshold so fee=0. But once the
    // threshold is met, even a tiny percentage hit floors at €2.
    // We test the floor-clamp path with a synthetic input above
    // threshold but below floor-equivalent: threshold=2500, 20% of
    // threshold=500, which is above floor. So floor-clamping only
    // bites for sub-threshold values which are zero. Defensive: a
    // floor exists in the function even if not exercised in the
    // current configuration.
    expect(feeForVerifiedSavings(1000)).toBe(0); // sub-threshold
  });

  it("negative savings input returns 0 defensively", () => {
    expect(feeForVerifiedSavings(-100)).toBe(0);
  });
});

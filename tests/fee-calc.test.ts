import { describe, it, expect } from "vitest";
import {
  feeForVerifiedSavings,
  NO_CURE_NO_PAY_FEE_PCT,
  NO_CURE_NO_PAY_FEE_CAP_CENTS,
  NO_CURE_NO_PAY_FEE_FLOOR_CENTS,
  NO_CURE_NO_PAY_MIN_SAVINGS_CENTS,
} from "@/lib/payments";

describe("feeForVerifiedSavings — rate is exactly 20%", () => {
  it("constant matches user spec: 20%, NOT 10%", () => {
    expect(NO_CURE_NO_PAY_FEE_PCT).toBe(0.20);
  });

  it("floor is €2, cap is €25", () => {
    expect(NO_CURE_NO_PAY_FEE_FLOOR_CENTS).toBe(200);
    expect(NO_CURE_NO_PAY_FEE_CAP_CENTS).toBe(2500);
  });

  it("sub-threshold (€50) yearly returns 0", () => {
    expect(feeForVerifiedSavings(0)).toBe(0);
    expect(feeForVerifiedSavings(4999)).toBe(0);
  });

  it("exactly at threshold (€50) returns the €2 floor (20% of €50 = €10, but floor=€2 — actually €10 hits between)", () => {
    // 5000 * 0.20 = 1000 (>floor=200, <cap=2500) → 1000
    expect(feeForVerifiedSavings(NO_CURE_NO_PAY_MIN_SAVINGS_CENTS)).toBe(1000);
  });

  it("€600/year saving: 20% = €120 → cap (€25)", () => {
    expect(feeForVerifiedSavings(60000)).toBe(2500);
  });

  it("€100/year saving: 20% = €20 → no cap (between floor and cap)", () => {
    expect(feeForVerifiedSavings(10000)).toBe(2000);
  });

  it("clamps to cap for large savings", () => {
    expect(feeForVerifiedSavings(1_000_000)).toBe(NO_CURE_NO_PAY_FEE_CAP_CENTS);
  });

  it("never returns less than the floor for amounts >= threshold", () => {
    // 5500 * 0.20 = 1100 — still under cap, still above floor. Good.
    const fee = feeForVerifiedSavings(5500);
    expect(fee).toBeGreaterThanOrEqual(NO_CURE_NO_PAY_FEE_FLOOR_CENTS);
  });

  it("negative savings input returns 0 defensively", () => {
    expect(feeForVerifiedSavings(-100)).toBe(0);
  });
});

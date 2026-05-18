import { describe, it, expect } from "vitest";
import {
  feeForVerifiedSavings,
  NO_CURE_NO_PAY_MIN_SAVINGS_CENTS,
} from "@/lib/payments";

describe("skip-low-savings — sub-€50 never triggers a fee", () => {
  it("€0 → 0", () => {
    expect(feeForVerifiedSavings(0)).toBe(0);
  });
  it("€10 → 0", () => {
    expect(feeForVerifiedSavings(1000)).toBe(0);
  });
  it("€49,99 → 0 (just below threshold)", () => {
    expect(feeForVerifiedSavings(NO_CURE_NO_PAY_MIN_SAVINGS_CENTS - 1)).toBe(0);
  });
  it("€50,00 → > 0 (at threshold the gate opens)", () => {
    expect(feeForVerifiedSavings(NO_CURE_NO_PAY_MIN_SAVINGS_CENTS)).toBeGreaterThan(0);
  });
});

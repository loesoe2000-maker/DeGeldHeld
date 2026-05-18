import { describe, it, expect } from "vitest";
import {
  feeForVerifiedSavings,
  NO_CURE_NO_PAY_MIN_SAVINGS_CENTS,
} from "@/lib/payments";

describe("skip-low-savings — sub-€25 never triggers a fee (v13 bounds)", () => {
  it("€0 → 0", () => {
    expect(feeForVerifiedSavings(0)).toBe(0);
  });
  it("€10 → 0", () => {
    expect(feeForVerifiedSavings(1000)).toBe(0);
  });
  it("€24,99 → 0 (just below threshold)", () => {
    expect(feeForVerifiedSavings(NO_CURE_NO_PAY_MIN_SAVINGS_CENTS - 1)).toBe(0);
  });
  it("€25,00 → > 0 (at threshold the gate opens)", () => {
    expect(feeForVerifiedSavings(NO_CURE_NO_PAY_MIN_SAVINGS_CENTS)).toBeGreaterThan(0);
  });
});

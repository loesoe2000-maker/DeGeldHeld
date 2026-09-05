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
  it("v41 GRATIS: ook boven de oude drempel blijft de fee 0", () => {
    expect(feeForVerifiedSavings(NO_CURE_NO_PAY_MIN_SAVINGS_CENTS)).toBe(0);
    expect(feeForVerifiedSavings(NO_CURE_NO_PAY_MIN_SAVINGS_CENTS * 100)).toBe(0);
  });
});

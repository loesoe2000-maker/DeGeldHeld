import { describe, it, expect } from "vitest";
import { diffYearlySavings } from "@/lib/recheck-savings";

describe("diffYearlySavings (DEEL 3b: before/after invoice diff)", () => {
  it("€174 → €120 produces €648/year saving", () => {
    expect(diffYearlySavings(17400, 12000)).toBe(64800);
  });

  it("equal amounts produce null (no saving)", () => {
    expect(diffYearlySavings(10000, 10000)).toBeNull();
  });

  it("new higher than old produces null", () => {
    expect(diffYearlySavings(10000, 12000)).toBeNull();
  });

  it("sub-€1 difference is ignored (OCR noise)", () => {
    expect(diffYearlySavings(10000, 9950)).toBeNull();
  });

  it("exactly €1 difference passes the noise floor", () => {
    expect(diffYearlySavings(10000, 9900)).toBe(1200);
  });

  it("zero or negative old amount returns null defensively", () => {
    expect(diffYearlySavings(0, 5000)).toBeNull();
    expect(diffYearlySavings(-100, 5000)).toBeNull();
  });

  it("zero new amount returns null defensively", () => {
    expect(diffYearlySavings(10000, 0)).toBeNull();
  });
});

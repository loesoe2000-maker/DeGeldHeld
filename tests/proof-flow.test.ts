import { describe, it, expect } from "vitest";
import {
  evaluateProof,
  MIN_SAVINGS_DROP_PCT,
} from "@/lib/outcome-proof";

describe("outcome-proof / evaluateProof verdict", () => {
  it("verified when new < old with ≥5% drop", () => {
    const v = evaluateProof({ oldMonthlyCents: 17000, newAmountCents: 14500 });
    expect(v.verdict).toBe("verified");
    if (v.verdict === "verified") {
      expect(v.deltaCents).toBe(2500);
      expect(v.yearlySavingsCents).toBe(30000);
    }
  });

  it("verified at exact 5% drop boundary", () => {
    const old = 10000;
    const newAmount = old - Math.round(old * MIN_SAVINGS_DROP_PCT);
    const v = evaluateProof({ oldMonthlyCents: old, newAmountCents: newAmount });
    expect(v.verdict).toBe("verified");
  });

  it("rejected when drop is below 5% (likely OCR noise)", () => {
    const v = evaluateProof({ oldMonthlyCents: 10000, newAmountCents: 9800 });
    expect(v.verdict).toBe("rejected");
    if (v.verdict === "rejected") {
      expect(v.reason).toMatch(/below.*5% minimum/);
    }
  });

  it("rejected when new amount is higher than original", () => {
    const v = evaluateProof({ oldMonthlyCents: 10000, newAmountCents: 11000 });
    expect(v.verdict).toBe("rejected");
  });

  it("rejected when new amount equals old (no actual saving)", () => {
    const v = evaluateProof({ oldMonthlyCents: 10000, newAmountCents: 10000 });
    expect(v.verdict).toBe("rejected");
  });

  it("rejected when newAmountCents is null (proof had no amount)", () => {
    const v = evaluateProof({ oldMonthlyCents: 10000, newAmountCents: null });
    expect(v.verdict).toBe("rejected");
    if (v.verdict === "rejected") {
      expect(v.reason).toMatch(/no amount/);
    }
  });

  it("rejected when oldMonthlyCents is zero (malformed bill)", () => {
    const v = evaluateProof({ oldMonthlyCents: 0, newAmountCents: 5000 });
    expect(v.verdict).toBe("rejected");
  });
});

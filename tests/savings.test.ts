import { describe, it, expect } from "vitest";
import {
  computeSavingsStats,
  negotiationLabel,
  isOpenState,
  isClosedState,
  tierClass,
} from "../lib/savings";

type N = { state: string; actualSavingsCents: number | null };
const mk = (s: string, cents: number | null = null) =>
  ({ state: s as never, actualSavingsCents: cents }) as never;

describe("savings/computeSavingsStats", () => {
  it("returns zeros for empty list", () => {
    const s = computeSavingsStats([]);
    expect(s.totalSavedCents).toBe(0);
    expect(s.totalAttempts).toBe(0);
    expect(s.successRate).toBe(0);
    expect(s.averageSavingsCents).toBe(0);
  });

  it("counts SUCCESS savings", () => {
    const s = computeSavingsStats([mk("SUCCESS", 12000), mk("SUCCESS", 8000)]);
    expect(s.totalSavedCents).toBe(20000);
    expect(s.totalSuccessful).toBe(2);
    expect(s.successRate).toBe(1);
    expect(s.averageSavingsCents).toBe(10000);
  });

  it("counts BILLED state as successful", () => {
    const s = computeSavingsStats([mk("BILLED", 5000)]);
    expect(s.totalSuccessful).toBe(1);
    expect(s.totalSavedCents).toBe(5000);
  });

  it("FAILED counts as attempt but not successful", () => {
    const s = computeSavingsStats([mk("FAILED"), mk("SUCCESS", 1000)]);
    expect(s.totalAttempts).toBe(2);
    expect(s.totalSuccessful).toBe(1);
    expect(s.successRate).toBe(0.5);
  });

  it("counts open states as pending", () => {
    const s = computeSavingsStats([mk("AWAITING"), mk("ANALYSE"), mk("NIEUW")]);
    expect(s.pendingCount).toBe(3);
    expect(s.totalSuccessful).toBe(0);
  });

  it("handles missing actualSavingsCents safely", () => {
    const s = computeSavingsStats([mk("SUCCESS", null)]);
    expect(s.totalSavedCents).toBe(0);
    expect(s.totalSuccessful).toBe(1);
  });
});

describe("savings/negotiationLabel", () => {
  it("returns Dutch labels", () => {
    expect(negotiationLabel("NIEUW" as never)).toBe("Nieuw");
    expect(negotiationLabel("SUCCESS" as never)).toBe("Geslaagd");
    expect(negotiationLabel("FAILED" as never)).toBe("Niet gelukt");
    expect(negotiationLabel("AWAITING" as never)).toBe("Wacht op provider");
    expect(negotiationLabel("BILLED" as never)).toBe("Afgerond");
  });
});

describe("savings/isOpenState + isClosedState", () => {
  it.each(["NIEUW", "BILL_UPLOAD", "ANALYSE", "EMAIL_GEN", "AWAITING"])("open: %s", (s) => {
    expect(isOpenState(s as never)).toBe(true);
    expect(isClosedState(s as never)).toBe(false);
  });
  it.each(["SUCCESS", "FAILED", "BILLED"])("closed: %s", (s) => {
    expect(isOpenState(s as never)).toBe(false);
    expect(isClosedState(s as never)).toBe(true);
  });
});

describe("savings/tierClass", () => {
  it("returns brand class for SUCCESS/BILLED", () => {
    expect(tierClass("SUCCESS" as never)).toContain("brand");
    expect(tierClass("BILLED" as never)).toContain("brand");
  });
  it("returns red class for FAILED", () => {
    expect(tierClass("FAILED" as never)).toContain("red");
  });
  it("returns amber class for AWAITING", () => {
    expect(tierClass("AWAITING" as never)).toContain("amber");
  });
  it("returns slate class for in-progress", () => {
    expect(tierClass("ANALYSE" as never)).toContain("slate");
  });
});

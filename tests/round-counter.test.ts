import { describe, it, expect } from "vitest";
import { buildCounterContext } from "@/lib/rounds";

describe("rounds — counter context", () => {
  it("includes previous offer explicitly when amount known", () => {
    const ctx = buildCounterContext({
      roundNumber: 2,
      previousOfferedCents: 2250,
      previousTone: "constructief",
    });
    expect(ctx).toContain("ronde 2");
    expect(ctx).toContain("€22,50");
    expect(ctx).toContain("constructief");
    expect(ctx).toContain("counter-mail");
  });

  it("handles missing previous offer", () => {
    const ctx = buildCounterContext({
      roundNumber: 1,
      previousOfferedCents: null,
      previousTone: "stalling",
    });
    expect(ctx).toContain("ronde 1");
    expect(ctx).toContain("geen concreet bedrag");
    expect(ctx).toContain("stalling");
  });

  it("uses NL comma decimal format", () => {
    const ctx = buildCounterContext({
      roundNumber: 3,
      previousOfferedCents: 1999,
      previousTone: "afwijzend",
    });
    expect(ctx).toContain("€19,99");
    expect(ctx).not.toContain("€19.99");
  });

  it("non-zero round number always referenced", () => {
    for (const n of [1, 2, 3]) {
      const ctx = buildCounterContext({
        roundNumber: n,
        previousOfferedCents: 1000,
        previousTone: "constructief",
      });
      expect(ctx).toContain(`ronde ${n}`);
    }
  });
});

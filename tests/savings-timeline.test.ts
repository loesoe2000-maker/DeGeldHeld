import { describe, it, expect } from "vitest";
import { cumulativeByMonth, milestoneCopy } from "@/lib/savings-timeline";

describe("v21 savings-timeline", () => {
  it("accumulates savings per month, oldest → newest", () => {
    const buckets = cumulativeByMonth([
      { at: new Date("2026-03-10"), cents: 5000 },
      { at: new Date("2026-03-20"), cents: 1000 },
      { at: new Date("2026-05-01"), cents: 4000 },
    ]);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].monthKey).toBe("2026-03");
    expect(buckets[0].cumulativeCents).toBe(6000);
    expect(buckets[1].monthKey).toBe("2026-05");
    expect(buckets[1].cumulativeCents).toBe(10000); // cumulative
    expect(buckets[1].label).toMatch(/mei/);
  });

  it("ignores zero-amount points + handles empty", () => {
    expect(cumulativeByMonth([{ at: new Date(), cents: 0 }])).toEqual([]);
    expect(cumulativeByMonth([])).toEqual([]);
  });

  it("milestone names a missing category + a typical extra saving", () => {
    const m = milestoneCopy(25000, "ENERGIE");
    expect(m.savedEur).toBe(250);
    expect(m.cta).toMatch(/energie/i);
    expect(m.cta).toMatch(/€/);
  });

  it("milestone has no CTA when no category gap", () => {
    expect(milestoneCopy(10000, null).cta).toBeNull();
  });
});

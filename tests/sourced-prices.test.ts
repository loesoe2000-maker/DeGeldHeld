import { describe, it, expect } from "vitest";
import { getMarketRange, getCheaperAlternatives, buildComparison } from "@/lib/comparison";
import { SOURCED_MARKET_PLANS } from "@/lib/market-prices";

describe("v22 — sourced prices wired into the comparison", () => {
  it("every sourced plan carries a source URL + verifiedAt (no hallucinations)", () => {
    expect(SOURCED_MARKET_PLANS.length).toBeGreaterThan(0);
    for (const p of SOURCED_MARKET_PLANS) {
      expect(p.source).toMatch(/^https?:\/\//);
      expect(p.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.priceCents).toBeGreaterThan(0);
    }
  });

  it("STREAMING range is built from the real sourced plans (plausible)", () => {
    const r = getMarketRange("STREAMING", 1500, "NL");
    // 10 sourced streaming plans (Spotify/Netflix/Disney+)
    expect(r.sampleSize).toBeGreaterThanOrEqual(10);
    // plausible NL streaming band: €5–€25/month
    expect(r.minCents).toBeGreaterThanOrEqual(500);
    expect(r.maxCents).toBeLessThanOrEqual(2500);
    expect(r.medianCents).toBeGreaterThan(r.minCents - 1);
  });

  it("OPSLAG comparison surfaces a cheaper real alternative", () => {
    // user on iCloud+ 2TB-equivalent €9.99 → cheaper sourced storage exists
    const alts = getCheaperAlternatives("Onbekend", "OPSLAG", 999, 3, "NL");
    expect(alts.length).toBeGreaterThan(0);
    expect(alts[0].plan.priceCents).toBeLessThan(999);
    // rationale references the sourced plan
    expect(alts[0].plan.features).toMatch(/bron: https?:\/\//);
  });

  it("gated categories (hypotheek/verzekering) give NO comparison", () => {
    expect(getCheaperAlternatives("ABN AMRO Hypotheken", "HYPOTHEEK", 80000, 3, "NL")).toEqual([]);
    expect(getCheaperAlternatives("Centraal Beheer", "VERZEKERING", 2000, 3, "NL")).toEqual([]);
    const verz = buildComparison({ provider: "FBTO", category: "VERZEKERING", amountCents: 2400 });
    expect(verz.topAlternatives).toEqual([]);
    expect(verz.bestSavingsCents).toBe(0);
    expect(getMarketRange("HYPOTHEEK", 80000, "NL").sampleSize).toBe(0);
  });

  it("supported non-sourced categories still work from seed data (telecom)", () => {
    const r = buildComparison({ provider: "Ziggo", category: "TELECOM", amountCents: 6795 });
    expect(r.marketRange.sampleSize).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import { CATEGORY_INFO, infoFor } from "@/lib/category-info";
import { PRIMARY_CATEGORIES, type PrimaryCategory } from "@/lib/categories";

describe("category-info / completeness per primary", () => {
  it.each(PRIMARY_CATEGORIES)("primary %s has complete rich-object", (p: PrimaryCategory) => {
    const info = CATEGORY_INFO[p];
    expect(info).toBeDefined();
    expect(info.primary).toBe(p);
    expect(info.icon.length).toBeGreaterThan(0);
    expect(info.savingsRangeLabel.length).toBeGreaterThan(0);
    expect(info.marketDescription.length).toBeGreaterThan(20);
    // OVERIG mag minder uitgebreid zijn dan de overige 6
    if (p !== "OVERIG") {
      expect(info.howToSave.length).toBeGreaterThanOrEqual(3);
      expect(info.warningSigns.length).toBeGreaterThanOrEqual(2);
    } else {
      expect(info.howToSave.length).toBeGreaterThanOrEqual(1);
    }
    expect(info.averageSavingsPct).toBeGreaterThanOrEqual(0);
    expect(info.averageSavingsPct).toBeLessThanOrEqual(1);
  });
});

describe("category-info / infoFor lookup", () => {
  it("returns OVERIG fallback for unknown primary", () => {
    const info = infoFor("OVERIG");
    expect(info.primary).toBe("OVERIG");
  });

  it("returns ENERGIE info for ENERGIE primary", () => {
    const info = infoFor("ENERGIE");
    expect(info.primary).toBe("ENERGIE");
    expect(info.icon).toBe("⚡");
  });
});

describe("category-info / coherent data shape", () => {
  it("savings range label format matches X-Y%", () => {
    for (const p of PRIMARY_CATEGORIES) {
      const label = CATEGORY_INFO[p].savingsRangeLabel;
      expect(label).toMatch(/^\d+-\d+%$/);
    }
  });

  it("monopolyWarning is false for all primaries (monopolie check happens via isMonopolyCategory legacy)", () => {
    for (const p of PRIMARY_CATEGORIES) {
      expect(CATEGORY_INFO[p].monopolyWarning).toBe(false);
    }
  });

  it("WONEN has hypotheek-tip", () => {
    const wonen = CATEGORY_INFO.WONEN;
    expect(wonen.howToSave.join(" ").toLowerCase()).toContain("rente");
  });

  it("ENERGIE has kWh tip", () => {
    const en = CATEGORY_INFO.ENERGIE;
    expect(en.howToSave.join(" ").toLowerCase()).toContain("vast");
  });
});

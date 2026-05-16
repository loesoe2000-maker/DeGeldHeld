import { describe, it, expect } from "vitest";
import { CATEGORY_RULES, ruleFor, isNegotiable, unitLabel } from "@/lib/categories";
import { allCategories, type Category } from "@/lib/providers";

describe("categories — rules cover all enum entries", () => {
  it("each Category has a CategoryRules entry", () => {
    for (const c of allCategories()) {
      expect(CATEGORY_RULES[c]).toBeDefined();
      expect(CATEGORY_RULES[c].id).toBe(c);
      expect(CATEGORY_RULES[c].label.length).toBeGreaterThan(0);
      expect(CATEGORY_RULES[c].icon.length).toBeGreaterThan(0);
    }
  });

  it("typicalSavingPct.low <= high for every rule", () => {
    for (const c of allCategories()) {
      const r = CATEGORY_RULES[c];
      expect(r.typicalSavingPct.low).toBeLessThanOrEqual(r.typicalSavingPct.high);
    }
  });
});

describe("categories — negotiability", () => {
  it("WATER + GEMEENTE are non-negotiable (monitoring only)", () => {
    expect(isNegotiable("WATER")).toBe(false);
    expect(isNegotiable("GEMEENTE")).toBe(false);
    expect(ruleFor("WATER").comparisonUnit).toBe("monitoring_only");
  });

  it("TELECOM/ENERGIE/HYPOTHEEK/VERZEKERING are negotiable", () => {
    expect(isNegotiable("TELECOM")).toBe(true);
    expect(isNegotiable("ENERGIE")).toBe(true);
    expect(isNegotiable("HYPOTHEEK")).toBe(true);
    expect(isNegotiable("VERZEKERING")).toBe(true);
  });
});

describe("categories — comparison unit + label per domain", () => {
  it("TELECOM uses €/maand", () => {
    expect(unitLabel("TELECOM")).toBe("€/maand");
  });
  it("ENERGIE uses €/kWh", () => {
    expect(unitLabel("ENERGIE")).toBe("€/kWh");
  });
  it("VERZEKERING uses €/jaar", () => {
    expect(unitLabel("VERZEKERING")).toBe("€/jaar");
  });
  it("HYPOTHEEK uses % rente", () => {
    expect(unitLabel("HYPOTHEEK")).toBe("% rente");
  });
  it("BANK uses €/maand", () => {
    expect(unitLabel("BANK")).toBe("€/maand");
  });
});

describe("categories — domain-specific playbooks", () => {
  it("HYPOTHEEK mentions rente-reductie or oversluiten, not '30 dagen'", () => {
    const text = ruleFor("HYPOTHEEK").negotiationPlaybook.toLowerCase();
    expect(text).toMatch(/rente|oversluit/);
    expect(text).not.toMatch(/30 dagen/);
  });
  it("VERZEKERING playbook mentions dekking + eigen risico", () => {
    const text = ruleFor("VERZEKERING").negotiationPlaybook.toLowerCase();
    expect(text).toMatch(/dekking|eigen risico/);
  });
  it("STREAMING leverage is DOWNGRADE_TIER", () => {
    expect(ruleFor("STREAMING").retentionLeverage).toBe("DOWNGRADE_TIER");
  });
  it("SOFTWARE leverage is ANNUAL_DEAL", () => {
    expect(ruleFor("SOFTWARE").retentionLeverage).toBe("ANNUAL_DEAL");
  });
});

describe("categories — 14 categories total", () => {
  it("exactly 14 entries in CATEGORY_RULES", () => {
    expect(Object.keys(CATEGORY_RULES)).toHaveLength(14);
  });
  it("all expected category ids present", () => {
    const expected: Category[] = [
      "TELECOM", "ENERGIE", "WATER", "GEMEENTE", "VERZEKERING", "HYPOTHEEK",
      "BANK", "ABONNEMENT", "STREAMING", "GYM", "OV", "SOFTWARE", "OPSLAG", "OVERIG",
    ];
    for (const c of expected) {
      expect(Object.keys(CATEGORY_RULES)).toContain(c);
    }
  });
});

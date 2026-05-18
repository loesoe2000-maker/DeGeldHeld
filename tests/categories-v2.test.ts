import { describe, it, expect } from "vitest";
import {
  PRIMARY_CATEGORIES,
  SUB_TYPES,
  PRIMARY_META,
  primaryFromLegacy,
  legacyFromPrimary,
  displayLabel,
  inferSubType,
  type PrimaryCategory,
} from "@/lib/categories";

describe("categories-v2 / PRIMARY_CATEGORIES", () => {
  it("has exactly 7 primary buckets", () => {
    expect(PRIMARY_CATEGORIES.length).toBe(7);
  });

  it("contains the expected 7 buckets", () => {
    expect(PRIMARY_CATEGORIES).toEqual([
      "TELECOM",
      "ENERGIE",
      "VERZEKERING",
      "WONEN",
      "FINANCIEN",
      "ABONNEMENTEN",
      "OVERIG",
    ]);
  });

  it("each primary has SUB_TYPES entry", () => {
    for (const p of PRIMARY_CATEGORIES) {
      expect(SUB_TYPES[p]).toBeDefined();
    }
  });

  it("each primary has PRIMARY_META entry with label + icon", () => {
    for (const p of PRIMARY_CATEGORIES) {
      const meta = PRIMARY_META[p];
      expect(meta.label).toBeTruthy();
      expect(meta.labelEn).toBeTruthy();
      expect(meta.icon).toBeTruthy();
    }
  });
});

describe("categories-v2 / backwards-compat (legacy → primary)", () => {
  it("TELECOM legacy → TELECOM primary", () => {
    expect(primaryFromLegacy("TELECOM")).toBe("TELECOM");
  });
  it("ENERGIE legacy → ENERGIE primary", () => {
    expect(primaryFromLegacy("ENERGIE")).toBe("ENERGIE");
  });
  it("VERZEKERING legacy → VERZEKERING primary", () => {
    expect(primaryFromLegacy("VERZEKERING")).toBe("VERZEKERING");
  });
  it("WATER legacy → WONEN primary", () => {
    expect(primaryFromLegacy("WATER")).toBe("WONEN");
  });
  it("GEMEENTE legacy → WONEN primary", () => {
    expect(primaryFromLegacy("GEMEENTE")).toBe("WONEN");
  });
  it("HYPOTHEEK legacy → WONEN primary", () => {
    expect(primaryFromLegacy("HYPOTHEEK")).toBe("WONEN");
  });
  it("BANK legacy → FINANCIEN primary", () => {
    expect(primaryFromLegacy("BANK")).toBe("FINANCIEN");
  });
  it("STREAMING legacy → ABONNEMENTEN primary", () => {
    expect(primaryFromLegacy("STREAMING")).toBe("ABONNEMENTEN");
  });
  it("SOFTWARE legacy → ABONNEMENTEN primary", () => {
    expect(primaryFromLegacy("SOFTWARE")).toBe("ABONNEMENTEN");
  });
  it("GYM legacy → ABONNEMENTEN primary", () => {
    expect(primaryFromLegacy("GYM")).toBe("ABONNEMENTEN");
  });
  it("OPSLAG legacy → ABONNEMENTEN primary", () => {
    expect(primaryFromLegacy("OPSLAG")).toBe("ABONNEMENTEN");
  });
  it("ABONNEMENT legacy → ABONNEMENTEN primary", () => {
    expect(primaryFromLegacy("ABONNEMENT")).toBe("ABONNEMENTEN");
  });
  it("OVERIG legacy → OVERIG primary", () => {
    expect(primaryFromLegacy("OVERIG")).toBe("OVERIG");
  });
});

describe("categories-v2 / reverse (primary → legacy)", () => {
  it("WONEN+hypotheek → HYPOTHEEK", () => {
    expect(legacyFromPrimary("WONEN", "hypotheek")).toBe("HYPOTHEEK");
  });
  it("WONEN+gemeente-belasting → GEMEENTE", () => {
    expect(legacyFromPrimary("WONEN", "gemeente-belasting")).toBe("GEMEENTE");
  });
  it("WONEN+huur → OVERIG (no exact legacy)", () => {
    expect(legacyFromPrimary("WONEN", "huur")).toBe("OVERIG");
  });
  it("FINANCIEN → BANK", () => {
    expect(legacyFromPrimary("FINANCIEN")).toBe("BANK");
  });
  it("ABONNEMENTEN+streaming → STREAMING", () => {
    expect(legacyFromPrimary("ABONNEMENTEN", "streaming")).toBe("STREAMING");
  });
});

describe("categories-v2 / displayLabel", () => {
  it("returns base when no sub-type", () => {
    expect(displayLabel("ENERGIE")).toBe("Energie");
  });
  it("appends sub-type with separator", () => {
    expect(displayLabel("ENERGIE", "stroom+gas")).toBe("Energie · stroom+gas");
  });
  it("supports english", () => {
    expect(displayLabel("ENERGIE", "stroom+gas", "en")).toBe("Energy · stroom+gas");
  });
});

describe("categories-v2 / inferSubType", () => {
  it("TELECOM Ziggo → internet", () => {
    expect(inferSubType("TELECOM", "Ziggo")).toBe("internet");
  });
  it("TELECOM Vodafone → mobiel", () => {
    expect(inferSubType("TELECOM", "Vodafone")).toBe("mobiel");
  });
  it("ENERGIE Eneco → stroom+gas", () => {
    expect(inferSubType("ENERGIE", "Eneco")).toBe("stroom+gas");
  });
  it("HYPOTHEEK ABN → hypotheek", () => {
    expect(inferSubType("HYPOTHEEK", "ABN AMRO Hypotheken")).toBe("hypotheek");
  });
  it("OVERIG Vitens → water (heuristic)", () => {
    expect(inferSubType("OVERIG", "Vitens")).toBe("water");
  });
  it("OVERIG random → null", () => {
    expect(inferSubType("OVERIG", "Unknown corp")).toBeNull();
  });
});

describe("categories-v2 / type-soundness of buckets", () => {
  it("every primary has at least 1 sub-type (except OVERIG)", () => {
    for (const p of PRIMARY_CATEGORIES) {
      if (p === "OVERIG") continue;
      expect(SUB_TYPES[p].length).toBeGreaterThan(0);
    }
  });

  it("primary set roundtrip preserves identity for unambiguous mappings", () => {
    const unambiguous: { primary: PrimaryCategory; sub: string }[] = [
      { primary: "TELECOM", sub: "mobiel" },
      { primary: "ENERGIE", sub: "stroom" },
      { primary: "ABONNEMENTEN", sub: "streaming" },
    ];
    for (const x of unambiguous) {
      const legacy = legacyFromPrimary(x.primary, x.sub);
      const back = primaryFromLegacy(legacy);
      expect(back).toBe(x.primary);
    }
  });
});

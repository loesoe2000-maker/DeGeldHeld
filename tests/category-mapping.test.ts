import { describe, it, expect } from "vitest";
import { primaryFromLegacy, PRIMARY_CATEGORIES, type PrimaryCategory } from "@/lib/categories";
import { allCategories } from "@/lib/providers";

describe("categories-v2 / mapping completeness", () => {
  it("every legacy enum maps to a valid primary", () => {
    for (const legacy of allCategories()) {
      const primary = primaryFromLegacy(legacy);
      expect(PRIMARY_CATEGORIES).toContain(primary);
    }
  });

  it("mapping is deterministic (same input → same output)", () => {
    for (const legacy of allCategories()) {
      const a = primaryFromLegacy(legacy);
      const b = primaryFromLegacy(legacy);
      expect(a).toBe(b);
    }
  });

  it("expected coverage distribution", () => {
    const counts: Record<PrimaryCategory, number> = {
      TELECOM: 0,
      ENERGIE: 0,
      VERZEKERING: 0,
      WONEN: 0,
      FINANCIEN: 0,
      ABONNEMENTEN: 0,
      OVERIG: 0,
    };
    for (const legacy of allCategories()) {
      counts[primaryFromLegacy(legacy)]++;
    }
    // WONEN absorbs WATER/GEMEENTE/HYPOTHEEK (3)
    expect(counts.WONEN).toBeGreaterThanOrEqual(3);
    // ABONNEMENTEN absorbs ABONNEMENT/STREAMING/GYM/SOFTWARE/OPSLAG (5)
    expect(counts.ABONNEMENTEN).toBeGreaterThanOrEqual(5);
    // FINANCIEN absorbs BANK (1)
    expect(counts.FINANCIEN).toBe(1);
  });
});

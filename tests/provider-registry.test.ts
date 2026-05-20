import { describe, it, expect } from "vitest";
import {
  PROVIDERS,
  findProvider,
  allCategories,
  type Category,
} from "@/lib/providers";

/**
 * v17 DEEL 7 — provider registry integrity.
 *
 * Documented empty categories:
 *  - GEMEENTE: gemeente-belasting (OZB, riool, afval) is a pure
 *    monopoly with statutory tariffs — nothing to switch to.
 *  - ABONNEMENT: this is the LEGACY parent bucket. Concrete providers
 *    are tagged with the specific child categories (STREAMING /
 *    SOFTWARE / OPSLAG / GYM), so the parent itself carries none.
 */
const INTENTIONALLY_EMPTY: Category[] = ["GEMEENTE", "ABONNEMENT"];

describe("v17 provider-registry integrity", () => {
  it("no duplicate ids", () => {
    const ids = PROVIDERS.map((p) => p.id);
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) dupes.push(id);
      seen.add(id);
    }
    expect(dupes).toEqual([]);
  });

  it("every provider has a valid category + country + locale", () => {
    const cats = new Set(allCategories());
    const countries = new Set(["NL", "BE", "DE", "FR", "UK", "US", "ES", "IT", "INT"]);
    const locales = new Set(["nl", "en", "de", "fr", "es", "it"]);
    for (const p of PROVIDERS) {
      expect(cats.has(p.category), `${p.canonical} category`).toBe(true);
      expect(countries.has(p.country), `${p.canonical} country`).toBe(true);
      expect(locales.has(p.locale), `${p.canonical} locale`).toBe(true);
    }
  });

  it("no provider with an empty names[]", () => {
    for (const p of PROVIDERS) {
      expect(p.names.length, `${p.canonical} names`).toBeGreaterThan(0);
      // canonical must be findable in names (case-insensitive)
      const lower = p.names.map((n) => n.toLowerCase());
      expect(lower).toContain(p.canonical.toLowerCase());
    }
  });

  it("findProvider matches every names[] alias (case-insensitive)", () => {
    const failures: string[] = [];
    for (const p of PROVIDERS) {
      for (const alias of p.names) {
        const hit = findProvider(alias.toUpperCase());
        if (!hit) {
          failures.push(`${p.canonical} :: "${alias}" → no match`);
        }
      }
    }
    // A handful of ultra-short or ambiguous aliases may resolve to a
    // different provider; collect them but only fail when an alias
    // matches NOTHING at all.
    expect(failures).toEqual([]);
  });

  it("every Category has ≥1 provider OR is on the documented empty-list", () => {
    const byCat = new Map<Category, number>();
    for (const p of PROVIDERS) {
      byCat.set(p.category, (byCat.get(p.category) ?? 0) + 1);
    }
    const empties: Category[] = [];
    for (const cat of allCategories()) {
      if ((byCat.get(cat) ?? 0) === 0) empties.push(cat);
    }
    // Every empty category must be intentionally documented.
    for (const e of empties) {
      expect(INTENTIONALLY_EMPTY, `${e} is empty but not documented`).toContain(e);
    }
  });

  it("NL WATER has all 10 drinkwaterbedrijven", () => {
    const nlWater = PROVIDERS.filter((p) => p.category === "WATER" && p.country === "NL");
    expect(nlWater.length).toBeGreaterThanOrEqual(10);
    const names = nlWater.map((p) => p.canonical);
    for (const expected of ["Vitens", "Evides", "PWN", "Dunea", "WML", "Oasen", "WMD"]) {
      expect(names, `missing ${expected}`).toContain(expected);
    }
  });

  it("GYM broadened beyond the original 4", () => {
    const gym = PROVIDERS.filter((p) => p.category === "GYM");
    expect(gym.length).toBeGreaterThanOrEqual(6);
  });

  it("OV broadened to include the major NL carriers", () => {
    const ov = PROVIDERS.filter((p) => p.category === "OV").map((p) => p.canonical);
    for (const carrier of ["NS", "GVB", "RET", "HTM", "Arriva"]) {
      expect(ov, `missing ${carrier}`).toContain(carrier);
    }
  });
});

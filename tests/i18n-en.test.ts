import { describe, it, expect } from "vitest";
import {
  EN_HERO,
  EN_TILES,
  EN_HOW_IT_WORKS,
  EN_TRUST,
} from "@/lib/i18n-en";

/**
 * v38 uitbreiding A — Engelstalige landing-copy. Borgt dat de tegels naar
 * BESTAANDE NL-check-routes wijzen (geen dode links) en dat de eerlijke
 * kernpunten in de copy staan (NL-paperwork + KvK + no cure no pay).
 */

// De routes die op prod bestaan (uit de app/-structuur). De EN-tegels mogen
// alleen hiernaar linken — anders 404 voor een internationale bezoeker.
const BESTAANDE_CHECK_ROUTES = new Set([
  "/box3-check",
  "/huurcommissie-check",
  "/energie-claim-check",
  "/geld-check",
  "/zorgkosten-check",
  "/ns-check",
  "/vluchtclaim",
]);

describe("EN landing copy — structuur", () => {
  it("hero heeft titel + subtitle + twee CTA's", () => {
    expect(EN_HERO.title.length).toBeGreaterThan(10);
    expect(EN_HERO.subtitle.length).toBeGreaterThan(40);
    expect(EN_HERO.ctaPrimary).toBeTruthy();
    expect(EN_HERO.ctaSecondary).toBeTruthy();
  });

  it("elke tegel linkt naar een BESTAANDE NL-check-route", () => {
    expect(EN_TILES.length).toBeGreaterThanOrEqual(3);
    for (const t of EN_TILES) {
      expect(
        BESTAANDE_CHECK_ROUTES.has(t.href),
        `EN-tegel "${t.title}" linkt naar ${t.href} — bestaat die route wel?`,
      ).toBe(true);
      expect(t.title.length).toBeGreaterThan(3);
      expect(t.body.length).toBeGreaterThan(30);
      expect(t.emoji).toBeTruthy();
    }
  });

  it("how-it-works heeft 4 genummerde stappen", () => {
    expect(EN_HOW_IT_WORKS).toHaveLength(4);
    expect(EN_HOW_IT_WORKS.map((s) => s.n)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("EN landing copy — eerlijkheid + juridische correctheid", () => {
  it("noemt expliciet dat de officiële filings Nederlands zijn", () => {
    const alleTekst = [
      EN_HERO.subtitle,
      ...EN_HOW_IT_WORKS.map((s) => s.body),
      EN_TRUST.disclaimer,
    ]
      .join(" ")
      .toLowerCase();
    expect(alleTekst).toMatch(/dutch/);
  });

  it("disclaimer noemt Techz B.V. + het juiste KvK-nummer", () => {
    expect(EN_TRUST.disclaimer).toMatch(/Techz B\.V\./);
    expect(EN_TRUST.disclaimer).toMatch(/84079398/);
    // Nooit het oude placeholder-KvK.
    expect(EN_TRUST.disclaimer).not.toMatch(/00000000/);
  });

  it("disclaimer zegt dat indicaties geen financieel/fiscaal advies zijn (AFM-gate)", () => {
    expect(EN_TRUST.disclaimer.toLowerCase()).toMatch(/not financial|not.*advice/);
  });

  it("no-cure-no-pay staat in de how-it-works", () => {
    const joined = EN_HOW_IT_WORKS.map((s) => `${s.title} ${s.body}`).join(" ").toLowerCase();
    expect(joined).toMatch(/no cure, no pay|pay nothing/);
  });
});

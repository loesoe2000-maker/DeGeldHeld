import { describe, it, expect } from "vitest";
import {
  EN_HERO,
  EN_TILES,
  EN_HOW_IT_WORKS,
  EN_FEE_NOTE,
  EN_TRUST,
} from "@/lib/i18n-en";
import { FLAG_DEFAULTS } from "@/lib/feature-flags";

/**
 * v38 uitbreiding A — Engelstalige landing-copy. Borgt naast structuur ook
 * de launch-review-bevindingen (elke test hieronder was eerst een echte fout
 * of overclaim in de copy — laat ze niet terugkomen).
 */

// De routes die op prod bestaan. De EN-tegels mogen alleen hiernaar linken.
const BESTAANDE_CHECK_ROUTES = new Set([
  "/box3-check",
  "/huurcommissie-check",
  "/energie-claim-check",
  "/geld-check",
  "/zorgkosten-check",
  "/ns-check",
  "/vluchtclaim",
]);

/** Alle publieke EN-copy aan elkaar, voor overclaim-checks. */
function alleCopy(): string {
  return [
    EN_HERO.title,
    EN_HERO.subtitle,
    ...EN_TILES.map((t) => `${t.title} ${t.body}`),
    ...EN_HOW_IT_WORKS.map((s) => `${s.title} ${s.body}`),
    EN_FEE_NOTE,
    EN_TRUST.disclaimer,
  ].join(" ");
}

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

  it("elke tegel draagt een geldige feature-flag (page filtert dooie tegels weg)", () => {
    for (const t of EN_TILES) {
      expect(
        Object.prototype.hasOwnProperty.call(FLAG_DEFAULTS, t.flag),
        `EN-tegel "${t.title}" heeft onbekende flag ${t.flag}`,
      ).toBe(true);
    }
  });

  it("how-it-works heeft 4 genummerde stappen", () => {
    expect(EN_HOW_IT_WORKS).toHaveLength(4);
    expect(EN_HOW_IT_WORKS.map((s) => s.n)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("EN landing copy — eerlijkheid + juridische correctheid", () => {
  it("Box 3: Hoge Raad-arresten gedateerd op juni 2024, NIET als 2025-uitspraak", () => {
    const box3 = EN_TILES.find((t) => t.href === "/box3-check");
    expect(box3).toBeDefined();
    expect(box3?.body).toMatch(/June 2024/);
    // De launch-review vond letterlijk "the 2025 Supreme Court ruling" — fout.
    expect(alleCopy()).not.toMatch(/2025 Supreme Court/i);
  });

  it("geen 'we handle the paperwork/complaint'-overclaim — wij bereiden voor, klant dient in", () => {
    expect(alleCopy()).not.toMatch(/we handle the (dutch )?paperwork/i);
    expect(alleCopy()).not.toMatch(/we handle the complaint/i);
    expect(alleCopy().toLowerCase()).toMatch(/you submit/);
  });

  it("v41 GRATIS: 'free' mag nu, mits de leges van derden erbij staan", () => {
    expect(alleCopy()).toMatch(/free/i);
    // De enige reden dat "free" eerlijk is: de leges staan er expliciet bij.
    expect(EN_FEE_NOTE).toMatch(/€\s?25/);
    expect(EN_FEE_NOTE).toMatch(/not to us/i);
  });

  it("v41 GRATIS: nergens meer een eigen fee-percentage", () => {
    expect(alleCopy()).not.toMatch(/\b20\s?%/);
    expect(alleCopy()).not.toMatch(/\b25\s?%/);
    expect(alleCopy()).not.toMatch(/our fee/i);
    expect(EN_HOW_IT_WORKS[3].title).toMatch(/free/i);
  });

  it("fee-noot noemt de voorgeschoten leges (€ 25 / € 27,50 + € 52,50) + gratis onder drempel", () => {
    expect(EN_FEE_NOTE).toMatch(/€\s?25(?![.,]\d)/);
    expect(EN_FEE_NOTE).toMatch(/€\s?27\.50/);
    expect(EN_FEE_NOTE).toMatch(/€\s?52\.50/);
    expect(EN_FEE_NOTE.toLowerCase()).toMatch(/advance|yourself/);
    // v41: geen eigen drempel meer; wel expliciet dat het geld naar hén gaat.
    expect(EN_FEE_NOTE).toMatch(/not to us/i);
  });

  it("noemt expliciet dat de officiële filings Nederlands zijn", () => {
    expect(alleCopy().toLowerCase()).toMatch(/dutch/);
  });

  it("disclaimer noemt Techz B.V. + het juiste KvK-nummer", () => {
    expect(EN_TRUST.disclaimer).toMatch(/Techz B\.V\./);
    expect(EN_TRUST.disclaimer).toMatch(/84079398/);
    expect(EN_TRUST.disclaimer).not.toMatch(/00000000/);
  });

  it("disclaimer zegt dat indicaties geen financieel/fiscaal advies zijn (AFM-gate)", () => {
    expect(EN_TRUST.disclaimer.toLowerCase()).toMatch(/not financial|not.*advice/);
  });

  it("geen kwantitatieve doelgroep-claims zonder bron ('often left unclaimed')", () => {
    expect(alleCopy()).not.toMatch(/often left unclaimed/i);
  });
});

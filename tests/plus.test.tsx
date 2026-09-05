import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import {
  PLUS_PILLARS,
  PLUS_PRICE,
  RECHECK_CADENCE_DAYS,
  shouldRecheckBenefits,
  daysSince,
  crossesYearBoundary,
  nextRecheckDue,
} from "@/lib/plus";

/**
 * v28 DEEL 3 — DeGeldHeld Plus. We testen de pure her-check-cadence (zodat
 * een toekomstige scheduler hierop kan leunen) + dat de pagina de drie waarde-
 * pijlers en de prijsband uit lib/plus laat zien (geen verzonnen content).
 */
describe("plus — her-check cadence (pure)", () => {
  const now = new Date("2026-06-01T12:00:00Z");

  it("recently checked (< 90 dagen, zelfde jaar) → niet due", () => {
    const last = new Date("2026-04-15T00:00:00Z").toISOString(); // ~47 dagen geleden
    expect(daysSince(last, now)).toBeLessThan(RECHECK_CADENCE_DAYS);
    expect(crossesYearBoundary(last, now)).toBe(false);
    expect(shouldRecheckBenefits(last, now)).toBe(false);
  });

  it("≥ 90 dagen geleden → due", () => {
    const last = new Date("2026-02-01T00:00:00Z").toISOString();
    expect(daysSince(last, now)).toBeGreaterThanOrEqual(RECHECK_CADENCE_DAYS);
    expect(shouldRecheckBenefits(last, now)).toBe(true);
  });

  it("vorig kalenderjaar → due (nieuwe grenzen per 1 januari)", () => {
    const last = new Date("2025-12-15T00:00:00Z").toISOString();
    // 168 dagen geleden, dus ook >cadence; maar belangrijker: jaargrens.
    expect(crossesYearBoundary(last, now)).toBe(true);
    expect(shouldRecheckBenefits(last, now)).toBe(true);
  });

  it("nog nooit gecheckt → due", () => {
    expect(shouldRecheckBenefits(null, now)).toBe(true);
  });

  it("nextRecheckDue: cadence + jaargrens — pak de vroegste", () => {
    // Last check eind oktober: jaargrens (1 jan) ligt eerder dan cadence (~28 jan).
    const lastOct = new Date("2026-10-30T00:00:00Z").toISOString();
    const due1 = nextRecheckDue(lastOct);
    expect(due1.toISOString()).toBe("2027-01-01T00:00:00.000Z");

    // Last check halverwege het jaar: cadence (≈ 90d later) ligt eerder dan jaargrens.
    const lastJun = new Date("2026-06-01T00:00:00Z").toISOString();
    const due2 = nextRecheckDue(lastJun);
    expect(due2.toISOString()).toBe("2026-08-30T00:00:00.000Z");
  });

  it("ongeldige datum-string → 'lang geleden' / due", () => {
    expect(daysSince("not-a-date")).toBe(Number.POSITIVE_INFINITY);
    expect(crossesYearBoundary("not-a-date")).toBe(true);
    expect(shouldRecheckBenefits("not-a-date")).toBe(true);
  });
});

describe("plus — value-propositie", () => {
  it("heeft de 6 pijlers v30+v35: rescan, hercheck, alerts, nsclaim, telecom_belscript, claim_monitor", () => {
    expect(PLUS_PILLARS.map((p) => p.id)).toEqual([
      "rescan",
      "hercheck",
      "alerts",
      "nsclaim",
      "telecom_belscript",
      // v35 — huurcommissie + energie-claim auto-monitor (positionering;
      // GEEN echte cron-job in V35, V36 mogelijk implementation).
      "claim_monitor",
    ]);
    for (const p of PLUS_PILLARS) {
      expect(p.title.length).toBeGreaterThan(8);
      expect(p.body.length).toBeGreaterThan(40);
    }
  });

  it("prijsband is realistisch (€2,99 - €4,99 indicatief)", () => {
    expect(PLUS_PRICE.lowEur).toBeGreaterThan(0);
    expect(PLUS_PRICE.highEur).toBeGreaterThan(PLUS_PRICE.lowEur);
    expect(PLUS_PRICE.lowEur).toBeLessThan(10);
    expect(PLUS_PRICE.highEur).toBeLessThan(10);
  });
});

describe("plus — v41: /plus bestaat niet meer als betaald product", () => {
  it("de pagina redirect in plaats van een abonnement aan te bieden", () => {
    const src = readFileSync(
      path.join(__dirname, "../app/plus/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/redirect\("\/prijs"\)/);
    // Geen enkele UI meer: geen knop, geen link, geen prijskaart.
    expect(src).not.toMatch(/<Link|<button|className=/);
  });
});

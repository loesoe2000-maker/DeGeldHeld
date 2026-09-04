import { describe, it, expect } from "vitest";
import {
  nettoBesparingBand,
  HUURTOESLAG_PARAMS,
  TERUGNAME_ONDER_KKG,
} from "@/lib/huurtoeslag";

/**
 * v40 F3 — huurtoeslag-terugname. Alle bedragen uit de Regeling
 * huurtoeslaggrenzen 2026 (Stcrt. 2025, 39783) + Wht/Bht geldend 1-1-2026.
 * De werkvoorbeelden zijn met de hand narekenbaar.
 */

const VANDAAG = new Date(2026, 8, 4);

describe("huurtoeslag — parameters 2026", () => {
  const cfg = HUURTOESLAG_PARAMS["2026"];
  it("de gepubliceerde grenzen staan er exact in", () => {
    expect(cfg.kwaliteitskortingsgrensCents).toBe(49820); // € 498,20
    expect(cfg.aftoppingsgrensKleinCents).toBe(71302); // € 713,02 (1-2 pers)
    expect(cfg.aftoppingsgrensGrootCents).toBe(76414); // € 764,14 (3+ pers)
    expect(cfg.maximaleHuurgrensCents).toBe(93293); // € 932,93
    expect(cfg.basishuurEenpersoonsCents).toBe(20252); // € 202,52
  });

  it("de config is jaargebonden — er staat een houdbaarheidsdatum in", () => {
    expect(cfg.geldigTot).toBe("2027-01-01");
  });
});

describe("huurtoeslag — marginale terugname per schijf", () => {
  const band = (huidig: number, nieuw: number, bewoners = 1, toeslag = true) =>
    nettoBesparingBand({
      huidigeKaleHuurCents: huidig,
      nieuweKaleHuurCents: nieuw,
      ontvangtHuurtoeslag: toeslag,
      aantalBewoners: bewoners,
      vandaag: VANDAAG,
    });

  it("zonder huurtoeslag is netto gelijk aan bruto", () => {
    const r = band(80_000, 70_000, 1, false);
    expect(r.brutoPerMaandCents).toBe(10_000);
    expect(r.nettoOndergrensPerMaandCents).toBe(10_000);
    expect(r.volledigTeruggenomen).toBe(false);
  });

  it("officieel werkvoorbeeld: € 800 → € 700 geeft netto € 56,75 van € 100", () => {
    // € 800,00 → € 713,02 = € 86,98 in de 40%-schijf → verlies € 34,79
    // € 713,02 → € 700,00 = € 13,02 in de 65%-schijf → verlies €  8,46
    const r = band(80_000, 70_000);
    expect(r.brutoPerMaandCents).toBe(10_000);
    expect(r.nettoOndergrensPerMaandCents).toBe(5675); // € 56,75
  });

  it("worst case: volledig in de 65%-schijf → netto 35% van de verlaging", () => {
    const r = band(60_000, 50_000);
    expect(r.nettoOndergrensPerMaandCents).toBe(3500); // € 35,00
  });

  it("onder de kwaliteitskortingsgrens levert een verlaging NIETS op", () => {
    expect(TERUGNAME_ONDER_KKG).toBe(1.0);
    const r = band(45_000, 35_000); // beide onder € 498,20
    expect(r.brutoPerMaandCents).toBe(10_000);
    expect(r.nettoOndergrensPerMaandCents).toBe(0);
    expect(r.volledigTeruggenomen).toBe(true);
  });

  it("boven de maximale huurgrens is er geen terugname", () => {
    const r = band(120_000, 100_000); // beide boven € 932,93
    expect(r.nettoOndergrensPerMaandCents).toBe(20_000);
    expect(r.volledigTeruggenomen).toBe(false);
  });

  it("bij 3+ bewoners geldt de hogere aftoppingsgrens (€ 764,14)", () => {
    const klein = band(80_000, 70_000, 2); // aftopping € 713,02
    const groot = band(80_000, 70_000, 3); // aftopping € 764,14
    // Contra-intuïtief maar correct: een HOGERE aftoppingsgrens betekent dat
    // méér van de verlaging in de 65%-schijf valt in plaats van de 40%-schijf,
    // dus gaat er méér toeslag verloren en houdt de huurder MINDER over.
    // € 800→764,14 (40%) + € 764,14→700 (65%) = verlies € 56,03 → netto € 43,97.
    expect(groot.nettoOndergrensPerMaandCents).toBe(4397);
    expect(klein.nettoOndergrensPerMaandCents).toBe(5675);
    expect(groot.nettoOndergrensPerMaandCents).toBeLessThan(
      klein.nettoOndergrensPerMaandCents,
    );
  });

  it("de bovengrens is altijd de bruto verlaging (toeslag kan al nul zijn)", () => {
    const r = band(60_000, 50_000);
    expect(r.nettoBovengrensPerMaandCents).toBe(10_000);
    expect(r.nettoOndergrensPerMaandCents).toBeLessThan(r.nettoBovengrensPerMaandCents);
  });

  it("verlopen parameterset → geen netto bedrag, alleen de vlag", () => {
    const r = nettoBesparingBand({
      huidigeKaleHuurCents: 80_000,
      nieuweKaleHuurCents: 70_000,
      ontvangtHuurtoeslag: true,
      aantalBewoners: 1,
      vandaag: new Date(2028, 0, 1), // buiten geldigTot
    });
    expect(r.configVerlopen).toBe(true);
    expect(r.nettoOndergrensPerMaandCents).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  berekenWwsPunten,
  rondRubriek,
  rondOppervlakteSom,
  labelUitBouwjaar,
  maxHuurBand2026Cents,
  maxHuur2026Cents,
  MAX_HUUR_TABEL_2026_CENTS,
  ENERGIE_PUNTEN,
  LAAG_SEGMENT_MAX_PUNTEN_2026,
  MIDDENHUUR_MAX_PUNTEN_2026,
  type WwsInput,
} from "@/lib/wws-punten";
import { FLAG_DEFAULTS } from "@/lib/feature-flags";

/**
 * v40 F2 — elke verwachtingswaarde hieronder is met de hand narekenbaar uit
 * docs/V40_DATA_WWS_2026.md (gesourcet uit BHW Bijlage I-A, geldend 2026).
 * Dit zijn unit-borgtests; de kalibratie tegen de officiële Huurprijscheck
 * (≥ 10 adressen) is een aparte F2b-gate vóór de flag aan mag.
 */

const basisInput: WwsInput = {
  woonvorm: "meergezins",
  vertrekken: [
    { m2: 18, verwarmd: true },
    { m2: 12, verwarmd: true },
    { m2: 10, verwarmd: true },
    { m2: 6, verwarmd: true },
  ],
  overigeRuimten: [{ m2: 5 }],
  aanrechtLengteCm: 180,
  sanitair: { toilettenAparteRuimte: 1, wastafels: 1, douches: 1 },
  buitenruimten: { priveM2: 6 },
  woz: { waardeEuro: 300_000, gebruiksoppervlakM2: 60 },
  energie: { label: "A" },
  bijzonder: { videoIntercom: true },
};

describe("wws-punten — afronding en label-fallback", () => {
  it("rubriekafronding op 0,25 met 1/8 naar boven", () => {
    expect(rondRubriek(4.1)).toBe(4.0);
    expect(rondRubriek(4.125)).toBe(4.25);
    expect(rondRubriek(4.24)).toBe(4.25);
    expect(rondRubriek(36.3516)).toBe(36.25);
  });

  it("bouwjaar → label-fallback volgt de BHW-kolom", () => {
    expect(labelUitBouwjaar(2005)).toBe("A");
    expect(labelUitBouwjaar(2001)).toBe("B");
    expect(labelUitBouwjaar(1995)).toBe("C");
    expect(labelUitBouwjaar(1990)).toBe("D");
    expect(labelUitBouwjaar(1980)).toBe("E");
    expect(labelUitBouwjaar(1977)).toBe("F");
    expect(labelUitBouwjaar(1970)).toBe("G");
  });

  it("energietabel: label A eengezins 41 / meergezins 37; G −15 beide", () => {
    expect(ENERGIE_PUNTEN.eengezins.A).toBe(41);
    expect(ENERGIE_PUNTEN.meergezins.A).toBe(37);
    expect(ENERGIE_PUNTEN.eengezins.G).toBe(-15);
    expect(ENERGIE_PUNTEN.meergezins.G).toBe(-15);
  });
});

describe("wws-punten — integrale handberekening (meergezins, label A)", () => {
  it("komt exact uit op 147 punten met de verwachte rubrieksplitsing", () => {
    const r = berekenWwsPunten(basisInput);
    expect(r.rubrieken.oppervlakteVertrekken).toBe(46); // 18+12+10+6
    expect(r.rubrieken.oppervlakteOverigeRuimten).toBe(3.75); // 5 × 0,75
    expect(r.rubrieken.verwarmingEnVerkoeling).toBe(8); // 4 vertrekken × 2
    expect(r.rubrieken.energieprestatie).toBe(37); // meergezins A
    expect(r.rubrieken.keuken).toBe(4); // aanrecht 1–2 m
    expect(r.rubrieken.sanitair).toBe(8); // 3 + 1 + 4
    expect(r.rubrieken.buitenruimten).toBe(4.0); // 2 + 6×0,35 = 4,1 → 4,0
    expect(r.rubrieken.wozPunten).toBe(36.25); // 17,695 + 18,657 → 36,25
    expect(r.rubrieken.bijzondereVoorzieningen).toBe(0.25); // video-intercom
    expect(r.totaalPunten).toBe(147); // 147,25 → 147
    expect(r.wozCapToegepast).toBe(false);
  });
});

describe("wws-punten — caps en bijzondere regels", () => {
  it("keuken- en sanitair-extra's zijn gecapt op verdubbeling (BHW 5.2/6.2)", () => {
    const r = berekenWwsPunten({
      ...basisInput,
      aanrechtLengteCm: 250,
      keukenExtraPunten: 100,
      sanitair: { ...basisInput.sanitair, extraPunten: 100 },
    });
    expect(r.rubrieken.keuken).toBe(14); // 7 + max 7
    expect(r.rubrieken.sanitair).toBe(12); // (3+1+4) + max 4 (alleen douche)
  });

  it("verwarmde overige ruimten max 4; verkoeling max 2", () => {
    const r = berekenWwsPunten({
      ...basisInput,
      vertrekken: basisInput.vertrekken.map((v) => ({ ...v, verkoeld: true })),
      overigeRuimten: [1, 2, 3, 4, 5, 6].map(() => ({ m2: 2, verwarmd: true })),
    });
    // 4×2 (vertrekken) + 4 (overige, gecapt) + 2 (verkoeling, gecapt) = 14
    expect(r.rubrieken.verwarmingEnVerkoeling).toBe(14);
  });

  it("géén buitenruimte kost 5 punten (BHW rubriek 8)", () => {
    const r = berekenWwsPunten({ ...basisInput, buitenruimten: { geen: true } });
    expect(r.rubrieken.buitenruimten).toBe(-5);
  });

  it("WOZ-cap: totaal wordt floor(rest ÷ 0,67) — gekalibreerde formule", () => {
    const groot: WwsInput = {
      ...basisInput,
      woonvorm: "eengezins",
      vertrekken: [
        { m2: 30, verwarmd: true },
        { m2: 25, verwarmd: true },
        { m2: 20, verwarmd: true },
        { m2: 15, verwarmd: true },
        { m2: 10, verwarmd: true },
      ],
      overigeRuimten: [],
      aanrechtLengteCm: 250,
      keukenExtraPunten: 7,
      sanitair: { hangendeToilettenAparteRuimte: 1, wastafels: 1, badDouches: 1 },
      buitenruimten: { geen: true },
      energie: { label: "A++++" },
      bijzonder: {},
      woz: { waardeEuro: 2_000_000, gebruiksoppervlakM2: 80 },
    };
    const r = berekenWwsPunten(groot);
    // rest: 100 + 10 + 62 + 14 + 11,75 − 5 = 192,75; ruwe WOZ ≈ 211 → cap:
    // floor(192,75 ÷ 0,67) = 287 → woz = 287 − 192,75 = 94,25.
    expect(r.wozCapToegepast).toBe(true);
    expect(r.rubrieken.wozPunten).toBe(94.25);
    expect(r.totaalPunten).toBe(287);
  });

  it("nieuwbouw 2015-2019: minimaal 40 WOZ-punten bij rest ≥ 110 (BHW 11.2)", () => {
    const r = berekenWwsPunten({
      ...basisInput,
      woz: {
        waardeEuro: 150_000,
        gebruiksoppervlakM2: 50,
        nieuwbouw2015_2019: true,
      },
    });
    expect(r.wozMinimum40Toegepast).toBe(true);
    expect(r.rubrieken.wozPunten).toBe(40);
  });

  it("kleine nieuwbouw Amsterdam/Utrecht gebruikt deler € 114 (BHW 11.1a)", () => {
    // Bewust ónder de 187-puntendrempel gehouden zodat dit de deler test,
    // niet de cap (die interactie test de cap-case hierboven).
    const zonder = berekenWwsPunten({
      ...basisInput,
      woz: { waardeEuro: 150_000, gebruiksoppervlakM2: 30 },
    });
    const met = berekenWwsPunten({
      ...basisInput,
      woz: {
        waardeEuro: 150_000,
        gebruiksoppervlakM2: 30,
        kleineNieuwbouwAmsterdamUtrecht: true,
      },
    });
    expect(zonder.rubrieken.wozPunten).toBe(27.5); // 8,848 + 18,657 → 27,5
    expect(met.rubrieken.wozPunten).toBe(52.75); // 8,848 + 43,860 → 52,75
    expect(met.wozCapToegepast).toBe(false);
  });

  it("zorgwoning: +35% over 1 t/m 11.1, exclusief rubriek-12-punten", () => {
    const r = berekenWwsPunten({
      ...basisInput,
      bijzonder: { ...basisInput.bijzonder, zorgwoning: true },
    });
    // (111 − 0,25 + 36,25) × 0,35 = 51,45 → 51,5
    expect(r.rubrieken.zorgwoningOpslag).toBe(51.5);
    expect(r.totaalPunten).toBe(199); // 147,25 + 51,5 → 198,75 → 199
  });
});

describe("wws-punten — maximale huurprijs 2026 (ankers + conservatieve band)", () => {
  it("segmentgrenzen 2026 kloppen met de officiële tabel", () => {
    expect(LAAG_SEGMENT_MAX_PUNTEN_2026).toBe(143);
    expect(MIDDENHUUR_MAX_PUNTEN_2026).toBe(186);
    expect(maxHuurBand2026Cents(143).exactCents).toBe(93293);
    expect(maxHuurBand2026Cents(186).exactCents).toBe(122807);
  });

  it("volledige tabel: 211 rijen, strikt oplopend, plausibele stappen", () => {
    expect(MAX_HUUR_TABEL_2026_CENTS).toHaveLength(211);
    for (let i = 1; i < MAX_HUUR_TABEL_2026_CENTS.length; i++) {
      const stap = MAX_HUUR_TABEL_2026_CENTS[i] - MAX_HUUR_TABEL_2026_CENTS[i - 1];
      expect(stap).toBeGreaterThanOrEqual(550);
      expect(stap).toBeLessThanOrEqual(750);
    }
  });

  it("na de tabel-import is elke waarde in 40–250 exact (band == exact)", () => {
    const band = maxHuurBand2026Cents(147);
    expect(band.exactCents).toBe(96033); // officiële rij 147 → € 960,33
    expect(band.ondergrensCents).toBe(96033);
    expect(band.bovengrensCents).toBe(96033);
    expect(maxHuur2026Cents(40)).toBe(25026);
    expect(maxHuur2026Cents(250)).toBe(166740);
  });

  it("buiten 40–250 punten: null (geen extrapolatie)", () => {
    expect(maxHuurBand2026Cents(30).bovengrensCents).toBeNull();
    expect(maxHuur2026Cents(300)).toBeNull();
    expect(maxHuur2026Cents(147.5)).toBeNull(); // alleen hele punten
  });
});

describe("wws-punten — F2b-regels uit het Beleidsboek", () => {
  it("oppervlakte: som per categorie eerst op hele m² (Beleidsboek §2.4-voorbeeld)", () => {
    // Officieel rekenvoorbeeld: garage 19,34 + bijkeuken 6,06 = 25,40 → 25 m².
    expect(rondOppervlakteSom([3.16 * 6.12, 2.11 * 2.87])).toBe(25);
    expect(rondOppervlakteSom([18.3, 11.9])).toBe(30); // 30,2 → 30
    const r = berekenWwsPunten({
      ...basisInput,
      overigeRuimten: [{ m2: 3.16 * 6.12 }, { m2: 2.11 * 2.87 }],
    });
    expect(r.rubrieken.oppervlakteOverigeRuimten).toBe(18.75); // 25 × 0,75
  });

  it("monument: geen minpunten voor energie — label G wordt 0 (Beleidsboek 4.2)", () => {
    const r = berekenWwsPunten({
      ...basisInput,
      energie: { label: "G" },
      bijzonder: { monument: "rijksmonument" },
    });
    expect(r.rubrieken.energieprestatie).toBe(0);
  });

  it("EPV overeengekomen: vast 32 (eengezins) / 28 (meergezins) — Beleidsboek 4.3", () => {
    const r = berekenWwsPunten({ ...basisInput, energie: { label: "A", epv: true } });
    expect(r.rubrieken.energieprestatie).toBe(28);
    const r2 = berekenWwsPunten({
      ...basisInput,
      woonvorm: "eengezins",
      energie: { epv: true },
    });
    expect(r2.rubrieken.energieprestatie).toBe(32);
  });

  it("kleine woning (overgangsrecht 2021–1-7-2024): <25 m² label A meergezins → 45", () => {
    const r = berekenWwsPunten({
      ...basisInput,
      energie: { label: "A", kleineWoningKlasse: "<25" },
    });
    expect(r.rubrieken.energieprestatie).toBe(45);
  });

  it("rubriek 9/10: gedeelde binnenruimte en parkeerplek gedeeld door adressen", () => {
    const r = berekenWwsPunten({
      ...basisInput,
      gemeenschappelijkeBinnenruimten: { overigeRuimten: [{ m2: 40, adressen: 10 }] },
      gemeenschappelijkeParkeerruimten: [{ type: 2, adressen: 2 }],
    });
    expect(r.rubrieken.gemeenschappelijkeRuimten).toBe(3); // 40×0,75÷10
    expect(r.rubrieken.gemeenschappelijkeParkeerruimte).toBe(3); // 6÷2
  });
});

describe("wws-punten — KALIBRATIE cases 2-10 (officiële wizard, 4-9-2026)", () => {
  // Skelet: woonkamer 20 m² verwarmd, geen buitenruimte, meergezins label A,
  // WOZ € 250.000 — per case wordt één regel gevarieerd, met de door de
  // officiële Huurprijscheck getoonde uitkomst als verwachting.
  const skelet: WwsInput = {
    woonvorm: "meergezins",
    vertrekken: [{ m2: 20, verwarmd: true }],
    overigeRuimten: [],
    aanrechtLengteCm: 0,
    sanitair: {},
    buitenruimten: { geen: true },
    woz: { waardeEuro: 250_000, gebruiksoppervlakM2: 20 },
    energie: { label: "A" },
  };

  it("case 2 — eengezins + bouwjaar 1995: officieel 101 punten / € 644,53", () => {
    const r = berekenWwsPunten({
      ...skelet,
      woonvorm: "eengezins",
      energie: { bouwjaar: 1995 },
    });
    expect(r.rubrieken.energieprestatie).toBe(22);
    expect(r.rubrieken.wozPunten).toBe(61.5);
    expect(r.totaalPunten).toBe(101);
    expect(maxHuur2026Cents(101)).toBe(64453);
  });

  it("case 3 — cap-bodem: officieel exact 186 punten / € 1.228,07", () => {
    const r = berekenWwsPunten({
      ...skelet,
      woonvorm: "eengezins",
      vertrekken: [
        { m2: 30, verwarmd: true },
        { m2: 25, verwarmd: true },
        { m2: 15, verwarmd: true },
      ],
      woz: { waardeEuro: 850_000, gebruiksoppervlakM2: 70 },
      energie: { bouwjaar: 1995 },
    });
    // rest 93; ruwe WOZ 95,44 → ongecapt ≥ 187 maar floor(93/0,67)=138 < 187
    // → bodem: totaal 186 (wizard toont WOZ "afgetopt").
    expect(r.wozCapToegepast).toBe(true);
    expect(r.totaalPunten).toBe(186);
    expect(maxHuur2026Cents(186)).toBe(122807);
  });

  it("case 3b — cap boven de bodem: officieel 198 punten / € 1.310,46, WOZ 65", () => {
    const r = berekenWwsPunten({
      ...skelet,
      woonvorm: "eengezins",
      vertrekken: [
        { m2: 45, verwarmd: true },
        { m2: 35, verwarmd: true },
        { m2: 30, verwarmd: true },
      ],
      woz: { waardeEuro: 850_000, gebruiksoppervlakM2: 110 },
      energie: { bouwjaar: 1995 },
    });
    expect(r.wozCapToegepast).toBe(true);
    expect(r.rubrieken.wozPunten).toBe(65); // floor(133/0,67)=198 → 198−133
    expect(r.totaalPunten).toBe(198);
    expect(maxHuur2026Cents(198)).toBe(131046);
  });

  it("case 4 — Amsterdam/Utrecht-deler € 114: officieel 173 punten / € 1.138,85, WOZ 111", () => {
    const r = berekenWwsPunten({
      ...skelet,
      vertrekken: [
        { m2: 16, verwarmd: true },
        { m2: 10, verwarmd: true },
      ],
      woz: {
        waardeEuro: 280_000,
        gebruiksoppervlakM2: 26,
        kleineNieuwbouwAmsterdamUtrecht: true,
      },
    });
    expect(r.rubrieken.wozPunten).toBe(111);
    expect(r.totaalPunten).toBe(173);
    expect(maxHuur2026Cents(173)).toBe(113885);
  });

  it("case 5 — zorgwoning: officieel opslag 40,50 → 156 punten / € 1.022,07", () => {
    const r = berekenWwsPunten({ ...skelet, bijzonder: { zorgwoning: true } });
    expect(r.rubrieken.zorgwoningOpslag).toBe(40.5); // (54+61,5) × 35%
    expect(r.totaalPunten).toBe(156);
    expect(maxHuur2026Cents(156)).toBe(102207);
  });

  it("case 6 — rijksmonument + label G: officieel energie 0 → 79 punten / € 494,10", () => {
    const r = berekenWwsPunten({
      ...skelet,
      energie: { label: "G" },
      bijzonder: { monument: "rijksmonument" },
    });
    expect(r.rubrieken.energieprestatie).toBe(0);
    expect(r.totaalPunten).toBe(79);
    expect(maxHuur2026Cents(79)).toBe(49410);
    // Prijsopslag (wizard: "35% Rijksmonument → € 667,04") past F3 toe:
    expect(Math.round(49410 * 1.35)).toBe(66704);
  });

  it("case 8 — gedeelde achtertuin + parkeer type III: officieel 7,50 en 2 punten", () => {
    const r = berekenWwsPunten({
      ...skelet,
      buitenruimten: { gedeeld: [{ m2: 40, adressen: 4 }] },
      gemeenschappelijkeParkeerruimten: [{ type: 3, adressen: 2 }],
    });
    expect(r.rubrieken.buitenruimten).toBe(7.5);
    expect(r.rubrieken.gemeenschappelijkeParkeerruimte).toBe(2);
  });

  it("case 9 — kleine woning <25 m² label A: officieel 45 → 111 punten / € 713,20", () => {
    const r = berekenWwsPunten({
      ...skelet,
      woz: { waardeEuro: 200_000, gebruiksoppervlakM2: 20 },
      energie: { label: "A", kleineWoningKlasse: "<25" },
    });
    expect(r.rubrieken.energieprestatie).toBe(45);
    expect(r.rubrieken.wozPunten).toBe(49);
    expect(r.totaalPunten).toBe(111);
    expect(maxHuur2026Cents(111)).toBe(71320);
  });

  it("case 10 — nieuwbouwopslag: officieel 157 / € 1.029 + 10% = € 1.131,90", () => {
    const r = berekenWwsPunten({
      ...skelet,
      vertrekken: [
        { m2: 30, verwarmd: true },
        { m2: 25, verwarmd: true },
        { m2: 20, verwarmd: true },
      ],
      woz: { waardeEuro: 400_000, gebruiksoppervlakM2: 75 },
    });
    expect(r.rubrieken.wozPunten).toBe(43.5);
    expect(r.totaalPunten).toBe(157);
    const basis = maxHuur2026Cents(157)!;
    expect(basis).toBe(102900);
    expect(Math.round(basis * 1.1)).toBe(113190); // wizard: € 1.131,90
  });
});

describe("wws-punten — KALIBRATIE tegen de officiële Huurprijscheck", () => {
  it("case 1 (3-9-2026, wizard live doorlopen): 159 punten, € 1.042,73 — exact gelijk", () => {
    // Officiële invoer: meergezins, label A (vanaf 2021), WOZ € 300.000
    // peildatum 1-1-2025, woonkamer 18 + slaapkamers 12/10 + keuken 10
    // (aanrecht 1–2 m) + badkamer 6 (douche + wastafel), alle verwarmd;
    // toiletruimte 1,5 m² (telt níet als oppervlakte — < 2 m²-eis, wél 3
    // sanitairpunten); berging 5; balkon 6; video-intercom.
    // Officiële uitkomst per rubriek: 56 / 3,75 / 10 / 37 / 4 / 8 / 4 / 36 / 0,25.
    const r = berekenWwsPunten({
      woonvorm: "meergezins",
      vertrekken: [
        { m2: 18, verwarmd: true },
        { m2: 12, verwarmd: true },
        { m2: 10, verwarmd: true },
        { m2: 10, verwarmd: true },
        { m2: 6, verwarmd: true },
      ],
      overigeRuimten: [{ m2: 5 }],
      aanrechtLengteCm: 180,
      sanitair: { toilettenAparteRuimte: 1, wastafels: 1, douches: 1 },
      buitenruimten: { priveM2: 6 },
      woz: { waardeEuro: 300_000, gebruiksoppervlakM2: 61 },
      energie: { label: "A" },
      bijzonder: { videoIntercom: true },
    });
    expect(r.rubrieken.oppervlakteVertrekken).toBe(56);
    expect(r.rubrieken.oppervlakteOverigeRuimten).toBe(3.75);
    expect(r.rubrieken.verwarmingEnVerkoeling).toBe(10);
    expect(r.rubrieken.energieprestatie).toBe(37);
    expect(r.rubrieken.keuken).toBe(4);
    expect(r.rubrieken.sanitair).toBe(8);
    expect(r.rubrieken.buitenruimten).toBe(4);
    expect(r.rubrieken.wozPunten).toBe(36);
    expect(r.rubrieken.bijzondereVoorzieningen).toBe(0.25);
    expect(r.totaalPunten).toBe(159);
    expect(maxHuur2026Cents(r.totaalPunten)).toBe(104273); // € 1.042,73
  });
});

describe("wws-punten — flag-gate", () => {
  it("HUURPRIJS_CHECK_ENABLED bestaat en staat default UIT (kalibratie-gate)", () => {
    expect(FLAG_DEFAULTS.HUURPRIJS_CHECK_ENABLED).toBe(false);
  });
});

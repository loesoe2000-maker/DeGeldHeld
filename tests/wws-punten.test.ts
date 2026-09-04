import { describe, it, expect } from "vitest";
import {
  berekenWwsPunten,
  rondRubriek,
  labelUitBouwjaar,
  maxHuurBand2026Cents,
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

  it("WOZ-cap 33% grijpt pas vanaf 187 punten en wordt gemeld", () => {
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
    // rest: 100 + 10 + 62 + 14 + 11,75 − 5 = 192,75; ruwe WOZ ≈ 211 → cap
    expect(r.wozCapToegepast).toBe(true);
    expect(r.rubrieken.wozPunten).toBe(95); // 192,75 × 33/67 → 95,0
    expect(r.totaalPunten).toBe(288); // 192,75 + 95 → 287,75 → 288
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

  it("tussen ankers: band met omliggende officiële waarden, geen verzonnen precisie", () => {
    const band = maxHuurBand2026Cents(147);
    expect(band.exactCents).toBeNull();
    expect(band.ondergrensCents).toBe(93973); // anker 144
    expect(band.bovengrensCents).toBe(104957); // anker 160
  });

  it("buiten 40–250 punten: null (geen extrapolatie)", () => {
    expect(maxHuurBand2026Cents(30).bovengrensCents).toBeNull();
    expect(maxHuurBand2026Cents(300).exactCents).toBeNull();
  });
});

describe("wws-punten — flag-gate", () => {
  it("HUURPRIJS_CHECK_ENABLED bestaat en staat default UIT (kalibratie-gate)", () => {
    expect(FLAG_DEFAULTS.HUURPRIJS_CHECK_ENABLED).toBe(false);
  });
});

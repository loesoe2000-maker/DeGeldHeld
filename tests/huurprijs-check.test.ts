import { describe, it, expect } from "vitest";
import {
  bepaalRoute,
  checkHuurprijs,
  ruimeVariant,
  huurverlagingsBrief,
  vroegsteIngangsdatum,
  huurcommissieDeadline,
  STANDAARD_MARGE,
  WBH_INWERKING,
  isJuridischZelfstandig,
  type HuurprijsContract,
  type HuurprijsInput,
  type HuurprijsBewoning,
} from "@/lib/huurprijs-check";
import { berekenWwsPunten, type WwsInput } from "@/lib/wws-punten";
import { FLAG_DEFAULTS } from "@/lib/feature-flags";

/**
 * v40 F3 — routes + marge-regel. Elke verwachting hieronder komt uit
 * docs/V40_DATA_HUURPRIJS_2026.md (bron: huurcommissie.nl, 4-9-2026).
 */

const VANDAAG = new Date(2026, 8, 4); // 4 september 2026

/** Meergezins, label A — ~159 punten (de gekalibreerde case-1-woning). */
const WONING: WwsInput = {
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
};

const contract = (start: Date, extra: Partial<HuurprijsContract> = {}): HuurprijsContract => ({
  startDatum: start,
  type: "vast",
  ...extra,
});

/** Twee bewoners → altijd juridisch zelfstandig, ongeacht de huishouding. */
const BEWONING: HuurprijsBewoning = {
  aantalBewoners: 2,
  gemeenschappelijkeHuishouding: false,
};

describe("huurprijs-check — routes (wie mág een procedure starten)", () => {
  it("nieuw contract, binnen 6 maanden → aanvangshuurtoets met terugwerkende kracht", () => {
    const r = bepaalRoute(159, contract(new Date(2026, 5, 1)), VANDAAG);
    expect(r.route).toBe("AANVANGSHUURPRIJS");
    expect(r.mogelijk).toBe(true);
    expect(r.terugwerkendTotContractstart).toBe(true);
    expect(r.deadline).toEqual(new Date(2026, 11, 1)); // 1 juni + 6 mnd
    expect(r.legesCents).toBe(2500);
  });

  it("nieuw contract, exact op de 6-maandengrens → nog nét mogelijk", () => {
    const r = bepaalRoute(159, contract(new Date(2026, 2, 4)), VANDAAG); // 4 mrt + 6 = 4 sep
    expect(r.route).toBe("AANVANGSHUURPRIJS");
  });

  it("nieuw contract, langer dan 6 maanden → voorstel-route, GEEN terugwerkende kracht", () => {
    const r = bepaalRoute(159, contract(new Date(2025, 0, 1)), VANDAAG);
    expect(r.route).toBe("HUURVERLAGING_VOORSTEL");
    expect(r.mogelijk).toBe(true);
    expect(r.terugwerkendTotContractstart).toBe(false);
  });

  it("oud contract (< 1-7-2024) met ≤ 143 punten → Wet betaalbare huur-route", () => {
    const r = bepaalRoute(140, contract(new Date(2020, 0, 1)), VANDAAG);
    expect(r.route).toBe("WBH_LAAG_SEGMENT");
    expect(r.mogelijk).toBe(true);
  });

  it("oud contract met 144-186 punten → GEEN route (middenhuur bestaat daar niet)", () => {
    const r = bepaalRoute(159, contract(new Date(2020, 0, 1)), VANDAAG);
    expect(r.route).toBe("GEEN_MIDDENHUUR_OUD_CONTRACT");
    expect(r.mogelijk).toBe(false);
    expect(r.legesCents).toBe(0);
  });

  it("≥ 187 punten → hoogsegment, geen procedure — ongeacht contractdatum", () => {
    for (const start of [new Date(2020, 0, 1), new Date(2026, 7, 1)]) {
      const r = bepaalRoute(187, contract(start), VANDAAG);
      expect(r.route).toBe("GEEN_HOOGSEGMENT");
      expect(r.mogelijk).toBe(false);
    }
  });

  it("oud tijdelijk contract → toetsing tot 6 maanden ná afloop", () => {
    const c = contract(new Date(2023, 0, 1), {
      type: "tijdelijk",
      eindDatum: new Date(2026, 4, 1),
    });
    const r = bepaalRoute(159, c, VANDAAG); // 1 mei + 6 mnd = 1 nov 2026
    expect(r.route).toBe("AANVANGSHUURPRIJS");
    expect(r.deadline).toEqual(new Date(2026, 10, 1));

    // Ná die deadline valt hij terug op "geen route" (oud contract, 159 punten).
    const laat = bepaalRoute(159, c, new Date(2026, 11, 1));
    expect(laat.route).toBe("GEEN_MIDDENHUUR_OUD_CONTRACT");
  });

  it("WBH_INWERKING is 1 juli 2024 — de scheidslijn oud/nieuw regime", () => {
    expect(WBH_INWERKING).toEqual(new Date(2024, 6, 1));
    // Exact op 1 juli 2024 telt als NIEUW regime.
    const r = bepaalRoute(159, contract(new Date(2024, 6, 1)), VANDAAG);
    expect(r.route).toBe("HUURVERLAGING_VOORSTEL");
  });
});

describe("huurprijs-check — marge-regel", () => {
  it("ruime variant levert nooit minder punten op dan de basis", () => {
    const basis = berekenWwsPunten(WONING).totaalPunten;
    const ruim = berekenWwsPunten(ruimeVariant(WONING)).totaalPunten;
    expect(ruim).toBeGreaterThan(basis);
  });

  it("aanrecht 1-2 m wordt in de ruime variant doorgerekend als ≥ 2 m", () => {
    expect(ruimeVariant({ ...WONING, aanrechtLengteCm: 180 }).aanrechtLengteCm).toBe(200);
    expect(ruimeVariant({ ...WONING, aanrechtLengteCm: 50 }).aanrechtLengteCm).toBe(100);
    // Al in de hoogste klasse → ongewijzigd.
    expect(ruimeVariant({ ...WONING, aanrechtLengteCm: 250 }).aanrechtLengteCm).toBe(250);
  });

  it("'geen buitenruimte' blijft ook in de ruime variant staan (dat weet de huurder zeker)", () => {
    const r = ruimeVariant({ ...WONING, buitenruimten: { geen: true } });
    expect(r.buitenruimten.geen).toBe(true);
    expect(r.buitenruimten.priveM2).toBeUndefined();
  });

  it("marge uitzetten geeft exact dezelfde punten als de basis", () => {
    const geenMarge = {
      oppervlakteTolerantiePct: 0,
      wozTolerantiePct: 0,
      aanrechtOnzeker: false,
      extrasOnbekend: false,
    };
    expect(berekenWwsPunten(ruimeVariant(WONING, geenMarge)).totaalPunten).toBe(
      berekenWwsPunten(WONING).totaalPunten,
    );
  });
});

describe("huurprijs-check — verdict", () => {
  const basis = (kaleHuurCents: number, over: Partial<HuurprijsInput> = {}): HuurprijsInput => ({
    woning: WONING,
    contract: contract(new Date(2026, 5, 1)),
    bewoning: BEWONING,
    kaleHuurCents,
    vandaag: VANDAAG,
    ...over,
  });

  it("huur boven de RUIME maximale huur → kansrijk, met conservatieve besparing", () => {
    const r = checkHuurprijs(basis(150_000)); // € 1.500
    expect(r.verdict).toBe("kansrijk");
    expect(r.puntenBasis).toBe(159);
    expect(r.maxHuurBasisCents).toBe(104273); // € 1.042,73 (gekalibreerd)
    expect(r.maandVerlagingMinCents).toBeLessThan(r.maandVerlagingBasisCents);
    expect(r.jaarbesparingMinCents).toBe(r.maandVerlagingMinCents * 12);
    expect(r.feeIndicatieCents).toBeGreaterThan(0);
  });

  it("huur tussen basis en ruime grens → twijfelgeval, GEEN fee-indicatie", () => {
    const r = checkHuurprijs(basis(110_000)); // boven € 1.042,73, onder de ruime grens
    expect(r.verdict).toBe("twijfelgeval");
    expect(r.feeIndicatieCents).toBe(0);
  });

  it("huur onder de maximale huur → geen zaak", () => {
    const r = checkHuurprijs(basis(90_000));
    expect(r.verdict).toBe("geen_zaak");
    expect(r.maandVerlagingBasisCents).toBe(0);
    expect(r.feeIndicatieCents).toBe(0);
  });

  it("geen route → verdict 'geen_route', ook als de huur veel te hoog is", () => {
    const r = checkHuurprijs(basis(200_000, { contract: contract(new Date(2020, 0, 1)) }));
    expect(r.route.mogelijk).toBe(false);
    expect(r.verdict).toBe("geen_route");
    expect(r.feeIndicatieCents).toBe(0);
  });

  it("fee: 20% van de CONSERVATIEVE jaarbesparing, gecapt op € 500", () => {
    const r = checkHuurprijs(basis(300_000)); // extreem hoge huur → cap
    expect(r.feeIndicatieCents).toBe(50_000);
  });

  it("zonder energielabel volgt een waarschuwing (bouwjaar geeft minder punten)", () => {
    const r = checkHuurprijs(
      basis(150_000, { woning: { ...WONING, energie: { bouwjaar: 1995 } } }),
    );
    expect(r.waarschuwingen.join(" ")).toMatch(/EP-Online/);
  });

  it("ruime telling boven 186 punten → twijfelgeval + expliciete vrije-sector-waarschuwing", () => {
    const grote: WwsInput = {
      ...WONING,
      vertrekken: [
        { m2: 30, verwarmd: true },
        { m2: 18, verwarmd: true },
        { m2: 12, verwarmd: true },
        { m2: 10, verwarmd: true },
        { m2: 6, verwarmd: true },
      ],
      woz: { waardeEuro: 400_000, gebruiksoppervlakM2: 80 },
    };
    const r = checkHuurprijs(basis(200_000, { woning: grote }));
    expect(r.puntenBasis).toBeLessThanOrEqual(186);
    expect(r.puntenRuim).toBeGreaterThan(186);
    expect(r.verdict).toBe("twijfelgeval");
    expect(r.waarschuwingen.join(" ")).toMatch(/vrije sector/i);
  });
});

describe("huurprijs-check — termijnen van de voorstel-route", () => {
  it("ingangsdatum ligt 2 volle kalendermaanden vooruit (4 sep → 1 dec)", () => {
    expect(vroegsteIngangsdatum(new Date(2026, 8, 4))).toEqual(new Date(2026, 11, 1));
    // Jaargrens: 20 november → 1 februari.
    expect(vroegsteIngangsdatum(new Date(2026, 10, 20))).toEqual(new Date(2027, 1, 1));
  });

  it("Huurcommissie-deadline is 6 weken ná de voorgestelde ingangsdatum", () => {
    expect(huurcommissieDeadline(new Date(2026, 11, 1))).toEqual(new Date(2027, 0, 12));
  });
});

describe("huurprijs-check — DIY-brief", () => {
  const r = checkHuurprijs({
    woning: WONING,
    contract: contract(new Date(2025, 0, 1)),
    bewoning: BEWONING,
    kaleHuurCents: 150_000,
    vandaag: VANDAAG,
  });

  it("voorstel-brief noemt punten, maximale huur en een geldige ingangsdatum", () => {
    const brief = huurverlagingsBrief(r, { adres: "Teststraat 1", vandaag: VANDAAG });
    expect(brief).toMatch(/voorstel tot huurverlaging/i);
    expect(brief).toMatch(/159 punten/);
    expect(brief).toMatch(/€ 1\.?042,73|1042,73/);
    expect(brief).toMatch(/1 december 2026/);
    expect(brief).toMatch(/Teststraat 1/);
  });

  it("aanvangstoets-brief noemt de terugwerkende kracht, niet een ingangsdatum", () => {
    const nieuw = checkHuurprijs({
      woning: WONING,
      contract: contract(new Date(2026, 5, 1)),
      bewoning: BEWONING,
      kaleHuurCents: 150_000,
      vandaag: VANDAAG,
    });
    const brief = huurverlagingsBrief(nieuw, { vandaag: VANDAAG });
    expect(brief).toMatch(/toetsing van de aanvangshuurprijs/i);
    expect(brief).toMatch(/terugwerkende kracht|werkt terug/i);
    expect(brief).not.toMatch(/voorstel tot huurverlaging/i);
  });

  it("wij dienen nooit zelf in — de brief is van en door de huurder", () => {
    const brief = huurverlagingsBrief(r, { vandaag: VANDAAG });
    expect(brief).toMatch(/\[naam\]/);
    expect(brief).not.toMatch(/DeGeldHeld dient/i);
  });
});

describe("huurprijs-check — GATE 0: woningdelers (BHW art. 1 lid 2)", () => {
  it("de wettelijke test: max 2 bewoners, of 3+ mét gemeenschappelijke huishouding", () => {
    expect(isJuridischZelfstandig({ aantalBewoners: 1, gemeenschappelijkeHuishouding: false })).toBe(true);
    expect(isJuridischZelfstandig({ aantalBewoners: 2, gemeenschappelijkeHuishouding: false })).toBe(true);
    // Gezin van vier: wél gemeenschappelijke huishouding → zelfstandig.
    expect(isJuridischZelfstandig({ aantalBewoners: 4, gemeenschappelijkeHuishouding: true })).toBe(true);
    // Drie vrienden / woningdelers → juridisch ONzelfstandig.
    expect(isJuridischZelfstandig({ aantalBewoners: 3, gemeenschappelijkeHuishouding: false })).toBe(false);
  });

  it("woningdelers krijgen GEEN puntenuitkomst — die zou met het verkeerde stelsel gerekend zijn", () => {
    const r = checkHuurprijs({
      woning: WONING,
      contract: contract(new Date(2026, 5, 1)),
      bewoning: { aantalBewoners: 3, gemeenschappelijkeHuishouding: false },
      kaleHuurCents: 150_000,
      vandaag: VANDAAG,
    });
    expect(r.verdict).toBe("onzelfstandig");
    expect(r.route.route).toBe("ONZELFSTANDIG_WWSO");
    expect(r.maxHuurBasisCents).toBeNull();
    expect(r.feeIndicatieCents).toBe(0);
  });

  it("de boodschap is eerlijk: ander stelsel, maar wél altijd een maximale huurprijs", () => {
    const r = checkHuurprijs({
      woning: WONING,
      contract: contract(new Date(2020, 0, 1)),
      bewoning: { aantalBewoners: 4, gemeenschappelijkeHuishouding: false },
      kaleHuurCents: 200_000,
      vandaag: VANDAAG,
    });
    expect(r.route.uitleg).toMatch(/altijd in de gereguleerde sector/i);
    expect(r.route.uitleg).toMatch(/WWSO/);
    // Geen valse afwijzing: nergens "je hebt geen recht".
    expect(r.route.uitleg).not.toMatch(/geen recht/i);
  });

  it("een gezin van 4 wordt gewoon doorgerekend (gemeenschappelijke huishouding)", () => {
    const r = checkHuurprijs({
      woning: WONING,
      contract: contract(new Date(2026, 5, 1)),
      bewoning: { aantalBewoners: 4, gemeenschappelijkeHuishouding: true },
      kaleHuurCents: 150_000,
      vandaag: VANDAAG,
    });
    expect(r.verdict).toBe("kansrijk");
    expect(r.puntenBasis).toBe(159);
  });

  it("de brief bestaat niet voor woningdelers (route niet mogelijk)", () => {
    const r = checkHuurprijs({
      woning: WONING,
      contract: contract(new Date(2026, 5, 1)),
      bewoning: { aantalBewoners: 3, gemeenschappelijkeHuishouding: false },
      kaleHuurCents: 150_000,
      vandaag: VANDAAG,
    });
    expect(r.route.mogelijk).toBe(false);
  });
});

describe("huurprijs-check — flag-gate", () => {
  it("HUURPRIJS_CHECK_ENABLED staat default uit tot de F4-pilot", () => {
    expect(FLAG_DEFAULTS.HUURPRIJS_CHECK_ENABLED).toBe(false);
  });

  it("standaard-marge is niet nul (anders vervalt de bescherming)", () => {
    expect(STANDAARD_MARGE.oppervlakteTolerantiePct).toBeGreaterThan(0);
    expect(STANDAARD_MARGE.extrasOnbekend).toBe(true);
  });
});

/**
 * lib/wws-punten.ts — v40 F2: pure WWS-puntentelling voor ZELFSTANDIGE
 * woonruimte, geldend 2026.
 *
 * Elke waarde komt uit docs/V40_DATA_WWS_2026.md (letterlijk gesourcet uit
 * Besluit huurprijzen woonruimte, Bijlage I onderdeel A, geldend 2026 —
 * hierna "BHW"). GEEN LLM in de rekensom; alles deterministisch en testbaar.
 *
 * KALIBRATIEPLICHT (F2b, zie V40_PLAN F2): vóór de flag aan mag, wordt deze
 * lib per rubriek vergeleken met de officiële Huurprijscheck
 * (huurprijscheck.huurcommissie.nl) op ≥ 10 adressen; onverklaarde
 * verschillen blokkeren F3. Open kalibratievragen staan in het databestand.
 *
 * De maximale huurprijs per punt is een officiële per-punt-tabel die niet
 * lineair is; tot de volledige tabel is geïmporteerd (F2b) geeft
 * maxHuurBand2026Cents() een bewust CONSERVATIEVE band uit geverifieerde
 * ankerrijen — de marge-regel uit het V40-plan rekent met de bovengrens.
 */

export type Woonvorm = "eengezins" | "meergezins";

export type EnergieLabel =
  | "A++++" | "A+++" | "A++" | "A+" | "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface WwsVertrek {
  /** Oppervlakte in m² (woonkamer, slaapkamer, keuken, badkamer, …). */
  m2: number;
  verwarmd: boolean;
  /** Verkoelingsfunctie die tevens verwarmt (bv. warmtepomp-airco). */
  verkoeld?: boolean;
}

export interface WwsOverigeRuimte {
  /** Berging, zolder zonder vaste trap, privé-garage, … */
  m2: number;
  verwarmd?: boolean;
}

export interface WwsInput {
  woonvorm: Woonvorm;
  vertrekken: WwsVertrek[];
  overigeRuimten: WwsOverigeRuimte[];
  /** Lengte van het aanrecht in cm. */
  aanrechtLengteCm: number;
  /** Extra keukenkwaliteit; wordt gecapt op de aanrechtpunten (BHW 5.2). */
  keukenExtraPunten?: number;
  sanitair: {
    toilettenAparteRuimte?: number;
    toilettenInBadkamer?: number;
    hangendeToilettenAparteRuimte?: number;
    hangendeToilettenInBadkamer?: number;
    wastafels?: number;
    meerpersoonsWastafels?: number;
    douches?: number;
    baden?: number;
    badDouches?: number;
    /** Extra sanitairkwaliteit; gecapt op douche/bad-punten (BHW 6.2). */
    extraPunten?: number;
  };
  buitenruimten: {
    /** Som privé-buitenruimte in m² (balkon, tuin, dakterras, loggia). */
    priveM2?: number;
    gedeeld?: Array<{ m2: number; adressen: number }>;
    /** Expliciet: helemaal geen buitenruimte → −5 punten (BHW rubriek 8). */
    geen?: boolean;
  };
  woz: {
    /** WOZ-waarde in euro's, beschikking met waardepeildatum 1-1-2025. */
    waardeEuro: number;
    /** Gebruiksoppervlakte in m² (BAG). */
    gebruiksoppervlakM2: number;
    /** BHW 11.1 onder a: < 40 m², bouwjaar 2018–2022, COROP A'dam/Utrecht. */
    kleineNieuwbouwAmsterdamUtrecht?: boolean;
    /** BHW 11.2: gebouwd 2015–2019 → min 40 WOZ-punten bij rest ≥ 110. */
    nieuwbouw2015_2019?: boolean;
  };
  energie: {
    label?: EnergieLabel;
    /** Fallback zonder geldig label: bouwjaar (BHW rubriek 4). */
    bouwjaar?: number;
  };
  bijzonder?: {
    zorgwoning?: boolean;
    videoIntercom?: boolean;
    laadpaal?: boolean;
    /** Investering verhuurder in gehandicapten-voorzieningen, in euro's. */
    gehandicaptenInvesteringEuro?: number;
  };
}

export interface WwsRubrieken {
  oppervlakteVertrekken: number;
  oppervlakteOverigeRuimten: number;
  verwarmingEnVerkoeling: number;
  energieprestatie: number;
  keuken: number;
  sanitair: number;
  gehandicaptenVoorzieningen: number;
  buitenruimten: number;
  wozPunten: number;
  bijzondereVoorzieningen: number;
  zorgwoningOpslag: number;
}

export interface WwsResultaat {
  rubrieken: WwsRubrieken;
  /** Heel afgerond (≥ 0,5 naar boven), nooit negatief. */
  totaalPunten: number;
  wozCapToegepast: boolean;
  wozMinimum40Toegepast: boolean;
}

// // bron: docs/V40_DATA_WWS_2026.md — BHW rubriek 4 (per label, per woonvorm).
export const ENERGIE_PUNTEN: Record<Woonvorm, Record<EnergieLabel, number>> = {
  eengezins: {
    "A++++": 62, "A+++": 57, "A++": 52, "A+": 47, A: 41,
    B: 34, C: 22, D: 14, E: -5, F: -9, G: -15,
  },
  meergezins: {
    "A++++": 58, "A+++": 53, "A++": 48, "A+": 43, A: 37,
    B: 30, C: 15, D: 11, E: -5, F: -9, G: -15,
  },
};

/** BHW rubriek 4 bouwjaar-kolom: zonder geldig label telt het bouwjaar. */
export function labelUitBouwjaar(bouwjaar: number): EnergieLabel {
  if (bouwjaar >= 2002) return "A";
  if (bouwjaar >= 2000) return "B";
  if (bouwjaar >= 1992) return "C";
  if (bouwjaar >= 1984) return "D";
  if (bouwjaar >= 1979) return "E";
  if (bouwjaar >= 1977) return "F";
  return "G";
}

/**
 * Rubriekafronding op 0,25 punt; exact 1/8 gaat naar boven.
 * // bron: BHW Bijlage I-A slot + Beleidsboek juli 2025.
 */
export function rondRubriek(x: number): number {
  return Math.floor(x * 4 + 0.5) / 4;
}

const WOZ_DELER_WAARDE = 16_954; // // bron: BHW 11.1 (peildatum 1-1-2025)
const WOZ_DELER_PER_M2 = 268; // // bron: BHW 11.1 onder b
const WOZ_DELER_PER_M2_AMS_UT = 114; // // bron: BHW 11.1 onder a
const GEHANDICAPT_EURO_PER_PUNT = 332; // // bron: BHW rubriek 7

export function berekenWwsPunten(input: WwsInput): WwsResultaat {
  // Rubriek 1 — vertrekken: 1 punt per m².
  const oppervlakteVertrekken = rondRubriek(
    input.vertrekken.reduce((s, v) => s + Math.max(0, v.m2), 0),
  );

  // Rubriek 2 — overige ruimten: 0,75 punt per m².
  const oppervlakteOverigeRuimten = rondRubriek(
    input.overigeRuimten.reduce((s, r) => s + Math.max(0, r.m2) * 0.75, 0),
  );

  // Rubriek 3 — verwarming (vertrek 2, overige 1 met max 4) + verkoeling
  // (1 per verkoeld vertrek, max 2, alleen mét verwarmingsfunctie).
  const verwarmdeVertrekken = input.vertrekken.filter((v) => v.verwarmd).length;
  const verwarmdeOverige = Math.min(
    4,
    input.overigeRuimten.filter((r) => r.verwarmd).length,
  );
  const verkoeld = Math.min(
    2,
    input.vertrekken.filter((v) => v.verkoeld && v.verwarmd).length,
  );
  const verwarmingEnVerkoeling = rondRubriek(
    verwarmdeVertrekken * 2 + verwarmdeOverige + verkoeld,
  );

  // Rubriek 4 — energieprestatie via label, anders bouwjaar.
  const label =
    input.energie.label ??
    (input.energie.bouwjaar != null ? labelUitBouwjaar(input.energie.bouwjaar) : undefined);
  const energieprestatie = label == null ? 0 : ENERGIE_PUNTEN[input.woonvorm][label];

  // Rubriek 5 — keuken: aanrechtlengte + extra kwaliteit (gecapt).
  const aanrechtPunten =
    input.aanrechtLengteCm >= 200 ? 7 : input.aanrechtLengteCm >= 100 ? 4 : 0;
  const keuken = rondRubriek(
    aanrechtPunten + Math.min(Math.max(0, input.keukenExtraPunten ?? 0), aanrechtPunten),
  );

  // Rubriek 6 — sanitair; extra kwaliteit gecapt op douche/bad-punten.
  const s = input.sanitair;
  const doucheBadPunten =
    (s.douches ?? 0) * 4 + (s.baden ?? 0) * 6 + (s.badDouches ?? 0) * 7;
  const sanitairBasis =
    (s.toilettenAparteRuimte ?? 0) * 3 +
    (s.toilettenInBadkamer ?? 0) * 2 +
    (s.hangendeToilettenAparteRuimte ?? 0) * 3.75 +
    (s.hangendeToilettenInBadkamer ?? 0) * 2.75 +
    (s.wastafels ?? 0) * 1 +
    (s.meerpersoonsWastafels ?? 0) * 1.5 +
    doucheBadPunten;
  const sanitair = rondRubriek(
    sanitairBasis + Math.min(Math.max(0, s.extraPunten ?? 0), doucheBadPunten),
  );

  // Rubriek 7 — gehandicapten-voorzieningen: 1 punt per € 332.
  const gehandicaptenVoorzieningen = rondRubriek(
    Math.max(0, input.bijzonder?.gehandicaptenInvesteringEuro ?? 0) / GEHANDICAPT_EURO_PER_PUNT,
  );

  // Rubriek 8 — buitenruimten: privé 2 + 0,35/m²; gedeeld 0,75/m² ÷ adressen;
  // max 15; helemaal geen buitenruimte → −5.
  const b = input.buitenruimten;
  let buitenruimten: number;
  if (b.geen) {
    buitenruimten = -5;
  } else {
    const prive = (b.priveM2 ?? 0) > 0 ? 2 + (b.priveM2 ?? 0) * 0.35 : 0;
    const gedeeld = (b.gedeeld ?? []).reduce(
      (sum, g) => sum + (g.adressen > 0 ? (g.m2 * 0.75) / g.adressen : 0),
      0,
    );
    buitenruimten = rondRubriek(Math.min(15, prive + gedeeld));
  }

  // Rubriek 12 — bijzondere voorzieningen (excl. zorgopslag).
  const bijzondereVoorzieningen = rondRubriek(
    (input.bijzonder?.videoIntercom ? 0.25 : 0) + (input.bijzonder?.laadpaal ? 2 : 0),
  );

  // Rubriek 11 — WOZ.
  const wozDelerM2 = input.woz.kleineNieuwbouwAmsterdamUtrecht
    ? WOZ_DELER_PER_M2_AMS_UT
    : WOZ_DELER_PER_M2;
  let wozRuw =
    input.woz.waardeEuro / WOZ_DELER_WAARDE +
    input.woz.waardeEuro / Math.max(1, input.woz.gebruiksoppervlakM2) / wozDelerM2;

  const restPunten =
    oppervlakteVertrekken +
    oppervlakteOverigeRuimten +
    verwarmingEnVerkoeling +
    energieprestatie +
    keuken +
    sanitair +
    gehandicaptenVoorzieningen +
    buitenruimten +
    bijzondereVoorzieningen;

  // BHW 11.2: nieuwbouw 2015–2019 → minimaal 40 WOZ-punten bij rest ≥ 110.
  let wozMinimum40Toegepast = false;
  if (input.woz.nieuwbouw2015_2019 && restPunten >= 110 && wozRuw < 40) {
    wozRuw = 40;
    wozMinimum40Toegepast = true;
  }

  // BHW 11: WOZ-aandeel max 33% — geldt alleen als het totaal zónder de cap
  // op 187+ uitkomt. Cap: woz = 33/67 × rest (zodat woz/(rest+woz) = 33%).
  let wozCapToegepast = false;
  let wozPunten = rondRubriek(wozRuw);
  if (restPunten + wozPunten >= 187) {
    const gecapt = rondRubriek((restPunten * 33) / 67);
    if (gecapt < wozPunten && !wozMinimum40Toegepast) {
      wozPunten = gecapt;
      wozCapToegepast = true;
    }
  }

  // Zorgwoning: +35% over onderdelen 1 t/m 11.1 (dus incl. WOZ, excl.
  // rubriek-12-punten). // bron: BHW rubriek 12. Volgorde t.o.v. cap is een
  // open kalibratievraag (docs/V40_DATA_WWS_2026.md #2).
  const zorgwoningOpslag = input.bijzonder?.zorgwoning
    ? rondRubriek(
        (restPunten - bijzondereVoorzieningen + wozPunten) * 0.35,
      )
    : 0;

  const somNaCap = restPunten + wozPunten + zorgwoningOpslag;
  // Eindafronding op hele punten, ≥ 0,5 naar boven; nooit negatief.
  const totaalPunten = Math.max(0, Math.floor(somNaCap + 0.5));

  return {
    rubrieken: {
      oppervlakteVertrekken,
      oppervlakteOverigeRuimten,
      verwarmingEnVerkoeling,
      energieprestatie,
      keuken,
      sanitair,
      gehandicaptenVoorzieningen,
      buitenruimten,
      wozPunten,
      bijzondereVoorzieningen,
      zorgwoningOpslag,
    },
    totaalPunten,
    wozCapToegepast,
    wozMinimum40Toegepast,
  };
}

/**
 * Geverifieerde ankerrijen uit de officiële per-punt-tabel per 1-1-2026.
 * // bron: Huurcommissie Beleidsboek Bijlage 3 (docs/V40_DATA_WWS_2026.md).
 * F2b vervangt dit door de volledige 40–250-tabel.
 */
export const MAX_HUUR_ANKERS_2026: ReadonlyArray<{ punten: number; cents: number }> = [
  { punten: 40, cents: 25026 },
  { punten: 100, cents: 63767 },
  { punten: 140, cents: 91226 },
  { punten: 142, cents: 92598 },
  { punten: 143, cents: 93293 },
  { punten: 144, cents: 93973 },
  { punten: 160, cents: 104957 },
  { punten: 186, cents: 122807 },
  { punten: 187, cents: 123492 },
  { punten: 200, cents: 132418 },
  { punten: 250, cents: 166740 },
];

/** Bovengrens laag segment (sociale huur) 2026, in punten. */
export const LAAG_SEGMENT_MAX_PUNTEN_2026 = 143;
/** Liberalisatiegrens / top middenhuur 2026, in punten. */
export const MIDDENHUUR_MAX_PUNTEN_2026 = 186;

export interface MaxHuurBand {
  /** Officiële waarde als het puntenaantal exact een ankerrij is. */
  exactCents: number | null;
  /** Conservatieve band uit omliggende ankerrijen (onder- en bovengrens). */
  ondergrensCents: number | null;
  bovengrensCents: number | null;
}

/**
 * Maximale huurprijs per 1-1-2026 voor een puntenaantal. Exact op ankers;
 * daartussen een band (marge-regel rekent met de BOVENgrens — pessimistisch
 * voor ons, veilig voor de klant). Buiten 40–250: null.
 */
export function maxHuurBand2026Cents(punten: number): MaxHuurBand {
  const ankers = MAX_HUUR_ANKERS_2026;
  if (punten < ankers[0].punten || punten > ankers[ankers.length - 1].punten) {
    return { exactCents: null, ondergrensCents: null, bovengrensCents: null };
  }
  const exact = ankers.find((a) => a.punten === punten);
  if (exact) {
    return {
      exactCents: exact.cents,
      ondergrensCents: exact.cents,
      bovengrensCents: exact.cents,
    };
  }
  let onder = ankers[0];
  let boven = ankers[ankers.length - 1];
  for (const a of ankers) {
    if (a.punten < punten && a.punten > onder.punten) onder = a;
    if (a.punten > punten && a.punten < boven.punten) boven = a;
  }
  return { exactCents: null, ondergrensCents: onder.cents, bovengrensCents: boven.cents };
}

/** Opslagen op de maximale huurPRIJS (BHW art. 8a) — F3 past ze toe. */
export const HUURPRIJS_OPSLAG_PCT = {
  rijksmonumentNieuwContract: 35,
  gemeentelijkMonument: 15,
  beschermdGezicht: 5,
  nieuwbouwopslagMiddenhuur: 10,
} as const;

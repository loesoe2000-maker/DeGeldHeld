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
    /**
     * Overgangsrecht kleine woningen (Beleidsboek 4.4, vervallen per
     * 1-1-2025 maar geldig voor NTA-labels afgegeven 1-1-2021 t/m 30-6-2024):
     * gebruikersoppervlak < 25 m² of 25–40 m² → afwijkende tabellen.
     */
    kleineWoningKlasse?: "<25" | "25-40";
    /** Energieprestatievergoeding overeengekomen → vast 32/28 (Beleidsboek 4.3). */
    epv?: boolean;
  };
  /** Rubriek 9: gedeeld met andere adressen (Beleidsboek h2 rubriek 9). */
  gemeenschappelijkeBinnenruimten?: {
    vertrekken?: Array<{ m2: number; adressen: number }>;
    overigeRuimten?: Array<{ m2: number; adressen: number }>;
  };
  /**
   * Rubriek 10: gemeenschappelijke parkeerruimte. Type I = afgesloten garage
   * (9 pt), II = buiten met dak (6 pt), III = buiten zonder dak (4 pt),
   * telkens gedeeld door het aantal adressen. // bron: Beleidsboek h2 r10.
   */
  gemeenschappelijkeParkeerruimten?: Array<{ type: 1 | 2 | 3; adressen: number }>;
  bijzonder?: {
    zorgwoning?: boolean;
    videoIntercom?: boolean;
    laadpaal?: boolean;
    /** Investering verhuurder in gehandicapten-voorzieningen, in euro's. */
    gehandicaptenInvesteringEuro?: number;
    /**
     * Monument-status. Beleidsboek 4.2: bij een rijks-, provinciaal of
     * gemeentelijk monument geen mínpunten voor energie (E/F/G → 0). De
     * huurprijs-opslagen (art. 8a) past F3 toe via HUURPRIJS_OPSLAG_PCT.
     */
    monument?: "rijksmonument" | "gemeentelijk" | "beschermd_gezicht" | null;
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
  gemeenschappelijkeRuimten: number;
  gemeenschappelijkeParkeerruimte: number;
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

/**
 * Overgangsrecht kleine woningen (Beleidsboek 4.4.1 / 4.4.2) — geldt alleen
 * voor NTA-labels afgegeven 1-1-2021 t/m 30-6-2024 bij gebruiksoppervlak
 * ≤ 40 m². // bron: docs/V40_DATA_WWS_2026.md.
 */
export const ENERGIE_PUNTEN_KLEINE_WONING: Record<
  "<25" | "25-40",
  Record<Woonvorm, Record<EnergieLabel, number>>
> = {
  "<25": {
    eengezins: {
      "A++++": 62, "A+++": 62, "A++": 60, "A+": 55, A: 49,
      B: 42, C: 36, D: 32, E: -4, F: -9, G: -15,
    },
    meergezins: {
      "A++++": 62, "A+++": 62, "A++": 56, "A+": 51, A: 45,
      B: 38, C: 32, D: 28, E: -4, F: -9, G: -15,
    },
  },
  "25-40": {
    eengezins: {
      "A++++": 62, "A+++": 57, "A++": 52, "A+": 47, A: 41,
      B: 34, C: 22, D: 14, E: -4, F: -9, G: -15,
    },
    meergezins: {
      "A++++": 62, "A+++": 53, "A++": 48, "A+": 43, A: 37,
      B: 30, C: 15, D: 11, E: -4, F: -9, G: -15,
    },
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

/**
 * Meetregel Beleidsboek h2 §2.4: oppervlaktes per ruimte op 2 decimalen,
 * daarna de SOM per categorie afronden op hele m² (≥ 0,5 naar boven), en
 * pas dán waarderen in punten.
 */
export function rondOppervlakteSom(m2s: number[]): number {
  const som = m2s.reduce((s, m) => s + Math.max(0, Math.round(m * 100) / 100), 0);
  return Math.floor(som + 0.5);
}

export function berekenWwsPunten(input: WwsInput): WwsResultaat {
  // Rubriek 1 — vertrekken: som op hele m², dan 1 punt per m².
  const oppervlakteVertrekken = rondRubriek(
    rondOppervlakteSom(input.vertrekken.map((v) => v.m2)),
  );

  // Rubriek 2 — overige ruimten: som op hele m², dan 0,75 punt per m².
  const oppervlakteOverigeRuimten = rondRubriek(
    rondOppervlakteSom(input.overigeRuimten.map((r) => r.m2)) * 0.75,
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

  // Rubriek 4 — energieprestatie: EPV-vast, anders label (evt. kleine-woning-
  // overgangstabel), anders bouwjaar. Monument: geen minpunten (E/F/G → 0,
  // Beleidsboek 4.2).
  const label =
    input.energie.label ??
    (input.energie.bouwjaar != null ? labelUitBouwjaar(input.energie.bouwjaar) : undefined);
  let energieprestatie: number;
  if (input.energie.epv) {
    energieprestatie = input.woonvorm === "eengezins" ? 32 : 28;
  } else if (label == null) {
    energieprestatie = 0;
  } else if (input.energie.kleineWoningKlasse) {
    energieprestatie =
      ENERGIE_PUNTEN_KLEINE_WONING[input.energie.kleineWoningKlasse][input.woonvorm][label];
  } else {
    energieprestatie = ENERGIE_PUNTEN[input.woonvorm][label];
  }
  if (input.bijzonder?.monument && energieprestatie < 0) energieprestatie = 0;

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

  // Rubriek 9 — gemeenschappelijke binnenruimtes: vertrek 1 pt/m², overige
  // 0,75 pt/m², telkens gedeeld door het aantal adressen.
  const g = input.gemeenschappelijkeBinnenruimten;
  const gemeenschappelijkeRuimten = rondRubriek(
    (g?.vertrekken ?? []).reduce(
      (s, r) => s + (r.adressen > 0 ? r.m2 / r.adressen : 0),
      0,
    ) +
      (g?.overigeRuimten ?? []).reduce(
        (s, r) => s + (r.adressen > 0 ? (r.m2 * 0.75) / r.adressen : 0),
        0,
      ),
  );

  // Rubriek 10 — gemeenschappelijke parkeerruimte: 9/6/4 punten ÷ adressen.
  const PARKEER_PUNTEN = { 1: 9, 2: 6, 3: 4 } as const;
  const gemeenschappelijkeParkeerruimte = rondRubriek(
    (input.gemeenschappelijkeParkeerruimten ?? []).reduce(
      (s, p) => s + (p.adressen > 0 ? PARKEER_PUNTEN[p.type] / p.adressen : 0),
      0,
    ),
  );

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
    gemeenschappelijkeRuimten +
    gemeenschappelijkeParkeerruimte +
    bijzondereVoorzieningen;

  // BHW 11.2: nieuwbouw 2015–2019 → minimaal 40 WOZ-punten bij rest ≥ 110.
  let wozMinimum40Toegepast = false;
  if (input.woz.nieuwbouw2015_2019 && restPunten >= 110 && wozRuw < 40) {
    wozRuw = 40;
    wozMinimum40Toegepast = true;
  }

  // BHW 11: WOZ-aandeel max 33% — geldt alleen als het totaal zónder cap op
  // 187+ uitkomt. KALIBRATIE 3-9-2026 (cases 3/3b tegen de officiële
  // Huurprijscheck): de cap werkt op het TOTAAL — het wordt het grootste
  // gehele puntental T waarbij (T − rest) ≤ 33% van T, ofwel
  // T = floor(rest / 0,67); zakt T daarmee onder de 187, dan geldt de bodem
  // en wordt het totaal op 186 gesteld (de liberalisatiegrens).
  let wozCapToegepast = false;
  let wozPunten = rondRubriek(wozRuw);
  if (restPunten + wozPunten >= 187 && !wozMinimum40Toegepast) {
    const maxTotaal = Math.floor(restPunten / 0.67);
    if (restPunten + wozPunten > maxTotaal) {
      wozCapToegepast = true;
      wozPunten = (maxTotaal >= 187 ? maxTotaal : 186) - restPunten;
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
      gemeenschappelijkeRuimten,
      gemeenschappelijkeParkeerruimte,
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
 * Volledige officiële per-punt-tabel maximale huurprijsgrenzen per 1-1-2026,
 * in centen; index 0 = 40 punten, laatste = 250 punten (211 rijen).
 * // bron: Huurcommissie Beleidsboek Bijlage 3 (docs/V40_DATA_WWS_2026.md).
 * Import geverifieerd (F2b): doorlopend 40–250, strikt oplopend met stappen
 * € 5,50–7,50, en exact gelijk aan de 11 onafhankelijk geverifieerde ankers.
 */
export const MAX_HUUR_TABEL_2026_CENTS: readonly number[] = [
  25026, 25653, 26275, 26902, 27527, 28150, 28778, 29403, 30029, 30654,
  31280, 31902, 32530, 33154, 33780, 34405, 35035, 35653, 36279, 36909,
  37532, 38155, 38783, 39406, 40032, 40658, 41285, 41910, 42533, 43156,
  43781, 44409, 45036, 45657, 46286, 46909, 47536, 48160, 48789, 49410,
  50038, 50722, 51408, 52096, 52781, 53470, 54156, 54841, 55529, 56213,
  56903, 57587, 58271, 58961, 59645, 60332, 61019, 61708, 62394, 63082,
  63767, 64453, 65136, 65824, 66512, 67195, 67885, 68570, 69256, 69944,
  70632, 71320, 72005, 72695, 73379, 74066, 74751, 75437, 76121, 76808,
  77494, 78185, 78871, 79556, 80244, 80930, 81614, 82302, 82994, 83674,
  84362, 85049, 85733, 86424, 87106, 87797, 88479, 89167, 89856, 90539,
  91226, 91914, 92598, 93293, 93973, 94661, 95345, 96033, 96718, 97405,
  98091, 98778, 99463, 100150, 100835, 101522, 102207, 102900, 103581, 104273,
  104957, 105642, 106332, 107014, 107700, 108388, 109076, 109761, 110446, 111139,
  111823, 112508, 113194, 113885, 114569, 115255, 115940, 116627, 117315, 118001,
  118684, 119376, 120061, 120746, 121431, 122121, 122807, 123492, 124181, 124865,
  125553, 126240, 126925, 127612, 128300, 128986, 129670, 130357, 131046, 131728,
  132418, 133103, 133789, 134475, 135163, 135850, 136534, 137224, 137909, 138595,
  139284, 139969, 140656, 141343, 142028, 142715, 143399, 144086, 144771, 145460,
  146149, 146831, 147519, 148205, 148895, 149577, 150267, 150953, 151640, 152328,
  153012, 153698, 154385, 155071, 155756, 156446, 157131, 157817, 158501, 159191,
  159876, 160564, 161252, 161936, 162624, 163310, 163996, 164678, 165370, 166054,
  166740,
];

const TABEL_MIN_PUNTEN = 40;
const TABEL_MAX_PUNTEN = 250;

/** Exacte maximale huurprijs 2026 in centen; null buiten 40–250 punten. */
export function maxHuur2026Cents(punten: number): number | null {
  if (!Number.isInteger(punten) || punten < TABEL_MIN_PUNTEN || punten > TABEL_MAX_PUNTEN) {
    return null;
  }
  return MAX_HUUR_TABEL_2026_CENTS[punten - TABEL_MIN_PUNTEN];
}

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
 * Maximale huurprijs per 1-1-2026 voor een puntenaantal. Sinds de F2b-import
 * van de volledige tabel is dit voor elk aantal in 40–250 exact (band ==
 * exact); de band-vorm blijft bestaan zodat F3 er stabiel op kan bouwen.
 * Buiten 40–250: null (geen extrapolatie).
 */
export function maxHuurBand2026Cents(punten: number): MaxHuurBand {
  const exact = maxHuur2026Cents(punten);
  return { exactCents: exact, ondergrensCents: exact, bovengrensCents: exact };
}

/** Opslagen op de maximale huurPRIJS (BHW art. 8a) — F3 past ze toe. */
export const HUURPRIJS_OPSLAG_PCT = {
  rijksmonumentNieuwContract: 35,
  gemeentelijkMonument: 15,
  beschermdGezicht: 5,
  nieuwbouwopslagMiddenhuur: 10,
} as const;

/**
 * lib/toeslagen.ts — gratis "geld-check": indicatie van gemiste toeslagen +
 * gemeente-regelingen. PURE functie (geen I/O, geen opslag) zodat 'ie
 * client-side draait: het inkomen van de gebruiker verlaat de browser nooit.
 *
 * ⚠️ BRON-VAN-WAARHEID: alle grenzen/bedragen komen EXACT uit
 * docs/BENEFITS_DATA_2026.md (gesourcet, peildatum 2026). Niets gokken.
 * Onzeker → indicatie + verwijzing naar de officiële proefberekening; nooit
 * een afbouw-formule of exact bedrag faken.
 *
 * Dit is een INDICATIE, geen advies of toekenning (zie disclaimer).
 */

/** Peildatum van de gehanteerde grenzen/bedragen (per 1 januari 2026). */
export const TOESLAGEN_PEILDATUM = "2026-01-01";
/** Datum waarop de cijfers tegen de officiële bronnen zijn geverifieerd. */
export const TOESLAGEN_VERIFIED_AT = "2026-05-23";

// ─── ZORGTOESLAG 2026 ────────────────────────────────────────────────────────
// bron: Belastingdienst (max. inkomen + vermogen zorgtoeslag) · Zorgwijzer 2026
// zie docs/BENEFITS_DATA_2026.md
const ZORG = {
  maxInkomenAlleenstaandCents: 4_085_700, // € 40.857 / jr
  maxInkomenPartnerCents: 5_114_200, //      € 51.142 / jr (gezamenlijk)
  maxVermogenAlleenstaandCents: 14_601_100, // € 146.011 (1-1-2026)
  maxVermogenPartnerCents: 18_463_300, //     € 184.633
  maxToeslagAlleenstaandMaandCents: 12_900, // € 129 / mnd (bovengrens)
  maxToeslagPartnerMaandCents: 24_600, //     € 246 / mnd (bovengrens)
} as const;

// ─── HUURTOESLAG 2026 (complexe formule → indicatie + verwijzing) ────────────
// bron: Rijksoverheid (huurtoeslagparameters 2026) · Woonbond
// zie docs/BENEFITS_DATA_2026.md
const HUUR = {
  // ⚠️ NIEUW 2026: € 932,93 is GÉÉN toegangsdrempel meer — alleen aftopping in
  // de officiële berekening. Niet gebruiken als huur-plafond in de check.
  aftoppingMaxHuurCents: 93_293, //          € 932,93 / mnd
  maxVermogenPerPersoonCents: 3_847_900, //  € 38.479 (≈ 2× voor partners)
} as const;

// ─── KINDGEBONDEN BUDGET 2026 ────────────────────────────────────────────────
// bron: Consumentenbond (bedragen 2026) · Belastingdienst (max. inkomen)
// zie docs/BENEFITS_DATA_2026.md
const KGB = {
  perKindOnder12JaarCents: 258_000, //  € 2.580 / jr
  perKind12tot16JaarCents: 328_300, //  € 3.283 / jr
  perKind16tot17JaarCents: 351_600, //  € 3.516 / jr
  aloKopJaarCents: 332_000, //          ca. € 3.320 / jr (alleenstaande ouder)
  maxInkomenVolBedragAlleenstaandCents: 2_973_600, // € 29.736 / jr
  maxInkomenVolBedragPartnerCents: 3_914_100, //      € 39.141 / jr
  maxVermogenAlleenstaandCents: 14_601_100, // € 146.011
  maxVermogenPartnerCents: 18_463_300, //     € 184.633
} as const;

// Officiële aanvraag-/proefberekening-pagina's (Belastingdienst-landing pattern
// /{topic}/{topic} resolvet; bevat de proefberekening-knop). Nibud voor gemeente.
const URLS = {
  zorgtoeslag:
    "https://www.belastingdienst.nl/wps/wcm/connect/nl/zorgtoeslag/zorgtoeslag",
  huurtoeslag:
    "https://www.belastingdienst.nl/wps/wcm/connect/nl/huurtoeslag/huurtoeslag",
  kindgebonden:
    "https://www.belastingdienst.nl/wps/wcm/connect/nl/kindgebonden-budget/kindgebonden-budget",
  gemeente: "https://berekenuwrecht.nibud.nl/",
} as const;

const BRONNEN = {
  zorgtoeslag:
    "https://www.belastingdienst.nl/wps/wcm/connect/nl/zorgtoeslag/content/maximaal-inkomen-voor-zorgtoeslag",
  huurtoeslag:
    "https://www.rijksoverheid.nl/actueel/nieuws/2025/11/25/indexering-inkomensgrenzen-woningcorporaties-maximale-huurprijsgrenzen-en-huurtoeslagparameters-2026",
  kindgebonden: "https://www.consumentenbond.nl/toeslagen/kindgebonden-budget",
  gemeente: "https://berekenuwrecht.nibud.nl/",
} as const;

export type Huishouden = "alleenstaand" | "met_partner";

export type GeldCheckInput = {
  huishouden: Huishouden;
  /** Leeftijd van de aanvrager (jaren). */
  leeftijd: number;
  /** Geschat bruto jaar(toetsings)inkomen van het huishouden, in cents. */
  brutoJaarinkomenCents: number;
  /** Box-3 vermogen op 1 januari, in cents. */
  vermogenCents: number;
  /** Kale huur per maand in cents; null = koopwoning / geen huurder. */
  kaleHuurPerMaandCents: number | null;
  /** Leeftijden van inwonende kinderen (< 18 telt voor kindgebonden budget). */
  kinderen: { leeftijd: number }[];
  /** Optioneel — alleen voor de gemeente-verwijzing, niet voor een berekening. */
  postcode?: string | null;
};

export type BenefitStatus = "likely" | "maybe" | "unlikely";

export type BenefitEstimate = {
  id: "zorgtoeslag" | "huurtoeslag" | "kindgebonden_budget" | "gemeente";
  naam: string;
  status: BenefitStatus;
  /** Bovengrens-indicatie per maand (cents). null = bedrag niet zelf te schatten. */
  indicatieMaandCents: number | null;
  /** Bovengrens-indicatie per jaar (cents) — voor kindgebonden budget. */
  indicatieJaarCents: number | null;
  /** Korte kop, bv. "tot € 129/mnd" of "Mogelijk recht". */
  kop: string;
  /** Eerlijke uitleg incl. waarom het een indicatie is. */
  uitleg: string;
  aanvraagUrl: string;
  bron: string;
};

export type GeldCheckResult = {
  estimates: BenefitEstimate[];
  /**
   * Som van de maandelijkse bovengrenzen die we wél kunnen schatten
   * (zorgtoeslag + kindgebonden/12). Huurtoeslag/gemeente tellen NIET mee
   * (geen eigen bedrag) → eerlijk als "tot € X/mnd, plus mogelijk huurtoeslag".
   */
  totaalIndicatieMaandCents: number;
  peildatum: string;
  disclaimer: string;
};

export const GELD_CHECK_DISCLAIMER =
  "Dit is een schatting/indicatie, geen advies of toekenning. Grenzen en bedragen: " +
  "peildatum 2026. Het exacte bedrag bepaalt de Belastingdienst (of je gemeente) op " +
  "basis van je volledige situatie — controleer en vraag aan via de officiële " +
  "proefberekening. DeGeldHeld slaat je inkomens- en vermogensgegevens niet op: deze " +
  "check rekent in je eigen browser.";

function maxInkomen(input: GeldCheckInput, alleen: number, partner: number): number {
  return input.huishouden === "alleenstaand" ? alleen : partner;
}

/** Zorgtoeslag — relatief hard te schatten (vaste grenzen + max-bedrag). */
export function estimateZorgtoeslag(input: GeldCheckInput): BenefitEstimate {
  const base = {
    id: "zorgtoeslag" as const,
    naam: "Zorgtoeslag",
    aanvraagUrl: URLS.zorgtoeslag,
    bron: BRONNEN.zorgtoeslag,
    indicatieJaarCents: null,
  };
  if (input.leeftijd < 18) {
    return {
      ...base,
      status: "unlikely",
      indicatieMaandCents: null,
      kop: "Vanaf 18 jaar",
      uitleg: "Zorgtoeslag kan vanaf 18 jaar, als je een Nederlandse basisverzekering hebt.",
    };
  }
  const inkomenGrens = maxInkomen(
    input,
    ZORG.maxInkomenAlleenstaandCents,
    ZORG.maxInkomenPartnerCents,
  );
  const vermogenGrens = maxInkomen(
    input,
    ZORG.maxVermogenAlleenstaandCents,
    ZORG.maxVermogenPartnerCents,
  );
  if (input.vermogenCents > vermogenGrens) {
    return {
      ...base,
      status: "unlikely",
      indicatieMaandCents: null,
      kop: "Vermogen te hoog",
      uitleg: "Je vermogen ligt boven de grens voor zorgtoeslag in 2026.",
    };
  }
  if (input.brutoJaarinkomenCents > inkomenGrens) {
    return {
      ...base,
      status: "unlikely",
      indicatieMaandCents: null,
      kop: "Inkomen te hoog",
      uitleg: "Je inkomen ligt boven de grens voor zorgtoeslag in 2026.",
    };
  }
  const maxMaand =
    input.huishouden === "alleenstaand"
      ? ZORG.maxToeslagAlleenstaandMaandCents
      : ZORG.maxToeslagPartnerMaandCents;
  return {
    ...base,
    status: "likely",
    indicatieMaandCents: maxMaand,
    kop: "tot € " + (maxMaand / 100).toFixed(0) + "/mnd",
    uitleg:
      "Je komt waarschijnlijk in aanmerking. Het exacte bedrag hangt af van je inkomen " +
      "en daalt richting de grens — dit is de maximale indicatie. Vraag aan of doe een " +
      "proefberekening bij de Belastingdienst.",
  };
}

/** Huurtoeslag — complexe formule → indicatie + verwijzing (geen eigen bedrag). */
export function estimateHuurtoeslag(input: GeldCheckInput): BenefitEstimate {
  const base = {
    id: "huurtoeslag" as const,
    naam: "Huurtoeslag",
    aanvraagUrl: URLS.huurtoeslag,
    bron: BRONNEN.huurtoeslag,
    indicatieMaandCents: null,
    indicatieJaarCents: null,
  };
  if (input.kaleHuurPerMaandCents == null || input.kaleHuurPerMaandCents <= 0) {
    return {
      ...base,
      status: "unlikely",
      kop: "Alleen voor huurders",
      uitleg: "Huurtoeslag is er voor huurders. Bij een koopwoning geldt het niet.",
    };
  }
  // ⚠️ 2026: GEEN huur-plafond als drempel (max-huurgrens vervallen als voorwaarde).
  const vermogenGrens =
    input.huishouden === "alleenstaand"
      ? HUUR.maxVermogenPerPersoonCents
      : HUUR.maxVermogenPerPersoonCents * 2;
  if (input.vermogenCents > vermogenGrens) {
    return {
      ...base,
      status: "unlikely",
      kop: "Vermogen te hoog",
      uitleg: "Je vermogen ligt boven de grens voor huurtoeslag in 2026.",
    };
  }
  return {
    ...base,
    status: "maybe",
    kop: "Mogelijk recht",
    uitleg:
      "Je huurt en je vermogen valt binnen de grens, dus je komt mogelijk in aanmerking. " +
      "Er is geen vaste inkomensgrens — het bedrag hangt af van je huur en huishouden. " +
      "Nieuw in 2026: ook met een hogere huur kun je nog huurtoeslag krijgen. Doe de " +
      "officiële proefberekening voor je exacte bedrag.",
  };
}

function kindgebondenPerKindCents(leeftijd: number): number {
  if (leeftijd < 12) return KGB.perKindOnder12JaarCents;
  if (leeftijd < 16) return KGB.perKind12tot16JaarCents;
  if (leeftijd < 18) return KGB.perKind16tot17JaarCents;
  return 0; // 18+ telt niet mee
}

/** Kindgebonden budget — per-kind-bedragen hard; totaal = bovengrens-indicatie. */
export function estimateKindgebonden(input: GeldCheckInput): BenefitEstimate {
  const base = {
    id: "kindgebonden_budget" as const,
    naam: "Kindgebonden budget",
    aanvraagUrl: URLS.kindgebonden,
    bron: BRONNEN.kindgebonden,
    indicatieMaandCents: null,
  };
  const kinderenOnder18 = input.kinderen.filter((k) => k.leeftijd < 18);
  if (kinderenOnder18.length === 0) {
    return {
      ...base,
      status: "unlikely",
      indicatieJaarCents: null,
      kop: "Voor ouders met kinderen",
      uitleg: "Kindgebonden budget is er voor ouders met kinderen jonger dan 18 jaar.",
    };
  }
  const vermogenGrens = maxInkomen(
    input,
    KGB.maxVermogenAlleenstaandCents,
    KGB.maxVermogenPartnerCents,
  );
  if (input.vermogenCents > vermogenGrens) {
    return {
      ...base,
      status: "unlikely",
      indicatieJaarCents: null,
      kop: "Vermogen te hoog",
      uitleg: "Je vermogen ligt boven de grens voor kindgebonden budget in 2026.",
    };
  }
  let maxJaar = kinderenOnder18.reduce((sum, k) => sum + kindgebondenPerKindCents(k.leeftijd), 0);
  if (input.huishouden === "alleenstaand") maxJaar += KGB.aloKopJaarCents;

  const inkomenGrensVol = maxInkomen(
    input,
    KGB.maxInkomenVolBedragAlleenstaandCents,
    KGB.maxInkomenVolBedragPartnerCents,
  );
  const kopJaar = "tot € " + (maxJaar / 100).toLocaleString("nl-NL") + "/jr";
  if (input.brutoJaarinkomenCents <= inkomenGrensVol) {
    return {
      ...base,
      status: "likely",
      indicatieJaarCents: maxJaar,
      kop: kopJaar,
      uitleg:
        "Met jouw inkomen kom je waarschijnlijk in aanmerking voor (bijna) het volledige " +
        "bedrag. Dit is de maximale indicatie; het exacte bedrag bepaalt de Belastingdienst.",
    };
  }
  return {
    ...base,
    status: "maybe",
    indicatieJaarCents: maxJaar,
    kop: kopJaar + " (bouwt af)",
    uitleg:
      "Boven de inkomensgrens bouwt het kindgebonden budget af (geen harde nul). Je hebt " +
      "mogelijk nog recht op een deel — het getoonde bedrag is de bovengrens. Doe een " +
      "proefberekening bij de Belastingdienst voor je exacte bedrag.",
  };
}

/**
 * Gemeente-regelingen — model (Nibud "Bereken je Recht"), géén eigen bedragen.
 * We gokken geen per-gemeente bedragen; we wijzen naar de officiële check.
 */
export function estimateGemeente(input: GeldCheckInput): BenefitEstimate {
  const base = {
    id: "gemeente" as const,
    naam: "Gemeente-regelingen",
    aanvraagUrl: URLS.gemeente,
    bron: BRONNEN.gemeente,
    indicatieMaandCents: null,
    indicatieJaarCents: null,
  };
  // "Modest income"-proxy: hergebruik de (gesourcete) kindgebonden-volbedrag-grens
  // als indicatieve lijn voor "laag/modaal inkomen". Geen verzonnen drempel.
  const lageInkomensLijn = maxInkomen(
    input,
    KGB.maxInkomenVolBedragAlleenstaandCents,
    KGB.maxInkomenVolBedragPartnerCents,
  );
  const waarschijnlijk = input.brutoJaarinkomenCents <= lageInkomensLijn;
  const waar = input.postcode ? "jouw gemeente" : "je gemeente";
  return {
    ...base,
    status: waarschijnlijk ? "likely" : "maybe",
    kop: waarschijnlijk ? "Waarschijnlijk recht" : "Mogelijk recht",
    uitleg:
      `Veel gemeenten hebben extra regelingen (bijzondere bijstand, kwijtschelding ` +
      `gemeentebelasting, individuele inkomenstoeslag, collectieve zorgverzekering). De ` +
      `bedragen verschillen per gemeente. Check via "Bereken je Recht" (Nibud) en bij ` +
      `${waar} waar je voor in aanmerking komt — vaak fors onbenut.`,
  };
}

/** Combineer alle deelschattingen tot één geld-check-resultaat (puur). */
export function estimateBenefits(input: GeldCheckInput): GeldCheckResult {
  const estimates: BenefitEstimate[] = [
    estimateZorgtoeslag(input),
    estimateHuurtoeslag(input),
    estimateKindgebonden(input),
    estimateGemeente(input),
  ];
  // Tel alleen de bedragen die we eerlijk kunnen schatten (zorg + kindgebonden/12).
  let totaalMaand = 0;
  for (const e of estimates) {
    if (e.status === "unlikely") continue;
    if (e.indicatieMaandCents) totaalMaand += e.indicatieMaandCents;
    if (e.indicatieJaarCents) totaalMaand += Math.round(e.indicatieJaarCents / 12);
  }
  return {
    estimates,
    totaalIndicatieMaandCents: totaalMaand,
    peildatum: TOESLAGEN_PEILDATUM,
    disclaimer: GELD_CHECK_DISCLAIMER,
  };
}

/**
 * lib/box3.ts — Box 3 rechtsherstel-check (Wet tegenbewijsregeling).
 *
 * Pure functie (geen I/O, geen opslag) zodat de check **client-side** kan
 * draaien — vermogens-/inkomensgegevens van de gebruiker verlaten de browser
 * nooit. Indicatie of bezwaar/OWR loont; de exacte vermindering bepaalt de
 * Belastingdienst-OWR.
 *
 * ⚠️ BRON-VAN-WAARHEID: alle forfaits / tarieven / heffingsvrij vermogen /
 * deadlines komen EXACT uit docs/V29_DATA_2026.md (Belastingdienst /
 * Rijksoverheid / Wikipedia historie / Hoge Raad). Niets gokken; bij verschil
 * tussen aggregator en Belastingdienst → Belastingdienst wint
 * (bv. 2026 banktegoeden 1,28% NIET 1,44%).
 */

export const BOX3_PEILDATUM = "2026-01-01";
export const BOX3_VERIFIED_AT = "2026-05-24";

/** Belastingjaren waarvoor wij de forfaits voeren. */
export type Box3Jaar = 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026;

/** Forfait-tabel per belastingjaar. Alle percentages × 10000 (basis-punten ÷ 100). */
type Box3Forfait = {
  banktegoedenPct: number; // % fictief rendement op sparen
  overigePct: number; // % fictief rendement op beleggingen / overige
  schuldenPct: number; // % fictieve rente op aftrekbare schulden
  tariefPct: number; // box-3 tarief
};

// bron: Belastingdienst — berekening box 3-inkomen 2026
//   https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/content/berekening-box-3-inkomen-2026
// bron: Belastingdienst — fictief rendement uitleg
//   https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/content/berekening-box-3-inkomen-fictief-rendement
// bron: Wikipedia — Box 3 historische tabel  https://nl.wikipedia.org/wiki/Box_3
const FORFAIT: Record<Box3Jaar, Box3Forfait> = {
  2017: { banktegoedenPct: 0.25, overigePct: 5.39, schuldenPct: 3.43, tariefPct: 30 },
  2018: { banktegoedenPct: 0.12, overigePct: 5.38, schuldenPct: 3.20, tariefPct: 30 },
  2019: { banktegoedenPct: 0.08, overigePct: 5.59, schuldenPct: 3.00, tariefPct: 30 },
  2020: { banktegoedenPct: 0.04, overigePct: 5.28, schuldenPct: 2.74, tariefPct: 30 },
  2021: { banktegoedenPct: 0.01, overigePct: 5.69, schuldenPct: 2.46, tariefPct: 31 },
  2022: { banktegoedenPct: 0.00, overigePct: 5.53, schuldenPct: 2.28, tariefPct: 31 },
  2023: { banktegoedenPct: 0.92, overigePct: 6.17, schuldenPct: 2.46, tariefPct: 32 },
  2024: { banktegoedenPct: 1.44, overigePct: 6.04, schuldenPct: 2.61, tariefPct: 36 },
  2025: { banktegoedenPct: 1.37, overigePct: 5.88, schuldenPct: 2.70, tariefPct: 36 },
  // bron 2026 (officieel — Belastingdienst publiceert 1,28% / 2,70%, aggregators
  // noemen 1,44% — die zijn fout):
  // https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/content/berekening-box-3-inkomen-2026
  2026: { banktegoedenPct: 1.28, overigePct: 6.00, schuldenPct: 2.70, tariefPct: 36 },
};

/** Heffingsvrij vermogen per jaar in cents. */
// bron: Belastingdienst + Wikipedia (historie)
const HEFFINGSVRIJ: Record<Box3Jaar, { alleen: number; partner: number }> = {
  2017: { alleen: 2_500_000, partner: 5_000_000 },
  2018: { alleen: 2_500_000, partner: 5_000_000 },
  2019: { alleen: 2_500_000, partner: 5_000_000 },
  2020: { alleen: 2_500_000, partner: 5_000_000 },
  2021: { alleen: 5_000_000, partner: 10_000_000 },
  2022: { alleen: 5_000_000, partner: 10_000_000 },
  2023: { alleen: 5_700_000, partner: 11_400_000 },
  2024: { alleen: 5_700_000, partner: 11_400_000 },
  2025: { alleen: 5_768_400, partner: 11_536_800 },
  2026: { alleen: 5_935_700, partner: 11_871_400 },
};

/**
 * Schulden-drempel 2026 — schulden boven dit bedrag tellen mee als
 * aftrekbare schulden in de rendementsgrondslag.
 *
 * bron: Belastingdienst — berekening box 3 2026
 *   https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/content/berekening-box-3-inkomen-2026
 */
export const SCHULDEN_DREMPEL_2026_CENTS = 380_000;

/**
 * OWR-/bezwaar-deadlines per belastingjaar. Bron-discipline: éxact uit
 * Rijksoverheid / Belastingdienst / Auxilium / Taxlive (zie V29_DATA_2026.md).
 */
// bron: Auxilium — termijn OWR verlengd tot 1 mei 2026
//   https://auxiliumadviesgroep.nl/nieuws/fiscaal/termijn-indienen-owr-formulier-box-3-verlengd/
// bron: Taxlive — termijn motivering tot 1 oktober 2026
//   https://www.taxlive.nl/nl/documenten/nieuws/termijn-motivering-box-3-bezwaren-verlengd-tot-1-oktober-2026/
export const OWR_DEADLINES = {
  2020: "2025-12-31", // al verstreken voor velen
  zelfIndiener2021_2024: "2026-05-01",
  viaAdviseur2021_2024: "2026-10-01",
} as const;

/**
 * Revenue-gate (uit guardrail 5): NCNP-aanbod alléén bij indicatie van een
 * verwachte teruggave ≥ € 500. Onder die drempel → gratis DIY-brief.
 */
export const BOX3_NCNP_DREMPEL_CENTS = 50_000;

export type Box3Huishouden = "alleenstaand" | "met_partner";

export type Box3Input = {
  jaar: number;
  huishouden: Box3Huishouden;
  /** Banktegoeden + spaargeld op de peildatum (1-1 van jaar), in cents. */
  banktegoedenCents: number;
  /** Overige bezittingen (beleggingen, vastgoed andere dan eigen woning, etc.). */
  overigeBezittingenCents: number;
  /** Totaal aan box-3-schulden in cents (drempel wordt automatisch toegepast). */
  schuldenCents: number;
  /**
   * Werkelijk rendement over het jaar (eigen opgaaf van de gebruiker — interest
   * + dividend + koersresultaat ± aftrekbare kosten), in cents. Mag negatief
   * zijn. Optioneel: zonder werkelijk rendement geven we alleen het fictieve.
   */
  werkelijkRendementCents?: number;
};

export type Box3Status = "likely" | "maybe" | "unlikely";

export type Box3Result = {
  jaar: Box3Jaar;
  fictiefRendementCents: number;
  werkelijkRendementCents: number | null;
  /** Fictieve box-3-belasting (= fictief rendement × aandeel × tarief). */
  ficitieveBelastingCents: number;
  /** Grove indicatie van de mogelijke vermindering bij OWR. */
  verwachteTeruggaveCents: number;
  status: Box3Status;
  /** Wel/niet NCNP-aanbod tonen (gebaseerd op € 500-drempel). */
  biedNcnpAan: boolean;
  /** Korte uitleg voor de gebruiker. */
  uitleg: string;
  /** Deadline-string die past bij dit belastingjaar. */
  deadline: string | null;
  /** Bron-URL voor de Belastingdienst-berekening van dit jaar. */
  bron: string;
  peildatum: string;
};

export const BOX3_DISCLAIMER =
  "Dit is een schatting/indicatie, geen advies of toezegging. De exacte " +
  "vermindering bepaalt de Belastingdienst op basis van het OWR-formulier " +
  "(Opgaaf Werkelijk Rendement) en je hele box-3-positie. DeGeldHeld slaat je " +
  "gegevens niet op: deze check rekent in je eigen browser. Bij complexe " +
  "situaties (eigen woning in box 3, vastgoed, kosten, valuta) → " +
  "belastingadviseur of een RB-/NOB-lid.";

const BRON = {
  per_jaar: (j: number): string =>
    j === 2026
      ? "https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/content/berekening-box-3-inkomen-2026"
      : "https://www.rijksoverheid.nl/onderwerpen/inkomstenbelasting/box-3/tijdlijn-rechtsherstel-box-3",
};

function isSupportedJaar(j: number): j is Box3Jaar {
  return Number.isInteger(j) && j >= 2017 && j <= 2026;
}

function deadlineFor(jaar: Box3Jaar): string | null {
  if (jaar === 2020) return OWR_DEADLINES["2020"];
  if (jaar >= 2021 && jaar <= 2024) return OWR_DEADLINES.zelfIndiener2021_2024;
  return null; // 2017-2019 + 2025-2026 → andere route, generieke verwijzing
}

/**
 * Fictief rendement EXACT volgens de Belastingdienst-formule (6 stappen),
 * vereenvoudigd tot één pure return-value in cents. Geen aandeel-formule:
 * we doen een groove indicatie van het BRUTO fictief rendement; de
 * heffing-aandeel-correctie hangt af van precies hoe Belastingdienst rekent
 * (we benoemen dit in de uitleg).
 */
function fictiefRendementCents(jaar: Box3Jaar, input: Box3Input): number {
  const f = FORFAIT[jaar];
  const aftrekbareSchulden = Math.max(0, input.schuldenCents - SCHULDEN_DREMPEL_2026_CENTS);
  const bank = (input.banktegoedenCents * f.banktegoedenPct) / 100;
  const overig = (input.overigeBezittingenCents * f.overigePct) / 100;
  const schuld = (aftrekbareSchulden * f.schuldenPct) / 100;
  return Math.round(bank + overig - schuld);
}

/**
 * Box 3 rechtsherstel-indicatie. Pure functie.
 *
 * Onder heffingsvrij vermogen → "unlikely" (geen box-3-heffing, dus ook niets
 * om terug te halen). Werkelijk rendement onbekend → "maybe" met enkel het
 * fictieve. Werkelijk < fictief én >0 verschil × tarief → indicatie teruggave.
 */
export function estimateBox3Restitution(input: Box3Input): Box3Result {
  if (!isSupportedJaar(input.jaar)) {
    return {
      jaar: 2026,
      fictiefRendementCents: 0,
      werkelijkRendementCents: null,
      ficitieveBelastingCents: 0,
      verwachteTeruggaveCents: 0,
      status: "unlikely",
      biedNcnpAan: false,
      uitleg:
        "Wij voeren forfaits voor 2017-2026. Voor andere jaren: check de " +
        "Belastingdienst voor de regeling van dat jaar.",
      deadline: null,
      bron: BRON.per_jaar(2026),
      peildatum: BOX3_PEILDATUM,
    };
  }
  const jaar = input.jaar;
  const f = FORFAIT[jaar];
  const hv = HEFFINGSVRIJ[jaar];
  const heffingsvrij =
    input.huishouden === "met_partner" ? hv.partner : hv.alleen;
  const aftrekbareSchulden = Math.max(0, input.schuldenCents - SCHULDEN_DREMPEL_2026_CENTS);
  const rendementsgrondslag =
    input.banktegoedenCents + input.overigeBezittingenCents - aftrekbareSchulden;
  const grondslag = Math.max(0, rendementsgrondslag - heffingsvrij);

  const fictief = fictiefRendementCents(jaar, input);
  // Aandeel × tarief — Belastingdienst rekent voordeel = fictief × aandeel%.
  const aandeel = rendementsgrondslag > 0 ? grondslag / rendementsgrondslag : 0;
  const voordeel = Math.max(0, Math.round(fictief * aandeel));
  const ficitieveBelasting = Math.round((voordeel * f.tariefPct) / 100);

  // Onder heffingsvrij → niets te herstellen.
  if (grondslag <= 0) {
    return {
      jaar,
      fictiefRendementCents: fictief,
      werkelijkRendementCents: input.werkelijkRendementCents ?? null,
      ficitieveBelastingCents: 0,
      verwachteTeruggaveCents: 0,
      status: "unlikely",
      biedNcnpAan: false,
      uitleg:
        `Met dit vermogen blijf je onder het heffingsvrij vermogen van € ` +
        `${(heffingsvrij / 100).toLocaleString("nl-NL")} voor ${jaar} — er is ` +
        `dan geen box-3-belasting, dus ook niets om via OWR terug te halen.`,
      deadline: deadlineFor(jaar),
      bron: BRON.per_jaar(jaar),
      peildatum: BOX3_PEILDATUM,
    };
  }

  // Werkelijk rendement onbekend → alleen fictief tonen, maybe.
  if (input.werkelijkRendementCents == null) {
    return {
      jaar,
      fictiefRendementCents: fictief,
      werkelijkRendementCents: null,
      ficitieveBelastingCents: ficitieveBelasting,
      verwachteTeruggaveCents: 0,
      status: "maybe",
      biedNcnpAan: false,
      uitleg:
        "Vul je werkelijke rendement (interest + dividend + koersresultaat ±) " +
        `in om te zien of OWR voor jou loont. Fictief rekent ${jaar} met ` +
        `${f.banktegoedenPct}% op banktegoeden en ${f.overigePct}% op overige ` +
        "bezittingen — vaak hoger dan wat spaarders/voorzichtige beleggers " +
        "écht hebben gemaakt.",
      deadline: deadlineFor(jaar),
      bron: BRON.per_jaar(jaar),
      peildatum: BOX3_PEILDATUM,
    };
  }

  const werkelijk = input.werkelijkRendementCents;
  const verschil = fictief - werkelijk;

  // Werkelijk ≥ fictief → geen recht op vermindering.
  if (verschil <= 0) {
    return {
      jaar,
      fictiefRendementCents: fictief,
      werkelijkRendementCents: werkelijk,
      ficitieveBelastingCents: ficitieveBelasting,
      verwachteTeruggaveCents: 0,
      status: "unlikely",
      biedNcnpAan: false,
      uitleg:
        `Je werkelijke rendement (${(werkelijk / 100).toLocaleString("nl-NL", { style: "currency", currency: "EUR" })}) ` +
        `ligt op of boven het fictieve rendement (${(fictief / 100).toLocaleString("nl-NL", { style: "currency", currency: "EUR" })}) ` +
        "voor dit jaar — de Wet tegenbewijsregeling levert dan geen vermindering op.",
      deadline: deadlineFor(jaar),
      bron: BRON.per_jaar(jaar),
      peildatum: BOX3_PEILDATUM,
    };
  }

  // Grove schatting: vermindering = verschil × aandeel × tarief.
  const verwachteTeruggave = Math.max(
    0,
    Math.round((verschil * aandeel * f.tariefPct) / 100),
  );
  const status: Box3Status = verwachteTeruggave >= 10_000 ? "likely" : "maybe";
  const biedNcnpAan = verwachteTeruggave >= BOX3_NCNP_DREMPEL_CENTS;

  return {
    jaar,
    fictiefRendementCents: fictief,
    werkelijkRendementCents: werkelijk,
    ficitieveBelastingCents: ficitieveBelasting,
    verwachteTeruggaveCents: verwachteTeruggave,
    status,
    biedNcnpAan,
    uitleg:
      `Op basis van jouw opgave is je werkelijke rendement lager dan het ` +
      `fictieve — een OWR kan je een grove indicatie van ` +
      `${(verwachteTeruggave / 100).toLocaleString("nl-NL", { style: "currency", currency: "EUR" })} ` +
      "opleveren. Dit is een schatting; het exacte bedrag bepaalt de " +
      "Belastingdienst op basis van je volledige situatie.",
    deadline: deadlineFor(jaar),
    bron: BRON.per_jaar(jaar),
    peildatum: BOX3_PEILDATUM,
  };
}

/** Genereer een DIY-OWR-brief / motivatie-tekst (geen DigiD-overname). */
export function box3DiyBrief(input: Box3Input, result: Box3Result): string {
  const jaar = result.jaar;
  const eurFmt = (c: number) =>
    (c / 100).toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
  return `Geachte Inspecteur,

Hierbij dien ik via het OWR-formulier (Opgaaf Werkelijk Rendement) een verzoek
om vermindering in voor mijn box-3-belasting over het belastingjaar ${jaar}.

Volgens de Wet tegenbewijsregeling Box 3 (van kracht sinds 19 juli 2025) heb ik
recht op herziening wanneer mijn werkelijke rendement lager is dan het door
de Belastingdienst gehanteerde fictieve rendement.

Indicatieve cijfers (peildatum 1 januari ${jaar}):
- Banktegoeden: ${eurFmt(input.banktegoedenCents)}
- Overige bezittingen: ${eurFmt(input.overigeBezittingenCents)}
- Schulden (totaal): ${eurFmt(input.schuldenCents)}
- Fictief rendement (forfait): ${eurFmt(result.fictiefRendementCents)}
- Werkelijk rendement (eigen opgaaf): ${result.werkelijkRendementCents != null ? eurFmt(result.werkelijkRendementCents) : "—"}
- Geschatte vermindering: ${eurFmt(result.verwachteTeruggaveCents)} (grove schatting; definitief bedrag bepaalt de Belastingdienst)

De bijbehorende bewijsstukken (jaaroverzichten bank, dividend-/koersresultaat
beleggingen, etc.) lever ik aan via MijnBelastingdienst → OWR-formulier.

Met vriendelijke groet,
[Naam, BSN, postadres]
`;
}

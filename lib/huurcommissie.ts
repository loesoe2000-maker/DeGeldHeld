/**
 * lib/huurcommissie.ts — V35 DEEL 1 — Huurcommissie-bezwaar servicekosten.
 *
 * Pure functie (geen I/O, geen opslag) zodat de check **client-side** kan
 * draaien — voorschot/werkelijke kosten + huurcontract-vlaggen van de
 * gebruiker verlaten de browser nooit. Indicatie of bezwaar bij verhuurder /
 * Huurcommissie loont; het exacte bedrag bepaalt de Huurcommissie na
 * onderzoek van de servicekosten-administratie.
 *
 * ⚠️ BRON-VAN-WAARHEID: alle deadlines + leges komen EXACT uit
 * docs/V35_DATA_2026.md (Huurcommissie / BW / Beleidsboek Servicekosten
 * januari 2026). Niets gokken; aggregators verliezen het van officiële bronnen.
 *
 * Privacy: deze module bevat GEEN PII-gevoelige opslag-logica. Eerst
 * client-side rekenen; alleen bij NCNP-keuze maakt de route een
 * HuurServicekostenClaim-record (AVG art. 6 lid 1b — uitvoering overeenkomst).
 */

import { NO_CURE_NO_PAY_FEE_CAP_CENTS } from "@/lib/payments";

export const HUURCOMMISSIE_PEILDATUM = "2026-01-01";
export const HUURCOMMISSIE_VERIFIED_AT = "2026-05-26";

// ─── Wettelijke termijnen + leges (EXACT uit docs/V35_DATA_2026.md) ─────────

// bron: Huurcommissie — jaarafrekening servicekosten beoordelen
//   https://www.huurcommissie.nl/onderwerpen/servicekosten-verhuurder/jaarafrekening-beoordelen
// bron: Beleidsboek Servicekosten januari 2026 (PDF)
//   https://www.huurcommissie.nl/site/binaries/site-content/collections/documents/2026/01/01/beleidsboek-servicekosten/beleidsboek-servicekosten-januari-2026.pdf
// bron: Huurgeschil.nl — termijn bezwaar
//   https://huurgeschil.nl/termijn-van-bezwaar-bij-de-huurcommissie/

/** Indienings-leges Huurcommissie (terug bij winst). */
export const HUURCOMMISSIE_LEGES_CENTS = 2_500; // € 25,00
/** Reactietijd verhuurder op schriftelijk bezwaar van de huurder (procedureregels). */
export const HUURCOMMISSIE_VERHUURDER_REACTIE_DAGEN = 21;
/** Gemiddelde behandelingstijd Huurcommissie (NOS-rapportage 2024 — 4-6 mnd). */
export const HUURCOMMISSIE_BEHANDELING_MAANDEN = 5;
/** Wettelijke deadline verhuurder voor versturen eindafrekening (art. 7:259 BW). */
export const HUURCOMMISSIE_AFREKENING_DEADLINE_MAANDEN = 6;
/**
 * Maximale bezwaartermijn huurder bij Huurcommissie: 24 maanden na het einde van
 * de 6-maandsperiode (art. 7:260 lid 2 BW). Concreet voor 2025-afrekening:
 * deadline 30 juni 2028 (= 30 juni 2026 + 24 mnd).
 */
export const HUURCOMMISSIE_BEZWAAR_DEADLINE_MAANDEN = 24;

// ─── NCNP-gate (€ 50 = lagere drempel dan Box 3's € 500) ────────────────────

/**
 * HARDE drempel V35 (guardrail 5): NCNP-aanbod alléén bij verwachte
 * restitutie ≥ € 50. Servicekosten-restituties zijn doorgaans kleiner dan
 * Box 3-rechtsherstel — dus lagere drempel, maar nog steeds eerlijk
 * (geen fee op € 0,50-claims).
 */
export const HUUR_NCNP_DREMPEL_CENTS = 5_000;

/** NCNP-fee-percentage op het werkelijk teruggehaalde bedrag. */
export const HUUR_NCNP_FEE_PCT = 0.2; // 20% (vs. Box 3's 25%)

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Rode-vlaggen-checklist (sourced uit docs/V35_DATA_2026.md
 * "Rode vlaggen voor onze check"). Élk veld is een ja/nee-antwoord van de
 * gebruiker — booleans, geen vrije tekst.
 */
export type HuurRodeVlaggen = {
  /** "Geen specificatie per post" → bijna altijd bezwaar-grond. */
  geenSpecificatie: boolean;
  /** "Geen onderliggende facturen ondanks verzoek" → bezwaar-grond. */
  geenFacturen: boolean;
  /** "Posten die niet in huurcontract staan" → bezwaar-grond. */
  postenNietInContract: boolean;
  /** "Eigenaarslasten verrekend" (OZB, opstal, hypotheek, vervanging) → bezwaar-grond. */
  eigenaarslastenVerrekend: boolean;
  /**
   * "Verhuurder stuurde geen afrekening" — wettelijke deadline 6 mnd
   * verstreken → AUTOMATISCH restitutie van álle voorschotten.
   */
  verhuurderGeenAfrekening: boolean;
  /** "Voorschot >> werkelijke kosten zonder restitutie" → directe restitutie-vordering. */
  voorschotVeelGroterDanWerkelijk: boolean;
};

export type HuurServicekostenInput = {
  /** Boekjaar van de afrekening (bv. 2024 → afrekening uiterlijk 30-6-2025). */
  boekjaar: number;
  /** Totaal aan voorschot-bedragen die huurder dat jaar betaalde (in cents). */
  voorschotTotaalCents: number;
  /**
   * Totaal aan werkelijke kosten volgens de afrekening (in cents). Null/0 als
   * verhuurder géén afrekening heeft gestuurd (vlag verhuurderGeenAfrekening).
   */
  werkelijkeKostenTotaalCents: number;
  /** Rode vlaggen die de gebruiker heeft aangevinkt. */
  rodeVlaggen: HuurRodeVlaggen;
  /** Optioneel: naam verhuurder (voor pre-gefilde DIY-brief — niet opgeslagen). */
  verhuurderNaam?: string;
};

export type HuurServicekostenStatus = "likely" | "maybe" | "unlikely";

export type HuurServicekostenResult = {
  boekjaar: number;
  /** Bovengrens-indicatie van de restitutie (overschot voorschot + verdachte posten). */
  verwachteRestitutieCents: number;
  rodeVlaggenAantal: number;
  status: HuurServicekostenStatus;
  /** Wel/niet NCNP-aanbod tonen (≥ € 50 gate). */
  biedNcnpAan: boolean;
  uitleg: string;
  deadlinesContext: {
    /** Wanneer verhuurder eindafrekening moest sturen (6 mnd na boekjaar). */
    wettelijkeAfrekeningDeadline: string;
    /** Tot wanneer huurder bezwaar mag indienen bij Huurcommissie. */
    bezwaarDeadlineHuurcommissie: string;
  };
  bron: string;
  peildatum: string;
};

// ─── Validatie ──────────────────────────────────────────────────────────────

/**
 * Validatie voor `POST /api/huurcommissie/claim` body. Pure functie.
 * < € 50 → reject "below-ncnp-threshold" (422 — geen stille acceptatie).
 */
export type HuurClaimIntentInput = {
  boekjaar: unknown;
  verwachteRestitutieCents: unknown;
  verhuurderNaam?: unknown;
};
export type HuurClaimIntentValidation =
  | {
      ok: true;
      boekjaar: number;
      verwachteRestitutieCents: number;
      verhuurderNaam: string | null;
    }
  | { ok: false; reason: "invalid-boekjaar" | "invalid-amount" | "below-ncnp-threshold" };

export const HUUR_MIN_BOEKJAAR = 2020;
/**
 * Max-boekjaar = lopend kalenderjaar - 1. Wij draaien op statische 2026; de
 * eindafrekening over 2025 moet uiterlijk 30 juni 2026 komen. Afrekening over
 * 2026 zelf komt pas medio 2027 → niet claim-bar in V35.
 */
export const HUUR_MAX_BOEKJAAR = 2025;

export function validateHuurClaimIntent(input: HuurClaimIntentInput): HuurClaimIntentValidation {
  const bj = typeof input.boekjaar === "number" ? input.boekjaar : Number(input.boekjaar);
  if (!Number.isInteger(bj) || bj < HUUR_MIN_BOEKJAAR || bj > HUUR_MAX_BOEKJAAR) {
    return { ok: false, reason: "invalid-boekjaar" };
  }
  const cents =
    typeof input.verwachteRestitutieCents === "number"
      ? input.verwachteRestitutieCents
      : Number(input.verwachteRestitutieCents);
  if (!Number.isInteger(cents) || cents <= 0) {
    return { ok: false, reason: "invalid-amount" };
  }
  // v41 — GRATIS PLATFORM: de drempel bestond om te bepalen of een fee
  // loonde. Er is geen fee meer, dus we weigeren niemand meer op
  // geldgrond. De reden blijft in het type staan voor oude callers.
  const naam =
    typeof input.verhuurderNaam === "string" && input.verhuurderNaam.trim().length > 0
      ? input.verhuurderNaam.trim().slice(0, 200) // hard-cap tegen abuse
      : null;
  return { ok: true, boekjaar: bj, verwachteRestitutieCents: cents, verhuurderNaam: naam };
}

// ─── Fee-berekening (handmatige proof-back; geen OCR in V35) ────────────────

/**
 * Fee op het werkelijk teruggehaalde bedrag (handmatig ingevoerd via
 * /api/huurcommissie/uitspraak).
 *  - werkelijk < € 50 → fee € 0 (eerlijk; ook al was indicatie hoger).
 *  - anders → 20% × werkelijk, gecapt op de standaard NCNP-cap (€ 500).
 */
export function computeHuurFee(werkelijkeRestitutieCents: number): number {
  // v41 — GRATIS PLATFORM. DeGeldHeld rekent geen enkele fee meer.
  return 0;
}

// ─── Engine — pure indicatie ────────────────────────────────────────────────

function deadlineStrings(boekjaar: number): {
  wettelijkeAfrekeningDeadline: string;
  bezwaarDeadlineHuurcommissie: string;
} {
  // Afrekening uiterlijk 6 maanden na boekjaar (art. 7:259 BW).
  // Bezwaar bij Huurcommissie uiterlijk 24 mnd na die deadline (art. 7:260 lid 2 BW).
  // Voor 2025-afrekening: deadline 30 juni 2026, bezwaartermijn tot 30 juni 2028.
  const afrekJaar = boekjaar + 1;
  const bezwaarJaar = afrekJaar + 2;
  return {
    wettelijkeAfrekeningDeadline: `30 juni ${afrekJaar}`,
    bezwaarDeadlineHuurcommissie: `30 juni ${bezwaarJaar}`,
  };
}

function countRodeVlaggen(rv: HuurRodeVlaggen): number {
  return (
    Number(rv.geenSpecificatie) +
    Number(rv.geenFacturen) +
    Number(rv.postenNietInContract) +
    Number(rv.eigenaarslastenVerrekend) +
    Number(rv.verhuurderGeenAfrekening) +
    Number(rv.voorschotVeelGroterDanWerkelijk)
  );
}

/**
 * Bereken bovengrens-restitutie. **Geen exact bedrag** — Huurcommissie bepaalt
 * definitief. Onze schatting:
 *  - verhuurder-geen-afrekening (vlag) → 100% van voorschot is restitutie
 *  - voorschot > werkelijke kosten → het overschot is restitutie
 *  - bovenop: per andere rode vlag een geschatte verdacht-bedrag-fractie
 *    (we kennen de exacte posten niet; toon dat we breed kijken, niet smal).
 */
export function estimateHuurServicekostenRestitutie(
  input: HuurServicekostenInput,
): HuurServicekostenResult {
  const rvCount = countRodeVlaggen(input.rodeVlaggen);
  const deadlines = deadlineStrings(input.boekjaar);
  const bron = "https://www.huurcommissie.nl/onderwerpen/servicekosten-verhuurder/jaarafrekening-beoordelen";

  // Vlag 5: verhuurder stuurde geen afrekening → álle voorschotten terug.
  if (input.rodeVlaggen.verhuurderGeenAfrekening) {
    const verwacht = Math.max(0, Math.round(input.voorschotTotaalCents));
    return {
      boekjaar: input.boekjaar,
      verwachteRestitutieCents: verwacht,
      rodeVlaggenAantal: rvCount,
      status: verwacht >= HUUR_NCNP_DREMPEL_CENTS ? "likely" : verwacht > 0 ? "maybe" : "unlikely",
      biedNcnpAan: verwacht >= HUUR_NCNP_DREMPEL_CENTS,
      uitleg:
        `Verhuurder stuurde geen eindafrekening servicekosten over ${input.boekjaar}, ` +
        `terwijl die wettelijk uiterlijk ${deadlines.wettelijkeAfrekeningDeadline} ` +
        `binnen had moeten zijn (art. 7:259 BW). Bij ontbrekende afrekening kun je ` +
        `aanspraak maken op restitutie van álle voorschotten — bovengrens-indicatie ` +
        `hieronder. De Huurcommissie bepaalt het exacte bedrag.`,
      deadlinesContext: deadlines,
      bron,
      peildatum: HUURCOMMISSIE_PEILDATUM,
    };
  }

  // Vlag 6: voorschot > werkelijke kosten — overschot is directe vordering.
  const overschot = Math.max(0, input.voorschotTotaalCents - input.werkelijkeKostenTotaalCents);

  // Extra verdacht: voor élke andere rode vlag boven 'geenAfrekening',
  // veronderstellen we 10% van de werkelijke-kosten als VERDACHTE posten.
  // (Conservatieve schatting — niet pretenderen exact te weten welke posten.)
  // We tellen MAX 4 andere vlaggen, dus max 40% van de werkelijke kosten.
  const andereVlaggenNum =
    Number(input.rodeVlaggen.geenSpecificatie) +
    Number(input.rodeVlaggen.geenFacturen) +
    Number(input.rodeVlaggen.postenNietInContract) +
    Number(input.rodeVlaggen.eigenaarslastenVerrekend);
  const verdachtBedrag = Math.round(
    Math.max(0, input.werkelijkeKostenTotaalCents) * Math.min(andereVlaggenNum * 0.1, 0.4),
  );

  const verwacht = overschot + verdachtBedrag;
  let status: HuurServicekostenStatus;
  if (verwacht >= HUUR_NCNP_DREMPEL_CENTS && rvCount >= 1) status = "likely";
  else if (verwacht > 0) status = "maybe";
  else status = "unlikely";

  const uitleg =
    verwacht > 0
      ? `Indicatie restitutie: bovengrens € ${(verwacht / 100).toLocaleString("nl-NL")} ` +
        `(${overschot > 0 ? `€ ${(overschot / 100).toLocaleString("nl-NL")} overschot voorschot` : "geen overschot"}` +
        `${andereVlaggenNum > 0 ? ` + ${andereVlaggenNum} andere rode vlag(gen)` : ""}). ` +
        `De Huurcommissie bepaalt het exacte bedrag na onderzoek van de administratie.`
      : `Geen evident overschot of rode vlaggen — bezwaar lijkt nu niet kansrijk. ` +
        `Twijfel je of een specifieke post wel mag? Stel je vraag bij Juridisch Loket ` +
        `of Huurcommissie zelf voordat je formeel bezwaar maakt.`;

  return {
    boekjaar: input.boekjaar,
    verwachteRestitutieCents: verwacht,
    rodeVlaggenAantal: rvCount,
    status,
    biedNcnpAan: verwacht >= HUUR_NCNP_DREMPEL_CENTS && rvCount >= 1,
    uitleg,
    deadlinesContext: deadlines,
    bron,
    peildatum: HUURCOMMISSIE_PEILDATUM,
  };
}

/** Pure-helper: moet de UI de NCNP-CTA tonen voor dit resultaat? */
export function shouldOfferHuurNcnp(result: HuurServicekostenResult): boolean {
  return result.biedNcnpAan && result.verwachteRestitutieCents >= HUUR_NCNP_DREMPEL_CENTS;
}

// ─── DIY-brief-generator ────────────────────────────────────────────────────

export const HUUR_DISCLAIMER =
  "Dit is een indicatie, geen juridisch advies. De Huurcommissie bepaalt het " +
  "exacte bedrag na onderzoek van de servicekosten-administratie en facturen. " +
  "DeGeldHeld slaat je gegevens niet op — deze check rekent in je eigen browser. " +
  "Onze tool kan een eerste indicatie geven van rode vlaggen, maar vervangt geen " +
  "rechtskundig advies. Bij complexe situaties: Juridisch Loket (gratis) of een " +
  "huurrecht-advocaat.";

export function huurBezwaarBrief(
  input: HuurServicekostenInput,
  result: HuurServicekostenResult,
): string {
  const lines: string[] = [];
  const aanhef = input.verhuurderNaam ? `Aan ${input.verhuurderNaam}` : "Geachte verhuurder";
  lines.push(aanhef + ",");
  lines.push("");
  lines.push(
    `Hierbij maak ik schriftelijk bezwaar tegen de jaarafrekening servicekosten ` +
      `over boekjaar ${input.boekjaar}.`,
  );
  lines.push("");

  const flaggenLines: string[] = [];
  if (input.rodeVlaggen.verhuurderGeenAfrekening) {
    flaggenLines.push(
      `- Ik heb géén eindafrekening servicekosten over ${input.boekjaar} ontvangen. ` +
        `Conform art. 7:259 BW had die uiterlijk ${result.deadlinesContext.wettelijkeAfrekeningDeadline} ` +
        `verstuurd moeten worden. Ik verzoek u alle voorschotten te restitueren of binnen 3 weken ` +
        `alsnog een onderbouwde afrekening te sturen.`,
    );
  }
  if (input.rodeVlaggen.geenSpecificatie) {
    flaggenLines.push(
      `- De afrekening bevat geen specificatie per post. Conform het Beleidsboek ` +
        `Servicekosten januari 2026 is een gespecificeerde opgave per post vereist.`,
    );
  }
  if (input.rodeVlaggen.geenFacturen) {
    flaggenLines.push(
      `- Mijn verzoek om onderliggende facturen is niet of onvoldoende beantwoord. ` +
        `Ik verzoek u alsnog inzage te verlenen.`,
    );
  }
  if (input.rodeVlaggen.postenNietInContract) {
    flaggenLines.push(
      `- De afrekening bevat posten die niet in mijn huurovereenkomst of het ` +
        `servicekosten-overzicht zijn opgenomen. Conform de Huurcommissie-procedure ` +
        `zijn alleen contractueel overeengekomen posten verrekenbaar.`,
    );
  }
  if (input.rodeVlaggen.eigenaarslastenVerrekend) {
    flaggenLines.push(
      `- Eén of meer posten lijken eigenaarslasten (zoals OZB, opstalverzekering, ` +
        `vervanging i.p.v. onderhoud). Deze zijn niet verrekenbaar via servicekosten.`,
    );
  }
  if (input.rodeVlaggen.voorschotVeelGroterDanWerkelijk) {
    const overschot = Math.max(0, input.voorschotTotaalCents - input.werkelijkeKostenTotaalCents);
    flaggenLines.push(
      `- Mijn voorschotten waren beduidend hoger dan de opgegeven werkelijke kosten ` +
        `(verschil indicatie: € ${(overschot / 100).toLocaleString("nl-NL")}). Ik vraag de ` +
        `restitutie van het overschot.`,
    );
  }

  if (flaggenLines.length === 0) {
    lines.push(`Ik verzoek u de afrekening te onderbouwen met:`);
    lines.push(`- specificatie per post`);
    lines.push(`- onderliggende facturen`);
    lines.push(`- onderbouwing dat de posten contractueel overeengekomen zijn`);
  } else {
    lines.push(`Mijn bezwaren:`);
    for (const l of flaggenLines) lines.push(l);
  }
  lines.push("");
  lines.push(
    `Conform de Huurcommissie-procedureregels heeft u 3 weken (${HUURCOMMISSIE_VERHUURDER_REACTIE_DAGEN} dagen) ` +
      `de tijd om hierop te reageren. Komt er geen of geen passende reactie, dan zal ` +
      `ik de Huurcommissie verzoeken het geschil te beoordelen.`,
  );
  lines.push("");
  lines.push(`Met vriendelijke groet,`);
  lines.push(`[Naam huurder]`);
  lines.push(`[Adres + huisnummer]`);
  lines.push(`[Datum]`);
  return lines.join("\n");
}

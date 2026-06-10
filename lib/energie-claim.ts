/**
 * lib/energie-claim.ts — V35 DEEL 2 — Energie-eindafrekening-claim via
 * Geschillencommissie Energie.
 *
 * Pure functie (geen I/O, geen opslag) zodat de check **client-side** kan
 * draaien — provider-naam, contract-/eindafrekening-data, bedragen en
 * rode-vlaggen verlaten de browser nooit. Indicatie of klacht/escalatie
 * loont; het exacte bedrag bepaalt Geschillencommissie Energie.
 *
 * ⚠️ BRON-VAN-WAARHEID: alle deadlines + leges + procedures komen EXACT uit
 * docs/V35_DATA_2026.md (Geschillencommissie Energie + ACM +
 * Elektriciteitswet/Gaswet). Niets gokken; aggregators verliezen het van
 * officiële bronnen.
 *
 * ⚠️ Energiebelasting-vermindering 2026: GEVERIFIEERD op 2026-05-27 bij
 * Belastingplan 2026 (Memorie van Toelichting via Rijksoverheid) = € 628,96
 * incl. btw per jaar (€ 519,80 ex btw). Was € 635,19 in 2025. Bron-URLs zie
 * `ENERGIEBELASTING_VERMINDERING_2026_INCL_BTW_CENTS` hieronder. Engine
 * blijft echter conservatief op de presence-vlag-check ("heffingskortingen-
 * Aanwezig"): we detecteren of de regel ontbreekt, niet of het pro-rata-
 * bedrag exact klopt — dat is V36-werk (eerst meten of real-world afwijkingen
 * vaker voorkomen). Constante is beschikbaar voor UI-uitleg en latere
 * uitbreiding.
 *
 * Privacy: deze module bevat GEEN PII-gevoelige opslag-logica. Eerst
 * client-side rekenen; alleen bij NCNP-keuze maakt de route een
 * EnergieEindafrekeningClaim-record (AVG art. 6 lid 1b — uitvoering
 * overeenkomst).
 */

import { NO_CURE_NO_PAY_FEE_CAP_CENTS } from "@/lib/payments";

export const ENERGIE_PEILDATUM = "2026-01-01";
// 2026-05-27: energiebelasting-vermindering geverifieerd bij Belastingplan
// 2026 (zie comment hieronder + docs/V35_DATA_2026.md) — datum gelijkgetrokken.
export const ENERGIE_VERIFIED_AT = "2026-05-27";

// ─── Wettelijke termijnen + leges (EXACT uit docs/V35_DATA_2026.md) ─────────

// bron: Geschillencommissie Energie — energiebelasting-uitspraak
//   https://www.degeschillencommissie.nl/uitspraken/commissie-consument-heeft-recht-op-vermindering-energiebelasting/
// bron: Geschillencommissie Energie — vergoeding consument
//   https://www.degeschillencommissie.nl/uitspraken/vergoeding-voor-consument-na-nadelige-contractovername-door-energieleverancier/
// bron: ACM — geschilbeslechting netbeheer
//   https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/geschilbeslechting-energie-aanvragen
// bron: art. 31 Elektriciteitswet / Gaswet (6-weken-deadline eindafrekening)
// bron: Wet handhaving consumentenbescherming (30-dagen-reactietijd leverancier)

/** Indienings-leges Geschillencommissie Energie (terug bij winst). */
export const ENERGIE_GESCHILLENCOMMISSIE_LEGES_CENTS = 2_750; // € 27,50
/**
 * Klachtenkosten die de leverancier moet vergoeden bij winst (totaal € 80
 * retour incl. leges). Bedoeld voor de DIY-brief-context, niet om automatisch
 * te tellen als "restitutie".
 */
export const ENERGIE_KLACHTGELD_VERGOEDING_CENTS = 5_250; // € 52,50
/** Wettelijke reactietijd leverancier op klacht (Wet handhaving consumentenbescherming). */
export const ENERGIE_LEVERANCIER_REACTIE_DAGEN = 30;
/** Gemiddelde behandelingstijd Geschillencommissie Energie (2026). */
export const ENERGIE_GESCHILLENCOMMISSIE_BEHANDELING_MAANDEN = 3;
/** Wettelijke deadline leverancier voor versturen eindafrekening (art. 31 EW/GW). */
export const ENERGIE_EINDAFREKENING_DEADLINE_DAGEN = 42; // 6 weken

/**
 * Energiebelasting-vermindering 2026 — geverifieerd 2026-05-27 bij
 * Belastingplan 2026 / Memorie van Toelichting (de wettelijke bron). Bedrag is
 * **inclusief btw** want zo wordt 't op de consumenten-eindafrekening getoond.
 * In 2025 was dit € 635,19; voor 2026 een daling van € 6,23.
 *
 * NB: engine controleert nu alleen of de regel überhaupt op de afrekening
 * staat (`heffingskortingenAanwezig`). Pro-rata-validatie ("bedrag op
 * afrekening ≈ bedrag × contractmaanden / 12") komt eventueel in V36 als
 * blijkt dat leveranciers daar fouten maken. Constante is wel beschikbaar
 * voor UI-uitleg en latere uitbreiding.
 *
 * bron: Belastingplan 2026 Memorie van Toelichting (5.21 Belastingvermindering energiebelasting)
 *   https://www.rijksfinancien.nl/belastingplan-memorie-van-toelichting/2026/d17e5425
 * bron: Rijksoverheid — Plannen kabinet voor de energiebelasting 2026
 *   https://www.rijksoverheid.nl/onderwerpen/belastingplan/energiebelasting
 */
export const ENERGIEBELASTING_VERMINDERING_2026_INCL_BTW_CENTS = 62_896; // € 628,96 / jr

// ─── NCNP-gate (€ 50 = identiek aan huurcommissie) ──────────────────────────

/**
 * HARDE drempel V35 (guardrail 5): NCNP-aanbod alléén bij verwachte
 * restitutie ≥ € 50. Onder die drempel: DIY-only (gratis).
 */
export const ENERGIE_NCNP_DREMPEL_CENTS = 5_000;

/** NCNP-fee-percentage op het werkelijk teruggehaalde bedrag. */
export const ENERGIE_NCNP_FEE_PCT = 0.2; // 20% (consistent met huurcommissie)

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Rode-vlaggen-checklist (sourced uit docs/V35_DATA_2026.md
 * "Rode vlaggen voor onze check"). Élk veld is een ja/nee + soms een bedrag.
 *
 * NB: we hardcoderen GEEN energiebelasting-vermindering-bedrag 2026 — alleen
 * een presence-vlag (heffingskortingenAanwezig). Conservatief + correct
 * ongeacht jaarlijkse indexering.
 */
export type EnergieEindafrekeningInput = {
  /** Naam energieleverancier (bv. Vattenfall, Eneco, Greenchoice). */
  provider: string;
  /** Aantal dagen tussen contract-einde en eindafrekening-verzenddatum. */
  dagenTussenContracteindeEnAfrekening: number;
  /** Eindafrekening totaalbedrag in cents (positief = bij te betalen, negatief = restitutie). */
  eindafrekeningBedragCents: number;
  /**
   * Was contract-tarief per kWh hoger dan op de eindafrekening berekend?
   * (= tariefafwijking-rode-vlag). null = niet bekend / niet relevant.
   */
  tariefAfwijkingCents: number | null;
  /** Heffingskortingen-/energiebelasting-vermindering-regel aanwezig op afrekening? */
  heffingskortingenAanwezig: boolean;
  /** Meterstand op afrekening consistent met laatste opname/foto. */
  meterstandConsistent: boolean;
  /** Dubbele heffingen waargenomen (vastrecht + leveringskosten 2x, CO2 2x, etc.). */
  dubbeleHeffingenAanwezig: boolean;
  /** Saldering zonne-energie correct toegepast (alleen relevant bij zonnepanelen). */
  salderingCorrect: boolean | null;
};

export type EnergieRestitutieStatus = "likely" | "maybe" | "unlikely";

export type EnergieEindafrekeningResult = {
  provider: string;
  /** Bovengrens-indicatie restitutie in cents. */
  verwachteRestitutieCents: number;
  rodeVlaggenAantal: number;
  /** Lijst met namen van de actieve rode vlaggen — voor UI-display + DIY-brief. */
  actieveRodeVlaggen: ReadonlyArray<string>;
  status: EnergieRestitutieStatus;
  /** Wel/niet NCNP-aanbod tonen (≥ € 50 gate). */
  biedNcnpAan: boolean;
  uitleg: string;
  klachtTermijnen: {
    leverancierReactieDagen: number;
    geschillencommissieBehandelingMaanden: number;
    eindafrekeningDeadlineDagen: number;
  };
  bron: string;
  peildatum: string;
};

// ─── Validatie ──────────────────────────────────────────────────────────────

export type EnergieClaimIntentInput = {
  provider: unknown;
  verwachteRestitutieCents: unknown;
};
export type EnergieClaimIntentValidation =
  | { ok: true; provider: string; verwachteRestitutieCents: number }
  | { ok: false; reason: "invalid-provider" | "invalid-amount" | "below-ncnp-threshold" };

export function validateEnergieClaimIntent(
  input: EnergieClaimIntentInput,
): EnergieClaimIntentValidation {
  const provider =
    typeof input.provider === "string" ? input.provider.trim().slice(0, 200) : "";
  if (provider.length === 0) {
    return { ok: false, reason: "invalid-provider" };
  }
  const cents =
    typeof input.verwachteRestitutieCents === "number"
      ? input.verwachteRestitutieCents
      : Number(input.verwachteRestitutieCents);
  if (!Number.isInteger(cents) || cents <= 0) {
    return { ok: false, reason: "invalid-amount" };
  }
  if (cents < ENERGIE_NCNP_DREMPEL_CENTS) {
    return { ok: false, reason: "below-ncnp-threshold" };
  }
  return { ok: true, provider, verwachteRestitutieCents: cents };
}

// ─── Fee-berekening (handmatige proof-back; geen OCR in V35) ────────────────

export function computeEnergieFee(werkelijkeRestitutieCents: number): number {
  if (!Number.isFinite(werkelijkeRestitutieCents) || werkelijkeRestitutieCents <= 0) return 0;
  if (werkelijkeRestitutieCents < ENERGIE_NCNP_DREMPEL_CENTS) return 0;
  const raw = Math.round(werkelijkeRestitutieCents * ENERGIE_NCNP_FEE_PCT);
  return Math.min(raw, NO_CURE_NO_PAY_FEE_CAP_CENTS);
}

// ─── Engine — pure indicatie ────────────────────────────────────────────────

/**
 * Bereken bovengrens-restitutie op basis van rode vlaggen. Géén exact bedrag —
 * Geschillencommissie Energie bepaalt definitief na expertise.
 *
 * Schatting-strategie (conservatief):
 *  - Vlag "geen heffingskorting" + vol contract-jaar → directe restitutie-grond.
 *    We hardcoderen het 2026-bedrag NIET (varieert jaarlijks). We tonen
 *    "controleer op je eindafrekening de regel 'Vermindering energiebelasting'"
 *    en escaleren tot vol-recht-indicatie als die regel ontbreekt + meterstand
 *    consistent is.
 *  - Vlag "eindafrekening > 42 dagen" → ACM-handhaving-grond, géén concreet
 *    bedrag (klachtgeld-vergoeding € 52,50 + eventueel coulance van leverancier).
 *  - Vlag "tarief-afwijking" → restitutie = afwijking × verbruik (we kennen
 *    verbruik niet; tonen we als "controleer voor jouw kWh-verbruik").
 *  - Vlag "dubbele heffingen" → toon de regel als restitutie-grond.
 *  - Vlag "meterstand-shift" → grond voor herzien afrekening.
 *  - Vlag "saldering incorrect" → grond voor herzien (zonnepanelen).
 *
 * Bovengrens-bedrag: 50% van het eindafrekening-bedrag bij ≥ 2 vlaggen,
 * 30% bij 1 vlag. (Heel conservatief — Geschillencommissie bepaalt definitief.)
 * Plus de klachtgeld-vergoeding bij ≥ 1 vlag (€ 52,50).
 */
export function estimateEnergieEindafrekeningRestitutie(
  input: EnergieEindafrekeningInput,
): EnergieEindafrekeningResult {
  const actief: string[] = [];
  if (input.dagenTussenContracteindeEnAfrekening > ENERGIE_EINDAFREKENING_DEADLINE_DAGEN) {
    actief.push(
      `Eindafrekening verstuurd > 42 dagen na contract-einde (${input.dagenTussenContracteindeEnAfrekening} dagen)`,
    );
  }
  if (!input.heffingskortingenAanwezig) {
    actief.push(`Geen 'Vermindering energiebelasting'-regel op eindafrekening`);
  }
  if (!input.meterstandConsistent) {
    actief.push(`Meterstand op afrekening klopt niet met laatste opname`);
  }
  if (input.dubbeleHeffingenAanwezig) {
    actief.push(`Dubbele heffingen (vastrecht + leveringskosten of CO2 dubbel)`);
  }
  if (input.tariefAfwijkingCents != null && input.tariefAfwijkingCents > 0) {
    actief.push(
      `Tarief boven contract-tarief (verschil ~ € ${(input.tariefAfwijkingCents / 100).toLocaleString("nl-NL")} per kWh)`,
    );
  }
  if (input.salderingCorrect === false) {
    actief.push(`Saldering zonne-energie niet correct toegepast`);
  }

  const rvCount = actief.length;
  const eindbedragAbs = Math.max(0, Math.abs(input.eindafrekeningBedragCents));

  let verwacht = 0;
  if (rvCount >= 2) {
    verwacht += Math.round(eindbedragAbs * 0.5);
  } else if (rvCount === 1) {
    verwacht += Math.round(eindbedragAbs * 0.3);
  }
  if (rvCount >= 1) {
    verwacht += ENERGIE_KLACHTGELD_VERGOEDING_CENTS;
  }

  let status: EnergieRestitutieStatus;
  if (verwacht >= ENERGIE_NCNP_DREMPEL_CENTS && rvCount >= 1) status = "likely";
  else if (verwacht > 0) status = "maybe";
  else status = "unlikely";

  const uitleg =
    rvCount === 0
      ? "Geen evidente rode vlaggen — eindafrekening lijkt op orde. Twijfel je " +
        "over een specifieke post? Stel je vraag bij je leverancier of " +
        "Consumentenbond voordat je formeel klacht indient."
      : `${rvCount} rode vlag${rvCount === 1 ? "" : "ggen"} gedetecteerd. ` +
        `Bovengrens-indicatie restitutie: € ${(verwacht / 100).toLocaleString("nl-NL")} ` +
        `(${rvCount >= 2 ? "50%" : "30%"} van eindafrekening-bedrag + ` +
        `klachtgeld-vergoeding € ${(ENERGIE_KLACHTGELD_VERGOEDING_CENTS / 100).toLocaleString("nl-NL")} ` +
        `bij winst). Geschillencommissie Energie bepaalt het exacte bedrag.`;

  return {
    provider: input.provider,
    verwachteRestitutieCents: verwacht,
    rodeVlaggenAantal: rvCount,
    actieveRodeVlaggen: actief,
    status,
    biedNcnpAan: verwacht >= ENERGIE_NCNP_DREMPEL_CENTS && rvCount >= 1,
    uitleg,
    klachtTermijnen: {
      leverancierReactieDagen: ENERGIE_LEVERANCIER_REACTIE_DAGEN,
      geschillencommissieBehandelingMaanden: ENERGIE_GESCHILLENCOMMISSIE_BEHANDELING_MAANDEN,
      eindafrekeningDeadlineDagen: ENERGIE_EINDAFREKENING_DEADLINE_DAGEN,
    },
    bron: "https://www.degeschillencommissie.nl/uitspraken/commissie-consument-heeft-recht-op-vermindering-energiebelasting/",
    peildatum: ENERGIE_PEILDATUM,
  };
}

/** Pure-helper: moet de UI de NCNP-CTA tonen voor dit resultaat? */
export function shouldOfferEnergieNcnp(result: EnergieEindafrekeningResult): boolean {
  return result.biedNcnpAan && result.verwachteRestitutieCents >= ENERGIE_NCNP_DREMPEL_CENTS;
}

// ─── DIY-klachtbrief-generator ──────────────────────────────────────────────

export const ENERGIE_DISCLAIMER =
  "Dit is een indicatie, geen juridisch advies. Geschillencommissie Energie " +
  "bepaalt het exacte bedrag na expertise. DeGeldHeld slaat je gegevens niet " +
  "op — deze check rekent in je eigen browser. Bij twijfel over je rechten: " +
  "Consumentenbond, Juridisch Loket (gratis) of energie-recht-advocaat. " +
  "Energiebelasting-vermindering 2026 verandert jaarlijks; verifieer het exacte " +
  "bedrag op belastingdienst.nl.";

export function energieKlachtBrief(
  input: EnergieEindafrekeningInput,
  result: EnergieEindafrekeningResult,
): string {
  const lines: string[] = [];
  lines.push(`Aan ${input.provider},`);
  lines.push("");
  lines.push(
    `Hierbij dien ik formeel klacht in over de eindafrekening die ik van u ` +
      `ontving. Mijn klachtpunten:`,
  );
  lines.push("");
  if (result.actieveRodeVlaggen.length === 0) {
    lines.push(
      `Bij doorname van de afrekening rezen vragen over de tariefstelling, ` +
        `heffingen en/of meterstanden. Ik verzoek u de afrekening te onderbouwen ` +
        `met onderliggende berekeningen.`,
    );
  } else {
    for (const v of result.actieveRodeVlaggen) {
      lines.push(`- ${v}`);
    }
  }
  lines.push("");
  lines.push(
    `Conform de Wet handhaving consumentenbescherming heeft u ${ENERGIE_LEVERANCIER_REACTIE_DAGEN} dagen ` +
      `de tijd om hierop te reageren. Komt er geen of geen passende reactie, dan ` +
      `escaleer ik naar de Geschillencommissie Energie ` +
      `(degeschillencommissie.nl/over-ons/commissies/energie). De Geschillencommissie ` +
      `behandelt zaken gemiddeld binnen ${ENERGIE_GESCHILLENCOMMISSIE_BEHANDELING_MAANDEN} maanden ` +
      `en kan u verplichten klachtgeld (€ ${(ENERGIE_KLACHTGELD_VERGOEDING_CENTS / 100).toLocaleString("nl-NL")}) ` +
      `+ leges (€ ${(ENERGIE_GESCHILLENCOMMISSIE_LEGES_CENTS / 100).toLocaleString("nl-NL")}) te vergoeden ` +
      `bovenop de inhoudelijke restitutie.`,
  );
  lines.push("");
  lines.push(`Ik verzoek u binnen 30 dagen schriftelijk te reageren.`);
  lines.push("");
  lines.push(`Met vriendelijke groet,`);
  lines.push(`[Naam consument]`);
  lines.push(`[Klantnummer]`);
  lines.push(`[Datum]`);
  return lines.join("\n");
}

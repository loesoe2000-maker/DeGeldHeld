/**
 * lib/ns.ts — NS Geld-Terug bij Vertraging-calculator (EU261-pattern).
 *
 * Pure functie (geen I/O). Drempels + percentages + minimum-claim + deadline
 * komen EXACT uit docs/V29_DATA_2026.md (NS Voorwaarden + EU-PRR 2021/782).
 * Vrij/Flex-abonnementen hebben vaste compensatie-bedragen per abonnement
 * die per abonnement verschillen → wij geven verwijzing naar Mijn NS, geen
 * eigen bedrag.
 *
 * bron: NS — wat compenseert NS  https://www.ns.nl/en/service-and-contact/refunds/what-compensation-does-ns-offer
 * bron: NS — voorwaarden Geld Terug bij Vertraging (PDF)
 *   https://www.ns.nl/binaries/_ht_1754559946332/content/assets/ns-nl/voorwaarden/voorwaarden-geld-terug-bij-vertraging.pdf
 * bron: EU-PRR Verordening (EU) 2021/782
 *   https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32021R0782
 */

export const NS_PEILDATUM = "2026-01-01";
export const NS_VERIFIED_AT = "2026-05-24";

/**
 * Drempels + percentages — sourced uit V29_DATA_2026.md.
 */
export const NS = {
  /** Compensatie binnen NL bij losse tickets. */
  binnenland: {
    short: { min: 30, max: 59, pct: 50 }, // 30-59 min → 50%
    long: { min: 60, pct: 100 }, // ≥ 60 min → 100%
  },
  /** Compensatie internationale tickets onder EU-Passenger-Rights (Verordening 2021/782). */
  euPrr: {
    short: { min: 60, max: 119, pct: 25 }, // 60-119 min → 25%
    long: { min: 120, pct: 50 }, // ≥ 120 min → 50%
  },
  /** Compensatie kortings-/toeslag-abonnementen op enkele reizen. */
  abonnement: {
    short: { min: 15, max: 29, pct: 50 }, // 15-29 min → 50%
    long: { min: 30, pct: 100 }, // ≥ 30 min → 100%
  },
  /** Minimum-claim die NS in behandeling neemt. */
  minClaimCents: 230, // € 2,30
  /** Deadline (NS Go support) na vertraging om in te dienen. */
  deadlineDagen: 30, // 1 maand veiligheidsmarge — sommige routes geven 90d
} as const;

/** Welke regeling is van toepassing. */
export type NsRegime =
  | "NS_NL" // losse binnenland-ticket
  | "EU_PRR" // internationaal of IC-direct met EU-PRR
  | "ABONNEMENT" // kortings-/toeslag-abonnement
  | "ABONNEMENT_VERWIJS" // Vrij/Flex → indicatie + verwijzing Mijn NS
  | "NONE"; // onder drempel

export type NsInput = {
  /** Ticketprijs in cents (enkele reis voor losse tickets). */
  ticketCents: number;
  /** Vertraging op de eindbestemming in minuten. */
  delayMinutes: number;
  /** Reist via een abonnement (kortings-/toeslag-abonnement)? */
  isAbonnement?: boolean;
  /** Vrij-Reizen of NS-Flex? Dan is exact bedrag niet door ons te berekenen. */
  isVrijOfFlex?: boolean;
  /** Internationale reis (EU-PRR-regime). */
  isInternational?: boolean;
};

export type NsResult = {
  eligible: boolean;
  regime: NsRegime;
  /** Toegepaste compensatie-percentage (0 als niet eligible). */
  percentage: number;
  /** Berekend compensatie-bedrag in cents (0 als verwijzing of niet eligible). */
  compensationCents: number;
  /** Minimum-claim die NS afdwingt; toon als de berekende fee daaronder zakt. */
  belowMinimum: boolean;
  reden: string;
  deadlineDagen: number;
};

/** Pure compensatie-berekening (EU261-pattern). */
export function nsCompensation(input: NsInput): NsResult {
  const { ticketCents, delayMinutes } = input;

  if (!Number.isFinite(ticketCents) || ticketCents < 0) {
    return result("NONE", false, 0, 0, "Onbekende ticketprijs.", { belowMin: false });
  }
  if (!Number.isFinite(delayMinutes) || delayMinutes < 0) {
    return result("NONE", false, 0, 0, "Onbekende vertraging.", { belowMin: false });
  }

  // Vrij-Reizen / NS-Flex → eigen vaste bedragen per abonnement; wij doen alleen
  // een indicatie + verwijzing naar Mijn NS. NIET een bedrag verzinnen.
  if (input.isVrijOfFlex) {
    const eligible =
      delayMinutes >= NS.abonnement.short.min; // ≥ 15 min triggers iets
    return result(
      "ABONNEMENT_VERWIJS",
      eligible,
      0,
      0,
      eligible
        ? "Bij Vrij-/Flex-abonnementen verschilt het exacte bedrag per abonnement. " +
            "Vul je claim in via Mijn NS — daar staat het bedrag dat bij jouw abonnement hoort."
        : "Onder de 15 minuten vertraging geldt geen compensatie.",
      { belowMin: false },
    );
  }

  if (input.isAbonnement) {
    if (delayMinutes >= NS.abonnement.long.min) {
      return mkCompensation("ABONNEMENT", NS.abonnement.long.pct, ticketCents,
        "Abonnement: ≥ 30 minuten vertraging → 100% compensatie op je enkele-reisprijs.",
      );
    }
    if (delayMinutes >= NS.abonnement.short.min) {
      return mkCompensation("ABONNEMENT", NS.abonnement.short.pct, ticketCents,
        "Abonnement: 15-29 minuten vertraging → 50% compensatie.",
      );
    }
    return result("NONE", false, 0, 0, "Abonnement: onder 15 minuten vertraging geen compensatie.", { belowMin: false });
  }

  if (input.isInternational) {
    if (delayMinutes >= NS.euPrr.long.min) {
      return mkCompensation("EU_PRR", NS.euPrr.long.pct, ticketCents,
        "EU-PRR (internationale reis): ≥ 120 minuten vertraging → 50% van de ticketprijs.",
      );
    }
    if (delayMinutes >= NS.euPrr.short.min) {
      return mkCompensation("EU_PRR", NS.euPrr.short.pct, ticketCents,
        "EU-PRR (internationale reis): 60-119 minuten vertraging → 25% van de ticketprijs.",
      );
    }
    return result("NONE", false, 0, 0, "EU-PRR: onder 60 minuten geen compensatie op internationale tickets.", { belowMin: false });
  }

  // Standaard: NS binnenland, losse ticket.
  if (delayMinutes >= NS.binnenland.long.min) {
    return mkCompensation("NS_NL", NS.binnenland.long.pct, ticketCents,
      "Binnenland, losse ticket: ≥ 60 minuten vertraging → 100% terug.",
    );
  }
  if (delayMinutes >= NS.binnenland.short.min) {
    return mkCompensation("NS_NL", NS.binnenland.short.pct, ticketCents,
      "Binnenland, losse ticket: 30-59 minuten vertraging → 50% terug.",
    );
  }
  return result("NONE", false, 0, 0, "Binnenland: onder 30 minuten geen compensatie.", { belowMin: false });
}

function mkCompensation(regime: NsRegime, pct: number, ticketCents: number, reden: string): NsResult {
  const raw = Math.round((ticketCents * pct) / 100);
  const belowMin = raw < NS.minClaimCents;
  return {
    eligible: !belowMin,
    regime,
    percentage: pct,
    compensationCents: belowMin ? raw : raw, // toon het echte bedrag; eligible vlag schaalt
    belowMinimum: belowMin,
    reden: belowMin
      ? `${reden} (Onder de minimum-claim van € 2,30; NS neemt zo'n kleine claim niet in behandeling — combineer met andere claims of laat 'm vallen.)`
      : reden,
    deadlineDagen: NS.deadlineDagen,
  };
}

function result(
  regime: NsRegime,
  eligible: boolean,
  pct: number,
  cents: number,
  reden: string,
  opts: { belowMin: boolean },
): NsResult {
  return {
    eligible,
    regime,
    percentage: pct,
    compensationCents: cents,
    belowMinimum: opts.belowMin,
    reden,
    deadlineDagen: NS.deadlineDagen,
  };
}

/** Pre-gefilde brief-tekst voor de NS-claim (gebruiker dient zelf in via Mijn NS / formulier). */
export function nsClaimBrief(input: NsInput, result: NsResult, opts: { dateISO?: string; route?: string } = {}): string {
  const eurFmt = (c: number) => (c / 100).toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
  const datum = opts.dateISO ?? "[datum vertraging]";
  const route = opts.route ?? "[route]";
  const compensatie =
    result.regime === "ABONNEMENT_VERWIJS"
      ? "het bedrag dat hoort bij mijn Vrij-/Flex-abonnement (zie Mijn NS voor het exacte bedrag)"
      : `${eurFmt(result.compensationCents)} (${result.percentage}% van het ticket)`;
  return `Geachte NS,

Op ${datum} reisde ik ${route}. De vertraging op de eindbestemming bedroeg
${input.delayMinutes} minuten. Op basis van de Voorwaarden Geld Terug bij
Vertraging${input.isInternational ? " / EU-Verordening 2021/782" : ""} kom ik in aanmerking voor
${compensatie}.

${result.eligible ? `Ik verzoek u dit bedrag binnen ${result.deadlineDagen} dagen na deze claim
over te maken op mijn rekening.` : "Graag uw beoordeling van deze claim."}

Met vriendelijke groet,
[Naam, klantnummer / OV-chipkaart, e-mailadres]
`;
}

export const NS_DISCLAIMER =
  "Dit is een indicatie op de officiële NS- en EU-PRR-regels (peildatum 2026). " +
  "De claim zelf dien je in via Mijn NS (OV-chipkaart/NS-Flex) of het formulier op " +
  "ns.nl. NS controleert je werkelijke vertraging en betaalt meestal binnen enkele " +
  "dagen uit. Vrij-/Flex-abonnementen hebben eigen vaste bedragen per abonnement — " +
  "exact bedrag zie je in Mijn NS. DeGeldHeld slaat je reisdata niet op.";

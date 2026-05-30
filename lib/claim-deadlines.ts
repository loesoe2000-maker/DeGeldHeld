/**
 * lib/claim-deadlines.ts — v37 — deadline-bewaking + nudge-beslissing.
 *
 * PURE functies (testbaar zonder DB/mail). De cron doet alleen IO.
 *
 * Ontwerp-eerlijkheid: we baseren nudges UITSLUITEND op data die we
 * betrouwbaar hebben — de claim-status + createdAt/updatedAt. We GISSEN geen
 * exacte wettelijke deadlines (bv. de 24-maanden bezwaartermijn) omdat we de
 * precieze afrekendatum niet kennen; een verkeerde "je termijn verloopt"-mail
 * is erger dan geen mail. De reactie-/behandeltermijnen komen uit de officiële
 * constanten in lib/huurcommissie + lib/energie-claim.
 *
 * Idempotentie: `lastNudgeKind` voorkomt dat dezelfde nudge dagelijks opnieuw
 * gaat. Een nieuwe nudge mag pas als de claim een ándere fase bereikt.
 */

import {
  HUURCOMMISSIE_VERHUURDER_REACTIE_DAGEN,
  HUURCOMMISSIE_BEHANDELING_MAANDEN,
} from "@/lib/huurcommissie";
import {
  ENERGIE_LEVERANCIER_REACTIE_DAGEN,
  ENERGIE_GESCHILLENCOMMISSIE_BEHANDELING_MAANDEN,
} from "@/lib/energie-claim";

export type ClaimSoort = "huur" | "energie";

/**
 * Soorten nudge. Stabiele string-id — wordt opgeslagen in lastNudgeKind zodat
 * we 'm niet herhalen tot de claim een andere fase in gaat.
 */
export type ClaimNudgeKind =
  | "intent-stil" // claim staat te lang op INTENT (brief nog niet verstuurd)
  | "reactie-verlopen" // wederpartij reageerde niet binnen de wettelijke termijn
  | "behandeling-traag"; // instantie-behandeling duurt langer dan gemiddeld

export type ClaimForNudge = {
  id: string;
  soort: ClaimSoort;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  /** Welke nudge het laatst verstuurd is (idempotentie). */
  lastNudgeKind: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dagen dat een claim op INTENT mag staan voordat we de "verstuur je brief"-nudge sturen. */
export const INTENT_STIL_DAGEN = 7;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

/** Maanden → dagen-benadering (30d) voor de behandel-drempel. */
function monthsToDays(m: number): number {
  return Math.round(m * 30);
}

/**
 * Bepaal welke nudge (indien een) voor deze claim verstuurd moet worden.
 * Retourneert null als er niets te doen is.
 *
 * Volgorde van fases:
 *   INTENT (≥7d stil)                       → "intent-stil"
 *   BEZWAAR/KLACHT_GESTUURD (≥reactietermijn)→ "reactie-verlopen"
 *   *_INGEDIEND (≥behandeltermijn)          → "behandeling-traag"
 *   UITSPRAAK / CHARGED / FAILED            → null (klant/owner is aan zet,
 *                                             losse flows handelen dit af)
 */
export function decideClaimNudge(
  claim: ClaimForNudge,
  now: Date,
): ClaimNudgeKind | null {
  const reactieDagen =
    claim.soort === "huur"
      ? HUURCOMMISSIE_VERHUURDER_REACTIE_DAGEN
      : ENERGIE_LEVERANCIER_REACTIE_DAGEN;
  const behandelDagen = monthsToDays(
    claim.soort === "huur"
      ? HUURCOMMISSIE_BEHANDELING_MAANDEN
      : ENERGIE_GESCHILLENCOMMISSIE_BEHANDELING_MAANDEN,
  );

  // 1) INTENT te lang stil → herinner aan de brief.
  if (claim.status === "INTENT") {
    if (
      daysBetween(now, claim.createdAt) >= INTENT_STIL_DAGEN &&
      claim.lastNudgeKind !== "intent-stil"
    ) {
      return "intent-stil";
    }
    return null;
  }

  // 2) Brief verstuurd, wederpartij reageerde niet binnen de termijn.
  if (claim.status === "BEZWAAR_GESTUURD" || claim.status === "KLACHT_GESTUURD") {
    if (
      daysBetween(now, claim.updatedAt) >= reactieDagen &&
      claim.lastNudgeKind !== "reactie-verlopen"
    ) {
      return "reactie-verlopen";
    }
    return null;
  }

  // 3) Ingediend bij de instantie, behandeling duurt lang → geruststellen +
  //    vragen of er al iets binnen is.
  if (
    claim.status === "HUURCOMMISSIE_INGEDIEND" ||
    claim.status === "GESCHILLENCOMMISSIE_INGEDIEND"
  ) {
    if (
      daysBetween(now, claim.updatedAt) >= behandelDagen &&
      claim.lastNudgeKind !== "behandeling-traag"
    ) {
      return "behandeling-traag";
    }
    return null;
  }

  // UITSPRAAK / CHARGED / FAILED → geen deadline-nudge.
  return null;
}

// ─── Nudge-teksten ───────────────────────────────────────────────────────────

const APP_URL = "https://www.degeldheld.com";

/**
 * Bouw subject + tekst voor een nudge. Concreet, met de volgende actie.
 * Géén verzonnen bedragen of datums.
 */
export function formatClaimNudge(
  kind: ClaimNudgeKind,
  soort: ClaimSoort,
  claimId: string,
): { subject: string; text: string } {
  const instantie = soort === "huur" ? "Huurcommissie" : "Geschillencommissie Energie";
  const wederpartij = soort === "huur" ? "verhuurder" : "energieleverancier";
  const checkPad =
    soort === "huur" ? "/huurcommissie-check" : "/energie-claim-check";
  const link = `${APP_URL}/account/claims`;

  switch (kind) {
    case "intent-stil":
      return {
        subject: "Je claim staat klaar — verstuur de brief",
        text:
          `Hoi,\n\nJe startte een ${soort === "huur" ? "Huurcommissie-bezwaar" : "energie-klacht"} ` +
          `maar we zien nog geen vervolgstap. De pre-gefilde brief staat voor je klaar — ` +
          `verstuur 'm naar je ${wederpartij} zodat de termijn gaat lopen.\n\n` +
          `Bekijk je claim: ${link}\n` +
          `Brief opnieuw bekijken: ${APP_URL}${checkPad}\n\n— DeGeldHeld`,
      };
    case "reactie-verlopen":
      return {
        subject: `Je ${wederpartij} reageerde niet op tijd — tijd om te escaleren`,
        text:
          `Hoi,\n\nJe ${wederpartij} heeft niet binnen de wettelijke termijn gereageerd op je ` +
          `${soort === "huur" ? "bezwaar" : "klacht"}. Daarmee kun je de zaak nu voorleggen aan de ` +
          `${instantie}.\n\nWil je dat we de volgende stap zetten? Bekijk je claim: ${link}\n\n— DeGeldHeld`,
      };
    case "behandeling-traag":
      return {
        subject: `Update over je ${instantie}-zaak`,
        text:
          `Hoi,\n\nJe zaak ligt bij de ${instantie} en de behandeling duurt inmiddels langer dan ` +
          `gemiddeld. Heb je al een uitspraak of bericht ontvangen? Upload 'm dan in je dashboard, ` +
          `dan ronden we je claim af.\n\nBekijk je claim: ${link}\n\n— DeGeldHeld`,
      };
  }
}

/**
 * lib/moneyfinder-hub.ts — pure config voor de "vind al je geld"-hub.
 *
 * Eén plek waar de 6 checks gedeclareerd staan; elke tegel is gegate aan
 * een eigen feature-flag. Géén lege/dode UI — tegels die uit-flagged zijn
 * verschijnen NIET in de hub.
 */
import type { FeatureFlag } from "@/lib/feature-flags";

export type HubTile = {
  id: string;
  title: string;
  body: string;
  href: string;
  flag: FeatureFlag;
  icon: string;
};

export const HUB_TILES: ReadonlyArray<HubTile> = [
  {
    id: "geld-check",
    title: "Toeslagen + gemeente-regelingen",
    body:
      "Eén vragenlijst — indicatie van zorgtoeslag, huurtoeslag, kindgebonden " +
      "budget + gemeente-regelingen. Geen DigiD.",
    href: "/geld-check",
    flag: "GELD_CHECK_ENABLED",
    icon: "💸",
  },
  {
    id: "box3-check",
    title: "Box 3-rechtsherstel",
    body:
      "Wet tegenbewijsregeling (juli 2025): loont een OWR voor jouw box-3-jaar? " +
      "Gratis indicatie + kant-en-klare brief die je zelf indient.",
    href: "/box3-check",
    flag: "BOX3_CHECK_ENABLED",
    icon: "🏛️",
  },
  {
    id: "zorgkosten-check",
    title: "Zorgkostenaftrek",
    body:
      "Drempel 2026 + checklist veelvergeten posten (fysio, hulpmiddelen, " +
      "vervoer, dieet) — indicatie + bewijslijst voor je aangifte.",
    href: "/zorgkosten-check",
    flag: "ZORGKOSTEN_CHECK_ENABLED",
    icon: "🩺",
  },
  {
    id: "vluchtclaim",
    title: "Vluchtclaim (EU261)",
    body:
      "Was je vlucht ≥ 3 u vertraagd? Check je recht op € 250-€ 600 via EU261. " +
      "Gratis, net als al onze checks.",
    href: "/vluchtclaim",
    flag: "CLAIMS",
    icon: "✈️",
  },
  {
    id: "ns-check",
    title: "NS Geld-Terug bij Vertraging",
    body:
      "Vertraging ≥ 30 min binnenland → tot 100% terug. Gratis check + " +
      "brief-template. Liever automatisch claimen? Zie Plus.",
    href: "/ns-check",
    flag: "NS_CHECK_ENABLED",
    icon: "🚆",
  },
  // v35 Claim-Hub uitbreiding — Huurcommissie + Geschillencommissie Energie.
  // Beide via officiële instanties (geen relay-mail). v41: gratis.
  {
    id: "huurcommissie-check",
    title: "Huurcommissie — bezwaar servicekosten",
    body:
      "Klopt je servicekosten-afrekening? Gratis indicatie op rode vlaggen + " +
      "Gratis indicatie + kant-en-klare bezwaarbrief.",
    href: "/huurcommissie-check",
    flag: "HUURCOMMISSIE_CHECK_ENABLED",
    icon: "🏠",
  },
  // v40 F3 — huurprijs-toets op het woningwaarderingsstelsel. Flag blijft uit
  // tot de F4-pilot (docs/V40_PLAN.md) gedraaid is.
  {
    id: "huurprijs-check",
    title: "Huurprijs-check — betaal je te veel?",
    body:
      "Punten van je woning → maximale huurprijs 2026. Gratis check + " +
      "voorstelbrief; ook eerlijk als je géén procedure kunt starten.",
    href: "/huurprijs-check",
    flag: "HUURPRIJS_CHECK_ENABLED",
    icon: "📐",
  },
  {
    id: "energie-claim-check",
    title: "Energie-eindafrekening-claim",
    body:
      "Heffingskorting ontbreekt, te-laat-afrekening of meterstand-shift? Gratis " +
      "gratis indicatie + kant-en-klare klachtbrief.",
    href: "/energie-claim-check",
    flag: "ENERGIE_CLAIM_CHECK_ENABLED",
    icon: "⚡",
  },
  // Spookabonnementen blijft owner-scoped (eigen authentication-gate; werkt op
  // bestaande bills) en heeft geen eigen feature-flag. Hub toont 'm altijd in
  // de "ook beschikbaar"-sectie, NIET in de flag-gated grid.
];

/** Welke tegels zijn nu aan (op basis van een isEnabled-functie)? */
export function activeHubTiles(
  isEnabled: (f: FeatureFlag) => boolean,
): HubTile[] {
  return HUB_TILES.filter((t) => isEnabled(t.flag));
}

/** Spookabonnementen-tegel (geen flag — owner-scoped). */
export const SPOOK_TILE: Omit<HubTile, "flag"> = {
  id: "spookabonnementen",
  title: "Spookabonnementen",
  body:
    "Dubbele / onbenutte abonnementen uit je geüploade rekeningen, plus " +
    "self-cancel-begeleiding. Geen betaalde opzegdienst.",
  href: "/spookabonnementen",
  icon: "👻",
};

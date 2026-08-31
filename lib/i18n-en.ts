/**
 * lib/i18n-en.ts — v38 uitbreiding A — Engelstalige copy voor internationals.
 *
 * Bewust GEEN volledige i18n-bibliotheek (next-intl e.d.): de hele site is
 * hardcoded NL en een route-brede locale-verbouwing zou elke bestaande route
 * raken — te riskant vóór het NL-product bewezen is. Dit is de kiem: één
 * losse Engelse landingslaag die naar de bestaande NL-checks leidt.
 *
 * BEKENDE BEPERKING: de root layout zet <html lang="nl"> en dat is per
 * App-Router-structuur niet per sub-route te overschrijven zonder
 * route-groups. Acceptabel zolang robots index:false staat (a11y-punt voor
 * de echte EN-lancering; vergt dan een (nl)/(en) route-group-splitsing).
 *
 * COPY-REGELS (v38 launch-review — elke regel hieronder is een gefixte
 * bevinding, houd je eraan bij wijzigingen):
 *  - Box 3: de Hoge Raad-arresten zijn van JUNI 2024 (niet 2025; in 2025
 *    kwam alleen de Wet tegenbewijsregeling). Bron: docs/V29_DATA_2026.md.
 *  - Nooit "we handle the paperwork/complaint": de klant dient ZELF in
 *    (DigiD is persoonlijk). Wij bereiden voor ("we prepare"), klant dient in.
 *  - Nooit een absoluut "you pay nothing": Huurcommissie kost € 25 leges en
 *    de Geschillencommissie Energie € 27,50 + € 52,50 klachtgeld, door de
 *    klant voorgeschoten (terug bij winst). Zie EN_FEE_NOTE.
 *  - Fees concreet noemen (20% / Box 3 25%, cap € 500), niet "fair".
 *  - Geen kwantitatieve doelgroep-claims zonder bron.
 */

import type { FeatureFlag } from "@/lib/feature-flags";

export type EnTile = {
  /** Verwijst naar een BESTAANDE NL-check-route (ongewijzigd). */
  href: string;
  /**
   * Feature-flag van de doelroute. De EN-pagina toont een tegel alléén als
   * deze flag aan staat — anders zou "Start free check" stil doodlopen op
   * een redirect naar de Nederlandse homepage.
   */
  flag: FeatureFlag;
  emoji: string;
  title: string;
  body: string;
};

export const EN_HERO = {
  eyebrow: "For internationals living in the Netherlands",
  title: "You may have Dutch money waiting for you",
  subtitle:
    "Living in the Netherlands means you may be owed money you never claimed — " +
    "overpaid Box 3 wealth tax, rent service charge refunds, energy bill " +
    "corrections, missed allowances (toeslagen). DeGeldHeld checks it for free " +
    "and prepares the Dutch paperwork — you submit it and keep the money. " +
    "No cure, no pay.",
  ctaPrimary: "See what you can claim",
  ctaSecondary: "How it works",
} as const;

export const EN_TILES: ReadonlyArray<EnTile> = [
  {
    href: "/box3-check",
    flag: "BOX3_CHECK_ENABLED",
    emoji: "📊",
    title: "Box 3 wealth-tax refund",
    body:
      "Since the Dutch Supreme Court rulings of June 2024 you can reclaim " +
      "Box 3 tax for years where your real return was lower than the flat " +
      "rate the tax office assumed. Deadlines differ per tax year — the free " +
      "check shows what's still open. Common for savers.",
  },
  {
    href: "/huurcommissie-check",
    flag: "HUURCOMMISSIE_CHECK_ENABLED",
    emoji: "🏠",
    title: "Rent service charge refund",
    body:
      "Your landlord must send an itemised annual service charge statement. " +
      "If it doesn't add up, you can object via the Huurcommissie — we " +
      "prepare the Dutch objection letter for you.",
  },
  {
    href: "/energie-claim-check",
    flag: "ENERGIE_CLAIM_CHECK_ENABLED",
    emoji: "⚡",
    title: "Energy bill correction",
    body:
      "Wrong final energy statement? You can dispute it with your supplier " +
      "and, if needed, the Geschillencommissie Energie (the Dutch energy " +
      "disputes committee). We prepare the complaint — you stay in control.",
  },
  {
    href: "/geld-check",
    flag: "GELD_CHECK_ENABLED",
    emoji: "💶",
    title: "Allowances & benefits check",
    body:
      "Healthcare, rent and child allowances (toeslagen) are easy to miss if " +
      "you don't know the Dutch system. Free indicative check — no DigiD " +
      "needed.",
  },
] as const;

export const EN_HOW_IT_WORKS = [
  {
    n: "1",
    title: "Pick a check",
    body: "Free, private, runs in your browser. See what you're likely owed in under a minute.",
  },
  {
    n: "2",
    title: "We prepare the Dutch paperwork",
    body:
      "The official letter to the tax office, Huurcommissie or your supplier is " +
      "written in Dutch (they don't accept English) — so you don't have to.",
  },
  {
    n: "3",
    title: "You stay in control",
    body:
      "You submit or approve every step yourself — DigiD is personal, and " +
      "that's how it should be. Refunds go straight to your own account; we " +
      "never touch your money.",
  },
  {
    n: "4",
    title: "No cure, no pay",
    body:
      "Our fee is 20% of what you actually get back (Box 3: 25%), capped at " +
      "€ 500 per claim. Recovered nothing? You owe us nothing.",
  },
] as const;

/**
 * Eerlijke kosten-noot — rendert onder de how-it-works. Zonder deze noot zou
 * "no cure, no pay" verzwijgen dat de klant bij twee routes zelf leges
 * voorschiet. Bedragen uit lib/huurcommissie.ts + lib/energie-claim.ts.
 */
export const EN_FEE_NOTE =
  "Honest about costs: a Huurcommissie case has an official € 25 filing fee, " +
  "and the Geschillencommissie Energie charges € 27.50 plus a € 52.50 " +
  "complaint deposit — you advance these yourself and get them back if you " +
  "win. If your recovery stays below the threshold (Box 3 < € 500, " +
  "rent/energy < € 50), our fee is € 0 and the do-it-yourself letter is free.";

export const EN_TRUST = {
  disclaimer:
    "DeGeldHeld is a trade name of Techz B.V. (Dutch Chamber of Commerce / KvK " +
    "84079398). Indications are not financial or tax advice. All official " +
    "filings are in Dutch, as required by the Dutch authorities.",
} as const;

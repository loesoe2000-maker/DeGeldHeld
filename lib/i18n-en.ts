/**
 * lib/i18n-en.ts — v38 uitbreiding A — Engelstalige copy voor internationals.
 *
 * Bewust GEEN volledige i18n-bibliotheek (next-intl e.d.): de hele site is
 * hardcoded NL en een route-brede locale-verbouwing zou elke bestaande route
 * raken — te riskant vóór het NL-product bewezen is. Dit is de kiem: één
 * losse Engelse landingslaag die naar de bestaande NL-checks leidt. Groeit
 * later uit tot een echte vertaal-laag als de expat-doelgroep aanslaat.
 *
 * KERN-BOODSCHAP naar de expat: "You live in the Netherlands, so you have
 * Dutch money waiting — Box 3 tax, rent service-cost refunds, energy bill
 * corrections. We handle the Dutch paperwork; you keep the money."
 *
 * Belangrijk + eerlijk in de copy: de checks zelf + de officiële brieven
 * blijven Nederlands (de instanties lezen geen Engels). Dat is juist de
 * waarde — de expat hoeft het Nederlandse papierwerk niet zelf te snappen.
 */

export type EnTile = {
  /** Verwijst naar een BESTAANDE NL-check-route (ongewijzigd). */
  href: string;
  emoji: string;
  title: string;
  body: string;
};

export const EN_HERO = {
  eyebrow: "For internationals living in the Netherlands",
  title: "You probably have Dutch money waiting for you",
  subtitle:
    "Living in the Netherlands means you may be owed money you never claimed — " +
    "over-paid Box 3 wealth tax, rent service-cost refunds, energy bill " +
    "corrections, missed allowances. DeGeldHeld checks it for free and handles " +
    "the Dutch paperwork. No cure, no pay.",
  ctaPrimary: "See what you can claim",
  ctaSecondary: "How it works",
} as const;

export const EN_TILES: ReadonlyArray<EnTile> = [
  {
    href: "/box3-check",
    emoji: "📊",
    title: "Box 3 wealth-tax refund",
    body:
      "Since the 2025 Supreme Court ruling you can reclaim Box 3 tax if your " +
      "real return was lower than the flat rate the tax office assumed. Common " +
      "for savers and cautious investors.",
  },
  {
    href: "/huurcommissie-check",
    emoji: "🏠",
    title: "Rent service-cost refund",
    body:
      "Your landlord must send a specified yearly service-cost statement. If it " +
      "doesn't add up, you can object via the Huurcommissie — we prepare the " +
      "Dutch objection for you.",
  },
  {
    href: "/energie-claim-check",
    emoji: "⚡",
    title: "Energy bill correction",
    body:
      "Wrong final energy statement? You can dispute it with your supplier and, " +
      "if needed, the Dutch disputes committee. We handle the complaint.",
  },
  {
    href: "/geld-check",
    emoji: "💶",
    title: "Allowances & benefits check",
    body:
      "Healthcare, rent and child allowances (toeslagen) are often left " +
      "unclaimed by internationals. Free indicative check — no DigiD needed.",
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
      "You submit or approve every step. We never move your money — refunds go " +
      "straight to your own account.",
  },
  {
    n: "4",
    title: "No cure, no pay",
    body:
      "If you get money back, we take a fair percentage. Nothing recovered? You " +
      "pay nothing.",
  },
] as const;

export const EN_TRUST = {
  disclaimer:
    "DeGeldHeld is a trade name of Techz B.V. (Dutch Chamber of Commerce / KvK " +
    "84079398). Indications are not financial or tax advice. All official " +
    "filings are in Dutch, as required by the Dutch authorities.",
} as const;

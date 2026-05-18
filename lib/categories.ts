/**
 * Per-category rules — drives comparison UI, negotiation prompt context,
 * and realistic savings expectations on /proof.
 */

import type { Category } from "@/lib/providers";

export type ComparisonUnit =
  | "monthly_eur"
  | "per_kwh"
  | "per_m3"
  | "per_year"
  | "interest_pct"
  | "monitoring_only";

export type CategoryRules = {
  id: Category;
  label: string;
  icon: string; // emoji as inline icon
  comparisonUnit: ComparisonUnit;
  /** Category-specific guidance injected into the negotiation prompt. */
  negotiationPlaybook: string;
  /** Realistic savings range used by /proof for expected-vs-actual. */
  typicalSavingPct: { low: number; high: number };
  /** What lever usually works for this category. */
  retentionLeverage: string;
  /** If false the negotiator should refuse (monitoring-only). */
  negotiable: boolean;
};

export const CATEGORY_RULES: Record<Category, CategoryRules> = {
  TELECOM: {
    id: "TELECOM",
    label: "Telecom & internet",
    icon: "📱",
    comparisonUnit: "monthly_eur",
    negotiationPlaybook:
      "Pak de retentie-afdeling: noem een goedkoper concurrent-aanbod, vraag matching, dreig met overstap binnen 30 dagen. Maandbedrag is de hefboom.",
    typicalSavingPct: { low: 15, high: 30 },
    retentionLeverage: "SWITCH_CLAIM",
    negotiable: true,
  },
  ENERGIE: {
    id: "ENERGIE",
    label: "Energie",
    icon: "⚡",
    comparisonUnit: "per_kwh",
    negotiationPlaybook:
      "Vergelijk vast vs variabel tarief en bekijk markt-mediaan per kWh. Argument: tarief loopt > markt door. Vraag herziening kWh-tarief of nieuwe vaste prijs.",
    typicalSavingPct: { low: 10, high: 25 },
    retentionLeverage: "TARIEF_VAST_VS_VAR",
    negotiable: true,
  },
  WATER: {
    id: "WATER",
    label: "Water",
    icon: "💧",
    comparisonUnit: "monitoring_only",
    negotiationPlaybook:
      "Water is een regionale monopolie in NL — niet onderhandelbaar. Toon alleen verbruik vs gemiddelde Nederlandse huishouden.",
    typicalSavingPct: { low: 0, high: 0 },
    retentionLeverage: "MONITORING",
    negotiable: false,
  },
  GEMEENTE: {
    id: "GEMEENTE",
    label: "Gemeente",
    icon: "🏛️",
    comparisonUnit: "monitoring_only",
    negotiationPlaybook:
      "Gemeentelijke belastingen (OZB, riool, afval) zijn vaste tarieven. Wel: kwijtschelding mogelijk bij laag inkomen — verwijs naar gemeente-website.",
    typicalSavingPct: { low: 0, high: 0 },
    retentionLeverage: "MONITORING",
    negotiable: false,
  },
  VERZEKERING: {
    id: "VERZEKERING",
    label: "Verzekering",
    icon: "🛡️",
    comparisonUnit: "per_year",
    negotiationPlaybook:
      "Vraag dekking-review: te uitgebreid? eigen risico te laag? Compleet-verzekerd-via-werk dubbele dekking? Verzekeraar matched vaak concurrent-premie.",
    typicalSavingPct: { low: 20, high: 40 },
    retentionLeverage: "DEKKING_DOWNGRADE",
    negotiable: true,
  },
  HYPOTHEEK: {
    id: "HYPOTHEEK",
    label: "Hypotheek",
    icon: "🏠",
    comparisonUnit: "interest_pct",
    negotiationPlaybook:
      "Vraag rente-reductie of dreig met oversluiten naar concurrent. Argument: huidige rente uit een hogere markt-fase. Banken bieden vaak 0,1-0,3% korting bij serieuze bedreiging.",
    typicalSavingPct: { low: 5, high: 15 },
    retentionLeverage: "OVERSLUITEN_DREIG",
    negotiable: true,
  },
  BANK: {
    id: "BANK",
    label: "Bank",
    icon: "🏦",
    comparisonUnit: "monthly_eur",
    negotiationPlaybook:
      "Vraag fee-waiver op betaalpakket. Hefboom: stap over naar gratis pakket (Bunq/N26/Knab) of klacht over verhoogde tarieven.",
    typicalSavingPct: { low: 5, high: 15 },
    retentionLeverage: "FEES_WAIVE",
    negotiable: true,
  },
  ABONNEMENT: {
    id: "ABONNEMENT",
    label: "Abonnement (overig)",
    icon: "📦",
    comparisonUnit: "monthly_eur",
    negotiationPlaybook:
      "Algemeen: vergelijk met concurrent prijs of downgrade naar lagere tier. Werkt vooral bij grote bedragen (> €30/mnd).",
    typicalSavingPct: { low: 10, high: 25 },
    retentionLeverage: "SWITCH_CLAIM",
    negotiable: true,
  },
  STREAMING: {
    id: "STREAMING",
    label: "Streaming",
    icon: "🎬",
    comparisonUnit: "monthly_eur",
    negotiationPlaybook:
      "Streaming biedt zelden retentie-korting. Wel: downgrade naar 'standard' of 'ad-supported' tier (Netflix/Disney+ €5-7 minder).",
    typicalSavingPct: { low: 0, high: 10 },
    retentionLeverage: "DOWNGRADE_TIER",
    negotiable: true,
  },
  GYM: {
    id: "GYM",
    label: "Sportabonnement",
    icon: "💪",
    comparisonUnit: "monthly_eur",
    negotiationPlaybook:
      "Vraag jaarbetaling-korting (10-20% direct) of pause-functie als je weinig komt. Concurrent: gratis dagpas of student-tarief.",
    typicalSavingPct: { low: 10, high: 20 },
    retentionLeverage: "ANNUAL_PREPAY",
    negotiable: true,
  },
  OV: {
    id: "OV",
    label: "Openbaar vervoer",
    icon: "🚆",
    comparisonUnit: "monthly_eur",
    negotiationPlaybook:
      "NS-abonnement: Dal/Weekend/Altijd Voordeel — match op je woon-werk-patroon. Spoordeelwinkel + groepskortingen bekijken.",
    typicalSavingPct: { low: 10, high: 30 },
    retentionLeverage: "PATTERN_MATCH",
    negotiable: true,
  },
  SOFTWARE: {
    id: "SOFTWARE",
    label: "Software",
    icon: "💻",
    comparisonUnit: "monthly_eur",
    negotiationPlaybook:
      "Software-saaS: vraag jaarbetaling (20-40% korting tov maand-tarief) of education-deal als je student/leraar bent. Adobe geeft regelmatig 30% retentie-korting bij opzeg-poging.",
    typicalSavingPct: { low: 20, high: 40 },
    retentionLeverage: "ANNUAL_DEAL",
    negotiable: true,
  },
  OPSLAG: {
    id: "OPSLAG",
    label: "Cloud-opslag",
    icon: "☁️",
    comparisonUnit: "monthly_eur",
    negotiationPlaybook:
      "Cloud-opslag (iCloud/Google One/Dropbox): goedkoopste is bijna altijd Google One jaarpakket of een goedkoper alternatief (Proton/Filen). Familie-plan splitten met partner halveert kosten.",
    typicalSavingPct: { low: 30, high: 50 },
    retentionLeverage: "FAMILY_PLAN",
    negotiable: true,
  },
  OVERIG: {
    id: "OVERIG",
    label: "Overig",
    icon: "📋",
    comparisonUnit: "monthly_eur",
    negotiationPlaybook:
      "Categorie onbekend — vraag generieke korting met algemene strategieën (langetermijn-korting, jaarbetaling, klant-loyaliteit).",
    typicalSavingPct: { low: 5, high: 15 },
    retentionLeverage: "GENERIC",
    negotiable: true,
  },
};

export function ruleFor(cat: Category): CategoryRules {
  return CATEGORY_RULES[cat] ?? CATEGORY_RULES.OVERIG;
}

/**
 * v12 — category-specific negotiation vocabulary. Fed to the LLM as a
 * prompt hint so the generated mail uses the terms a retentie-medewerker
 * actually expects (e.g. ENERGIE mail mentions "kWh-tarief", VERZEKERING
 * mentions "polisvoorwaarden"). Empty array = generic vocabulary.
 */
export const NEGOTIATION_VOCAB: Record<Category, string[]> = {
  TELECOM: ["abonnement", "bundel", "klantbehoud-team", "tarief", "datapakket"],
  ENERGIE: [
    "kWh-tarief",
    "vast tarief",
    "voorschot",
    "jaarafrekening",
    "vastrecht",
    "leveringskosten",
  ],
  WATER: ["m³-tarief", "vastrecht", "drinkwaterheffing"],
  GEMEENTE: ["OZB", "afvalstoffenheffing", "riool­heffing", "kwijtschelding"],
  VERZEKERING: ["premie", "dekking", "eigen risico", "polisvoorwaarden", "no-claim"],
  HYPOTHEEK: [
    "rente",
    "oversluiten",
    "rentevaste periode",
    "NHG",
    "rentemiddeling",
    "boetevrije aflossing",
  ],
  BANK: ["betaalpakket", "rente", "spaargeld", "tarief", "fee-waiver"],
  ABONNEMENT: ["abonnement", "jaartarief", "downgrade", "opzeg-termijn"],
  STREAMING: ["abonnement", "tier", "ads-supported", "family-plan"],
  GYM: ["abonnement", "jaarbetaling", "pause-functie"],
  OV: ["abonnement", "dal-voordeel", "weekend-voordeel"],
  SOFTWARE: ["abonnement", "jaarbetaling", "education-deal", "retentie-korting"],
  OPSLAG: ["abonnement", "family-plan", "jaarpakket"],
  OVERIG: [],
};

/** Vocabulary for a category, falling back to OVERIG (empty). */
export function vocabFor(cat: Category): string[] {
  return NEGOTIATION_VOCAB[cat] ?? NEGOTIATION_VOCAB.OVERIG;
}

// ─────────────────────────────────────────────────────────────
// v10 — Primary categories + sub-types
// 7 primary buckets + flexibele sub-types. De BillCategory enum
// blijft bestaan voor backwards-compat met records die vóór deze
// migratie zijn aangemaakt.
// ─────────────────────────────────────────────────────────────

export type PrimaryCategory =
  | "TELECOM"
  | "ENERGIE"
  | "VERZEKERING"
  | "WONEN"
  | "FINANCIEN"
  | "ABONNEMENTEN"
  | "OVERIG";

export const PRIMARY_CATEGORIES: PrimaryCategory[] = [
  "TELECOM",
  "ENERGIE",
  "VERZEKERING",
  "WONEN",
  "FINANCIEN",
  "ABONNEMENTEN",
  "OVERIG",
];

export const SUB_TYPES: Record<PrimaryCategory, string[]> = {
  TELECOM: ["mobiel", "internet", "tv-pakket", "combinatie"],
  ENERGIE: ["stroom", "gas", "warmte", "water", "stroom+gas"],
  VERZEKERING: ["zorg", "auto", "woon", "aansprakelijkheid", "reis", "leven", "uitvaart"],
  WONEN: ["hypotheek", "gemeente-belasting", "waterschap", "vve-bijdrage", "huur"],
  FINANCIEN: ["bankpakket", "creditcard", "beleggingsfee", "spaarrekening"],
  ABONNEMENTEN: ["streaming", "software", "gym", "opslag", "magazines", "lidmaatschap"],
  OVERIG: [],
};

export const PRIMARY_META: Record<
  PrimaryCategory,
  { label: string; labelEn: string; icon: string }
> = {
  TELECOM: { label: "Telecom & internet", labelEn: "Telecom & internet", icon: "📱" },
  ENERGIE: { label: "Energie", labelEn: "Energy", icon: "⚡" },
  VERZEKERING: { label: "Verzekering", labelEn: "Insurance", icon: "🛡️" },
  WONEN: { label: "Wonen", labelEn: "Housing", icon: "🏠" },
  FINANCIEN: { label: "Financiën", labelEn: "Finance", icon: "🏦" },
  ABONNEMENTEN: { label: "Abonnementen", labelEn: "Subscriptions", icon: "📦" },
  OVERIG: { label: "Overig", labelEn: "Other", icon: "📋" },
};

/**
 * Map a legacy BillCategory enum value to its primary bucket.
 * Used by the categories-v2 backfill + at read-time for old Bills.
 */
export function primaryFromLegacy(legacy: Category): PrimaryCategory {
  switch (legacy) {
    case "TELECOM":
      return "TELECOM";
    case "ENERGIE":
      return "ENERGIE";
    case "VERZEKERING":
      return "VERZEKERING";
    case "WATER":
    case "GEMEENTE":
    case "HYPOTHEEK":
      return "WONEN";
    case "BANK":
      return "FINANCIEN";
    case "STREAMING":
    case "SOFTWARE":
    case "GYM":
    case "OPSLAG":
    case "ABONNEMENT":
      return "ABONNEMENTEN";
    case "OV":
      return "VERZEKERING"; // OV-pas → autoverzekering bucket; fall back to OVERIG if needed
    case "OVERIG":
      return "OVERIG";
    default:
      return "OVERIG";
  }
}

/**
 * Reverse map: a primary + sub-type that should be used as the legacy enum
 * for backwards-compat reads. Conservative — falls back to OVERIG when
 * ambiguous.
 */
export function legacyFromPrimary(primary: PrimaryCategory, subType?: string | null): Category {
  switch (primary) {
    case "TELECOM":
      return "TELECOM";
    case "ENERGIE":
      if (subType === "water") return "WATER";
      return "ENERGIE";
    case "VERZEKERING":
      return "VERZEKERING";
    case "WONEN":
      if (subType === "hypotheek") return "HYPOTHEEK";
      if (subType === "gemeente-belasting" || subType === "waterschap") return "GEMEENTE";
      return "OVERIG";
    case "FINANCIEN":
      return "BANK";
    case "ABONNEMENTEN":
      if (subType === "streaming") return "STREAMING";
      if (subType === "software") return "SOFTWARE";
      if (subType === "gym") return "GYM";
      if (subType === "opslag") return "OPSLAG";
      return "ABONNEMENT";
    case "OVERIG":
    default:
      return "OVERIG";
  }
}

/** UI label for a primary + sub-type combo. */
export function displayLabel(
  primary: PrimaryCategory,
  subType?: string | null,
  language: "nl" | "en" = "nl",
): string {
  const meta = PRIMARY_META[primary];
  const base = language === "en" ? meta.labelEn : meta.label;
  if (!subType) return base;
  return `${base} · ${subType}`;
}

/**
 * Heuristic backfill: gegeven legacy enum + provider naam, raad de
 * sub-type. Gebruikt door scripts/migrate-categories-v2.ts.
 */
export function inferSubType(legacy: Category, providerName: string): string | null {
  const p = providerName.toLowerCase();
  if (legacy === "TELECOM") {
    if (p.includes("ziggo") || p.includes("kpn glas") || p.includes("internet") || p.includes("bt") || p.includes("sky") || p.includes("virgin"))
      return "internet";
    return "mobiel";
  }
  if (legacy === "ENERGIE") {
    return "stroom+gas";
  }
  if (legacy === "WATER") return null; // sub-types live under WONEN now
  if (legacy === "STREAMING") return "streaming";
  if (legacy === "SOFTWARE") return "software";
  if (legacy === "GYM") return "gym";
  if (legacy === "OPSLAG") return "opslag";
  if (legacy === "HYPOTHEEK") return "hypotheek";
  if (legacy === "GEMEENTE") return "gemeente-belasting";
  if (legacy === "BANK") return "bankpakket";
  if (legacy === "OV") return "auto";
  // Provider-naam heuristiek voor edge cases:
  if (p.includes("water") || p.includes("vitens") || p.includes("evides") || p.includes("dunea") || p.includes("pwn"))
    return "water";
  return null;
}

export function isNegotiable(cat: Category): boolean {
  return ruleFor(cat).negotiable;
}

/** Format the comparison unit for the UI. */
export function unitLabel(cat: Category): string {
  switch (ruleFor(cat).comparisonUnit) {
    case "monthly_eur":
      return "€/maand";
    case "per_kwh":
      return "€/kWh";
    case "per_m3":
      return "€/m³";
    case "per_year":
      return "€/jaar";
    case "interest_pct":
      return "% rente";
    case "monitoring_only":
      return "monitoring";
  }
}

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

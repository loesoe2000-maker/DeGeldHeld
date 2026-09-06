/**
 * lib/category-strategy.ts — v30 fee-integrity laag op CATEGORY_RULES.
 *
 * V27 introduceerde 3 type-strategieën:
 *   - TYPE A (NCNP) — wij onderhandelen voor je, 20% NCNP op bewezen besparing.
 *   - TYPE B (advies)  — gratis advies, geen fee.
 *   - TYPE C (monopolie) — alleen monitoring, geen fee.
 *
 * V30 corrigeert TELECOM van A → B: in de praktijk laat NL-telecom (KPN/
 * Vodafone/Odido/Ziggo) geen automatische e-mail-onderhandeling toe — de
 * "lever" is een belscript dat de klant zelf gebruikt. Een 20% NCNP op een
 * gesprek dat de klant zelf voert is ethisch grijs (zie V30_REPORT.md).
 *
 * V30-correctie: TELECOM `fee: false` → Plus-pijler ("jaarlijks nieuw retentie-
 * belscript op maat"). ENERGIE / OV / SOFTWARE / OPSLAG / STREAMING / GYM /
 * ABONNEMENT / BANK blijven `fee: true` (echte e-mail-onderhandel-flow).
 */
import type { Category } from "@/lib/providers";
import { CATEGORY_RULES, type CategoryRules } from "@/lib/categories";

export type CategoryStrategy = "TYPE_A_NCNP" | "TYPE_B_ADVIES" | "TYPE_C_MONITORING";

export type CategoryStrategyEntry = {
  /** Mag deze categorie een NCNP-fee triggeren bij bewezen besparing? */
  fee: boolean;
  /** Welk type strategie hoort hierbij. */
  strategy: CategoryStrategy;
  /** Korte uitleg waarom — toont op /plus + in de comparison-page. */
  note: string;
};

/**
 * Per-categorie fee-/strategie-axis. De waarheid voor fee-eligibility leeft
 * hier; `CATEGORY_RULES.negotiable` blijft de UX-vlag voor "kunnen we
 * überhaupt iets doen?".
 */
export const CATEGORY_STRATEGY: Record<Category, CategoryStrategyEntry> = {
  // V30: TELECOM herframed van A → B. Belscript-flow → Plus-pijler.
  TELECOM: {
    fee: false,
    strategy: "TYPE_B_ADVIES",
    note:
      "Belscript-flow betekent dat de klant zelf met retentie belt. Relay daarop " +
      "is grijs; we leveren in plaats daarvan een jaarlijks vernieuwd " +
      "retentie-belscript via Plus.",
  },
  ENERGIE: {
    fee: true,
    strategy: "TYPE_A_NCNP",
    note: "E-mail-onderhandeling werkt — we mailen je provider; relay toegestaan.",
  },
  // Monopolies / no-fee categories.
  WATER: {
    fee: false,
    strategy: "TYPE_C_MONITORING",
    note: "Water is een regionale monopolie — alleen monitoring, geen onderhandeling.",
  },
  GEMEENTE: {
    fee: false,
    strategy: "TYPE_C_MONITORING",
    note: "Gemeente-belastingen zijn vaste tarieven — alleen monitoring / kwijtschelding-tip.",
  },
  // AFM-gegate categorieën blijven NIET ondersteund. Markeren als TYPE_B
  // zodat de fee-logica niet per ongeluk een 20% fee triggert; UI gates
  // ze sowieso via isSupportedCategory.
  VERZEKERING: {
    fee: false,
    strategy: "TYPE_B_ADVIES",
    note: "AFM-gegate — niet ondersteund tot vergunning.",
  },
  HYPOTHEEK: {
    fee: false,
    strategy: "TYPE_B_ADVIES",
    note: "AFM-gegate — niet ondersteund tot vergunning.",
  },
  BANK: {
    fee: true,
    strategy: "TYPE_A_NCNP",
    note: "E-mail-onderhandeling op betaalpakket-kosten werkt — relay toegestaan.",
  },
  ABONNEMENT: {
    fee: true,
    strategy: "TYPE_A_NCNP",
    note: "Generieke abonnementen — e-mail-onderhandeling werkt vaak; relay toegestaan.",
  },
  STREAMING: {
    fee: false,
    strategy: "TYPE_B_ADVIES",
    note: "Streaming geeft zelden retentie-korting — alleen tier-downgrade-advies.",
  },
  GYM: {
    fee: false,
    strategy: "TYPE_B_ADVIES",
    note: "Gym = jaarbetaling/pause-advies; geen e-mail-onderhandeling die relay rechtvaardigt.",
  },
  OV: {
    fee: false,
    strategy: "TYPE_B_ADVIES",
    note: "OV-abonnementen → pattern-match advies (Dal/Weekend/Altijd Voordeel); geen fee.",
  },
  SOFTWARE: {
    fee: true,
    strategy: "TYPE_A_NCNP",
    note: "Software-saaS — retentie-mail werkt (Adobe e.d.); relay toegestaan.",
  },
  OPSLAG: {
    fee: false,
    strategy: "TYPE_B_ADVIES",
    note: "Cloud-opslag — advies (family-plan / lager tier), geen fee.",
  },
  OVERIG: {
    fee: false,
    strategy: "TYPE_B_ADVIES",
    note: "Categorie onbekend — generiek advies, geen fee.",
  },
};

/** Mag voor deze categorie een NCNP-fee getriggerd worden? */
export function categoryAllowsFee(cat: Category): boolean {
  return CATEGORY_STRATEGY[cat]?.fee ?? false;
}

/** Strategie-type voor deze categorie. */
export function categoryStrategyType(cat: Category): CategoryStrategy {
  return CATEGORY_STRATEGY[cat]?.strategy ?? "TYPE_B_ADVIES";
}

/** Convenience: tegelijk de bestaande CategoryRules + de fee-laag. */
export function categoryFull(cat: Category): CategoryRules & CategoryStrategyEntry {
  return { ...CATEGORY_RULES[cat], ...CATEGORY_STRATEGY[cat] };
}

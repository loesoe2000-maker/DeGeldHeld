/**
 * lib/zorgkosten.ts — Zorgkostenaftrek-indicatie (specifieke zorgkosten).
 *
 * Pure functie, client-side. Drempel-formule en categorie-lijst komen EXACT
 * uit docs/V29_DATA_2026.md (Belastingdienst). Géén exact belastingvoordeel
 * in EUR (= aftrek × marginaal tarief, varieert per gebruiker).
 *
 * bron: Belastingdienst — drempelbedrag 2026
 *   https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/relatie_familie_en_gezondheid/gezondheid/aftrek_zorgkosten/hoe_berekent_u_uw_aftrek/drempelbedrag_berekenen/drempelbedrag-2026
 * bron: Belastingdienst — overzicht aftrekbare zorgkosten
 *   https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/relatie_familie_en_gezondheid/gezondheid/aftrek_zorgkosten/overzicht_zorgkosten/
 */

export const ZORGKOSTEN_PEILDATUM = "2026-01-01";
export const ZORGKOSTEN_VERIFIED_AT = "2026-05-24";

/** Drempel-formule + minimum (cents) per jaar. */
// bron: Belastingdienst — drempelbedragen 2025/2026
export const DREMPEL = {
  // jaar 2026
  pct: 1.65, // formule = max(min, 1,65% × drempelinkomen)
  minAlleenCents: 16_600, // € 166 in 2026
  minPartnerCents: 33_200, // 2× € 166 (per persoon, totaal)
  // 113%-AOW-verhoging onder grens
  aowVerhogingGrensCents: 4_112_300, // € 41.123 (drempelinkomen-grens 2026)
  aowVerhogingFactor: 2.13, // 113% bovenop = factor 2.13 op de aftrekbare post
} as const;

export type ZorgkostenInput = {
  /** Drempelinkomen (≈ verzamelinkomen) in cents. */
  drempelinkomenCents: number;
  /** Heeft een fiscaal partner (gezamenlijke drempel + aftrek). */
  partner: boolean;
  /** Heeft op 1 januari de AOW-leeftijd (113%-verhoging in scope). */
  aowGerechtigd: boolean;
  /** Opgegeven bedragen per categorie in cents. */
  kostenPerCategorie: {
    geneeskundigeHulp?: number; // arts/specialist/fysio buiten basis
    medicijnen?: number; // op doktersrecept
    hulpmiddelen?: number; // gehoorapparaat / prothese / steunzolen
    vervoerZiekte?: number; // OV-kosten of km × tarief
    ziekenbezoek?: number; // > 10 km, > 10 dgn
    dieet?: number; // forfait dieet-lijst Belastingdienst
    extraGezinshulp?: number; // i.v.m. ziekte
    extraKleding?: number; // forfaitair
    ivf?: number; // boven 3e poging
  };
};

export type ChecklistItem = {
  id: string;
  label: string;
  /** Korte herinnering of dit aftrekbaar kán zijn (bevestiging blijft bij Belastingdienst). */
  mogelijkAftrekbaar: boolean;
  toelichting: string;
};

/**
 * Veelvergeten posten (sourced uit Belastingdienst-overzicht 2024-2026).
 * Geen exacte bedragen — alleen JA/NEE-checklist.
 */
export const CHECKLIST_VEELVERGETEN: ReadonlyArray<ChecklistItem> = [
  {
    id: "fysio_buiten_basis",
    label: "Fysiotherapie buiten basisverzekering",
    mogelijkAftrekbaar: true,
    toelichting: "Sessies waarvoor je zelf betaalde (boven basisverzekering of aanvullende dekking) — bewaar facturen.",
  },
  {
    id: "alternatieve_geneeswijzen",
    label: "Alternatieve geneeswijzen op doktersrecept",
    mogelijkAftrekbaar: true,
    toelichting: "Zoals homeopathie of acupunctuur — alléén met een verwijzing van een huisarts/specialist.",
  },
  {
    id: "tandarts_boven_basis",
    label: "Tandarts boven basis (vanaf 18) / orthodontie",
    mogelijkAftrekbaar: true,
    toelichting: "Eigen bijdragen die niet door aanvullende verzekering zijn vergoed.",
  },
  {
    id: "hulpmiddelen",
    label: "Hulpmiddelen (gehoorapparaat, prothese, steunzolen)",
    mogelijkAftrekbaar: true,
    toelichting: "Niet gratis verstrekt door de zorgverzekeraar — eigen bijdrage of aanschaf valt eronder.",
  },
  {
    id: "vervoer_doktersbezoek",
    label: "Vervoer i.v.m. doktersbezoek / ziekenhuis",
    mogelijkAftrekbaar: true,
    toelichting: "Auto: km × tarief; OV: ticketprijs. Bij chronische zorg vaak fors per jaar.",
  },
  {
    id: "ziekenbezoek_familie",
    label: "Reiskosten ziekenbezoek (> 10 km / > 10 dagen)",
    mogelijkAftrekbaar: true,
    toelichting: "Familielid/partner bezoekt iemand in het ziekenhuis op > 10 km, > 10 dagen.",
  },
  {
    id: "dieet_op_recept",
    label: "Dieet op doktersrecept",
    mogelijkAftrekbaar: true,
    toelichting: "Vaste forfait-bedragen uit de Belastingdienst-dieetlijst — jaarlijks geactualiseerd.",
  },
  {
    id: "extra_gezinshulp",
    label: "Extra gezinshulp (vanwege ziekte)",
    mogelijkAftrekbaar: true,
    toelichting: "Boven wat de gemeente/zorgverzekeraar al heeft vergoed.",
  },
  {
    id: "extra_kleding_beddengoed",
    label: "Extra kleding en beddengoed (vanwege ziekte)",
    mogelijkAftrekbaar: true,
    toelichting: "Forfaitaire bedragen, jaarlijks vastgesteld door Belastingdienst.",
  },
  {
    id: "ivf",
    label: "IVF-behandeling boven 3e poging",
    mogelijkAftrekbaar: true,
    toelichting: "Vanaf de 4e poging zijn de kosten aftrekbaar (niet de eerste 3).",
  },
  {
    id: "premie",
    label: "Premie zorgverzekering (basis + aanvullend)",
    mogelijkAftrekbaar: false,
    toelichting: "NIET aftrekbaar als specifieke zorgkost.",
  },
  {
    id: "eigen_risico",
    label: "Eigen risico zorgverzekering",
    mogelijkAftrekbaar: false,
    toelichting: "NIET aftrekbaar als specifieke zorgkost.",
  },
  {
    id: "bril_lens",
    label: "Brillen of contactlenzen",
    mogelijkAftrekbaar: false,
    toelichting: "Sinds 2014 NIET meer aftrekbaar.",
  },
];

export type ZorgkostenResult = {
  drempelCents: number;
  totaalKostenCents: number;
  aftrekbaarCents: number;
  indicatieJa: boolean;
  bovenAowVerhogingGrens: boolean;
  checklist: ReadonlyArray<ChecklistItem>;
  uitleg: string;
  bron: string;
  peildatum: string;
};

export const ZORGKOSTEN_DISCLAIMER =
  "Dit is een indicatie. Het exacte aftrekbedrag bepaalt de Belastingdienst op " +
  "basis van bewijsstukken (facturen, doktersrecepten). Je belastingvoordeel = " +
  "aftrekbaar bedrag × jouw marginale tarief (36-49,5%) — dat verschilt per " +
  "huishouden. DeGeldHeld slaat je zorgkosten/inkomen niet op: de check rekent " +
  "in je eigen browser.";

const BRON = "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/relatie_familie_en_gezondheid/gezondheid/aftrek_zorgkosten/hoe_berekent_u_uw_aftrek/drempelbedrag_berekenen/drempelbedrag-2026";

function clampPositive(n: number | undefined): number {
  return Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0;
}

/** Drempel-formule: max(min, 1,65% × drempelinkomen). Partner = drempel × 2. */
export function zorgkostenDrempel(input: Pick<ZorgkostenInput, "drempelinkomenCents" | "partner">): number {
  const income = clampPositive(input.drempelinkomenCents);
  const min = input.partner ? DREMPEL.minPartnerCents : DREMPEL.minAlleenCents;
  const partnerScale = input.partner ? 2 : 1;
  return Math.max(min, Math.round(((income * DREMPEL.pct) / 100) * partnerScale));
}

/**
 * Pure zorgkostenaftrek-indicatie. Geen exact belastingvoordeel (hangt van
 * marginale tarief af) — alleen of er boven-drempel-aftrek is.
 */
export function estimateZorgkostenAftrek(input: ZorgkostenInput): ZorgkostenResult {
  const drempel = zorgkostenDrempel(input);
  const k = input.kostenPerCategorie;
  const totaal =
    clampPositive(k.geneeskundigeHulp) +
    clampPositive(k.medicijnen) +
    clampPositive(k.hulpmiddelen) +
    clampPositive(k.vervoerZiekte) +
    clampPositive(k.ziekenbezoek) +
    clampPositive(k.dieet) +
    clampPositive(k.extraGezinshulp) +
    clampPositive(k.extraKleding) +
    clampPositive(k.ivf);

  // AOW-113%-verhoging: posten vervoer/dieet/gezinshulp/kleding mogen verhoogd
  // worden als de gebruiker AOW-gerechtigd is én onder de inkomensgrens.
  const bovenAowVerhogingGrens =
    input.drempelinkomenCents > DREMPEL.aowVerhogingGrensCents;
  let totaalNaVerhoging = totaal;
  if (input.aowGerechtigd && !bovenAowVerhogingGrens) {
    const verhoogbaar =
      clampPositive(k.vervoerZiekte) +
      clampPositive(k.dieet) +
      clampPositive(k.extraGezinshulp) +
      clampPositive(k.extraKleding);
    const niet = totaal - verhoogbaar;
    totaalNaVerhoging = Math.round(niet + verhoogbaar * DREMPEL.aowVerhogingFactor);
  }

  const aftrekbaar = Math.max(0, totaalNaVerhoging - drempel);

  return {
    drempelCents: drempel,
    totaalKostenCents: totaalNaVerhoging,
    aftrekbaarCents: aftrekbaar,
    indicatieJa: aftrekbaar > 0,
    bovenAowVerhogingGrens,
    checklist: CHECKLIST_VEELVERGETEN,
    uitleg:
      aftrekbaar > 0
        ? `Je opgegeven zorgkosten (${eurFmt(totaalNaVerhoging)}) liggen boven de ` +
          `drempel van ${eurFmt(drempel)} → indicatief ${eurFmt(aftrekbaar)} aftrekbaar. ` +
          "Je belastingvoordeel = dit bedrag × jouw marginale tarief (36-49,5%)."
        : `Je opgegeven zorgkosten (${eurFmt(totaalNaVerhoging)}) blijven onder de ` +
          `drempel van ${eurFmt(drempel)}. Check de checklist voor posten die je mogelijk vergat.`,
    bron: BRON,
    peildatum: ZORGKOSTEN_PEILDATUM,
  };
}

function eurFmt(c: number): string {
  return (c / 100).toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
}

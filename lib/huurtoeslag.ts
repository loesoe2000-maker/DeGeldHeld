/**
 * lib/huurtoeslag.ts — v40 F3 — netto besparing na huurtoeslag-terugname.
 *
 * WAAROM DIT BESTAAT. Bij een huurder mét huurtoeslag daalt de toeslag mee
 * zodra de kale huur daalt. Een huurverlaging van € 100 kan de huurder netto
 * € 0 opleveren. Een fee over de BRUTO verlaging pakt die klant dan geld af
 * voor een voordeel dat hij niet krijgt. Daarom rekent de huurprijs-check de
 * fee over de conservatief bepaalde NETTO besparing.
 *
 * BRONNEN (opgehaald 4-9-2026, alle primair):
 *  - Wet op de huurtoeslag, geldend 1-1-2026 — wetten.overheid.nl/BWBR0008659
 *  - Besluit op de huurtoeslag, geldend 1-1-2026 — wetten.overheid.nl/BWBR0008763
 *  - Regeling huurtoeslaggrenzen 2026 — Stcrt. 2025, 39783
 *
 * WAT ER PER 1-1-2026 VERANDERDE (en waarom secundaire bronnen elkaar
 * tegenspraken): de normhuurformule is vervallen (art. 18 en 19 Wht), de
 * basishuur is nu een vast bedrag en het inkomenseffect zit in een lineaire
 * afbouw (art. 21 lid 2). De kwaliteitskortingsgrens en aftoppingsgrenzen
 * zijn NIET vervallen — art. 20 Wht staat onverkort. De maximale huurgrens
 * is geen afwijzingsgrond meer maar werkt als plafond (art. 21 lid 1 onder d).
 * Ook nieuw: servicekosten tellen niet meer mee in de rekenhuur, dus voor ons
 * loopt kale huur 1-op-1 naar rekenhuur.
 */

/** Jaargesleuteld — nooit losse constanten door de codebase (zie geldigTot). */
export interface HuurtoeslagJaarConfig {
  geldigVanaf: string;
  geldigTot: string;
  bron: string;
  /** Vast bedrag dat de huurder zelf betaalt; hieronder geen toeslag. */
  basishuurEenpersoonsCents: number;
  basishuurMeerpersoonsCents: number;
  kwaliteitskortingsgrensCents: number;
  /** Aftoppingsgrens verschilt naar huishoudgrootte (1-2 vs 3+ personen). */
  aftoppingsgrensKleinCents: number;
  aftoppingsgrensGrootCents: number;
  maximaleHuurgrensCents: number;
}

export const HUURTOESLAG_PARAMS: Record<string, HuurtoeslagJaarConfig> = {
  "2026": {
    geldigVanaf: "2026-01-01",
    geldigTot: "2027-01-01",
    bron: "Stcrt. 2025, 39783 + Wht/Bht geldend 1-1-2026",
    // basishuur = normhuur € 252,49 − verlaging (€ 1,82 / € 3,63) − € 48,15
    // (Wet verlaging eigen bijdrage huurtoeslag). // bron: art. 16-17 Wht.
    basishuurEenpersoonsCents: 20252, // € 202,52
    basishuurMeerpersoonsCents: 20071, // € 200,71
    kwaliteitskortingsgrensCents: 49820, // € 498,20 — art. 20 Wht
    aftoppingsgrensKleinCents: 71302, // € 713,02 (1-2 personen)
    aftoppingsgrensGrootCents: 76414, // € 764,14 (3+ personen)
    maximaleHuurgrensCents: 93293, // € 932,93 — art. 13 Wht
  },
};

/**
 * Marginale terugname per huurschijf: hoeveel cent toeslag verlies je per
 * euro huurverlaging? De verlaging "eet" van boven naar beneden weg.
 * // bron: art. 21 lid 1 Wht jo. art. 7 Bht.
 */
export const TERUGNAME_BOVEN_MAXGRENS = 0; // geen toeslag over dit deel
export const TERUGNAME_BOVEN_AFTOPPING = 0.4; // 40%
export const TERUGNAME_BOVEN_KKG = 0.65; // 65%
export const TERUGNAME_ONDER_KKG = 1.0; // 100% — netto besparing is hier NUL
export const TERUGNAME_ONDER_BASISHUUR = 0;

export interface NettoBesparingInput {
  huidigeKaleHuurCents: number;
  nieuweKaleHuurCents: number;
  /** Ontvangt de huurder daadwerkelijk huurtoeslag? Zo nee: netto = bruto. */
  ontvangtHuurtoeslag: boolean;
  /** Bepaalt welke aftoppingsgrens geldt (1-2 personen vs 3 of meer). */
  aantalBewoners: number;
  vandaag?: Date;
}

export interface NettoBesparingBand {
  brutoPerMaandCents: number;
  /** Gegarandeerde ondergrens: volledige terugname per schijf. */
  nettoOndergrensPerMaandCents: number;
  /** Bovengrens: als de toeslag al (bijna) nul is, houdt de huurder alles. */
  nettoBovengrensPerMaandCents: number;
  /** True als de huurtoeslag de besparing volledig opeet. */
  volledigTeruggenomen: boolean;
  /**
   * True als er voor de peildatum geen geldige parameterset is. Dan mag de
   * UI GEEN eurobedrag tonen — alleen doorverwijzen. Dit is de verdediging
   * tegen stil verkeerd worden zodra de bedragen geïndexeerd zijn.
   */
  configVerlopen: boolean;
}

function configVoor(vandaag: Date): HuurtoeslagJaarConfig | null {
  const iso = vandaag.toISOString().slice(0, 10);
  for (const cfg of Object.values(HUURTOESLAG_PARAMS)) {
    if (iso >= cfg.geldigVanaf && iso < cfg.geldigTot) return cfg;
  }
  return null;
}

/**
 * Netto besparing per maand als bandbreedte. Bewust conservatief: de
 * ondergrens onderschat de terugname nooit, dus de fee kan de klant nooit
 * meer kosten dan hij overhoudt. Communiceer als "je houdt netto ten MINSTE
 * € X over" — nooit als een exact bedrag.
 */
export function nettoBesparingBand(input: NettoBesparingInput): NettoBesparingBand {
  const vandaag = input.vandaag ?? new Date();
  const bruto = Math.max(0, input.huidigeKaleHuurCents - input.nieuweKaleHuurCents);

  if (!input.ontvangtHuurtoeslag) {
    return {
      brutoPerMaandCents: bruto,
      nettoOndergrensPerMaandCents: bruto,
      nettoBovengrensPerMaandCents: bruto,
      volledigTeruggenomen: false,
      configVerlopen: false,
    };
  }

  const cfg = configVoor(vandaag);
  if (!cfg) {
    return {
      brutoPerMaandCents: bruto,
      nettoOndergrensPerMaandCents: 0,
      nettoBovengrensPerMaandCents: bruto,
      volledigTeruggenomen: false,
      configVerlopen: true,
    };
  }

  const basishuur =
    input.aantalBewoners >= 2
      ? cfg.basishuurMeerpersoonsCents
      : cfg.basishuurEenpersoonsCents;
  const aftopping =
    input.aantalBewoners >= 3
      ? cfg.aftoppingsgrensGrootCents
      : cfg.aftoppingsgrensKleinCents;

  // Schijven van hoog naar laag, met de terugname per schijf.
  const schijven: Array<{ boven: number; onder: number; terugname: number }> = [
    { boven: Infinity, onder: cfg.maximaleHuurgrensCents, terugname: TERUGNAME_BOVEN_MAXGRENS },
    { boven: cfg.maximaleHuurgrensCents, onder: aftopping, terugname: TERUGNAME_BOVEN_AFTOPPING },
    { boven: aftopping, onder: cfg.kwaliteitskortingsgrensCents, terugname: TERUGNAME_BOVEN_KKG },
    { boven: cfg.kwaliteitskortingsgrensCents, onder: basishuur, terugname: TERUGNAME_ONDER_KKG },
    { boven: basishuur, onder: 0, terugname: TERUGNAME_ONDER_BASISHUUR },
  ];

  let verlies = 0;
  for (const s of schijven) {
    // Het deel van de verlaging dat in deze schijf valt.
    const top = Math.min(input.huidigeKaleHuurCents, s.boven);
    const bodem = Math.max(input.nieuweKaleHuurCents, s.onder);
    const deel = Math.max(0, top - bodem);
    verlies += deel * s.terugname;
  }

  const netto = Math.max(0, Math.round(bruto - verlies));
  return {
    brutoPerMaandCents: bruto,
    nettoOndergrensPerMaandCents: netto,
    nettoBovengrensPerMaandCents: bruto,
    volledigTeruggenomen: bruto > 0 && netto === 0,
    configVerlopen: false,
  };
}

export const HUURTOESLAG_PROEFBEREKENING_URL =
  "https://www.belastingdienst.nl/wps/wcm/connect/nl/toeslagen/content/hulpmiddel-proefberekening-toeslagen";

export const HUURTOESLAG_UITLEG =
  "Krijg je huurtoeslag, dan daalt die mee als je huur omlaag gaat. Over het " +
  "deel van je huur onder € 498,20 levert een verlaging je zelfs helemaal " +
  "niets op: de toeslag daalt dan euro voor euro mee. We rekenen daarom met " +
  "wat je er netto op vooruitgaat, niet met de verlaging op papier.";

/**
 * lib/huurprijs-check.ts — v40 F3 — Huurprijs-check (WWS-toets + route).
 *
 * Combineert drie dingen tot één eerlijk oordeel:
 *  1. de gekalibreerde puntentelling (lib/wws-punten.ts, F2b);
 *  2. de MARGE-REGEL — de huurder meet zelf, dus rekenen we ook een ruime
 *     variant door die de punten (en daarmee de toegestane huur) maximaliseert;
 *  3. de ROUTE-vraag — mág deze huurder überhaupt een procedure starten?
 *     Lang niet iedereen met een te hoge huur heeft een zaak.
 *
 * Alle termijnen/routes komen uit docs/V40_DATA_HUURPRIJS_2026.md (primaire
 * bron: huurcommissie.nl, opgehaald 4-9-2026). Niets gokken.
 *
 * Pure functies, geen I/O: de check draait CLIENT-SIDE zodat adres, WOZ en
 * huurprijs de browser niet verlaten (zelfde privacy-lijn als V35).
 */

import {
  berekenWwsPunten,
  maxHuurMetClamp2026Cents,
  LAAG_SEGMENT_MAX_PUNTEN_2026,
  MIDDENHUUR_MAX_PUNTEN_2026,
  type WwsInput,
  type WwsRubrieken,
} from "@/lib/wws-punten";
import { addMonths } from "@/lib/date-utils";
import {
  HUURCOMMISSIE_LEGES_CENTS,
  HUUR_NCNP_DREMPEL_CENTS,
  computeHuurFee,
} from "@/lib/huurcommissie";

export const HUURPRIJS_PEILDATUM = "2026-01-01";
export const HUURPRIJS_VERIFIED_AT = "2026-09-04";

// ─── Wettelijke ankers (docs/V40_DATA_HUURPRIJS_2026.md) ────────────────────

/** Inwerkingtreding Wet betaalbare huur — scheidt oud/nieuw contractregime. */
export const WBH_INWERKING = new Date(2024, 6, 1); // 1 juli 2024
/** Vanaf deze datum kan een oud contract ≤ 143 punten huurverlaging vragen. */
export const WBH_LAAG_SEGMENT_VANAF = new Date(2025, 6, 1); // 1 juli 2025
/** Toetsing aanvangshuurprijs: binnen 6 maanden na aanvang van het contract. */
export const AANVANGSTOETS_MAANDEN = 6;
/** Voorstel huurverlaging: ingangsdatum ≥ 2 volle kalendermaanden later. */
export const VOORSTEL_MIN_KALENDERMAANDEN = 2;
/** Daarna: Huurcommissie inschakelen binnen 6 weken na die ingangsdatum. */
export const VOORSTEL_HUURCOMMISSIE_WEKEN = 6;

// ─── Types ──────────────────────────────────────────────────────────────────

export type ContractType = "vast" | "tijdelijk";

export interface HuurprijsContract {
  /** Datum waarop het huurcontract is ingegaan. */
  startDatum: Date;
  type: ContractType;
  /** Alleen bij een tijdelijk contract: de einddatum. */
  eindDatum?: Date | null;
}

/**
 * Wie woont er? Sinds 1-7-2024 is dit BEPALEND voor welk puntenstelsel geldt.
 * // bron: Besluit huurprijzen woonruimte art. 1 lid 2 (geldend 2026):
 * "Onder een woonruimte welke een zelfstandige woning vormt, wordt een
 * woonruimte verstaan als bedoeld in artikel 7:234 van het Burgerlijk
 * Wetboek, welke wordt bewoond door maximaal twee personen of welke wordt
 * bewoond door drie of meer personen die een duurzame gemeenschappelijke
 * huishouding hebben."
 */
export interface HuurprijsBewoning {
  /** Aantal personen dat de woning bewoont. */
  aantalBewoners: number;
  /** Voeren zij een duurzame gemeenschappelijke huishouding (gezin, koppel)? */
  gemeenschappelijkeHuishouding: boolean;
}

/**
 * Een woning met eigen voordeur, keuken en douche is tóch juridisch
 * ONZELFSTANDIG als er drie of meer mensen wonen zonder gemeenschappelijke
 * huishouding — de klassieke vriendengroep of woningdelers. Dan geldt het
 * WWSO (ander stelsel) en is onze puntentelling niet van toepassing.
 */
export function isJuridischZelfstandig(b: HuurprijsBewoning): boolean {
  return b.aantalBewoners <= 2 || b.gemeenschappelijkeHuishouding;
}

export type HuurprijsRoute =
  | "AANVANGSHUURPRIJS"
  | "HUURVERLAGING_VOORSTEL"
  | "WBH_LAAG_SEGMENT"
  | "GEEN_HOOGSEGMENT"
  | "GEEN_MIDDENHUUR_OUD_CONTRACT"
  // Woningdelers: ander stelsel (WWSO), niet "geen recht" — zie hieronder.
  | "ONZELFSTANDIG_WWSO";

export interface RouteUitkomst {
  route: HuurprijsRoute;
  mogelijk: boolean;
  titel: string;
  uitleg: string;
  /** Werkt de verlaging terug tot de contractdatum (alleen aanvangstoets)? */
  terugwerkendTotContractstart: boolean;
  /** Uiterste datum om de zaak te starten; null als er geen harde deadline is. */
  deadline: Date | null;
  legesCents: number;
}

export type HuurprijsVerdict =
  /** Juridisch onzelfstandig: ons stelsel is niet van toepassing. */
  | "onzelfstandig"
  | "kansrijk"
  | "twijfelgeval"
  | "geen_zaak"
  | "geen_route"
  | "buiten_tabel";

export interface MargeAannames {
  /** Meetonzekerheid op de opgegeven oppervlaktes, in procenten. */
  oppervlakteTolerantiePct: number;
  /** Onzekerheid op de opgegeven WOZ-waarde, in procenten. */
  wozTolerantiePct: number;
  /** Reken het aanrecht ook door in de hogere lengteklasse. */
  aanrechtOnzeker: boolean;
  /** Reken niet-opgegeven keuken-/sanitair-extra's op het wettelijke maximum. */
  extrasOnbekend: boolean;
}

/**
 * Standaard-marge. Bewust pessimistisch VOOR ONS: hoe ruimer we rekenen, hoe
 * hoger de toegestane huur, hoe minder cases we "kansrijk" noemen. Zo houden
 * we twijfelgevallen buiten de procedure (waar de klant € 25 leges kwijt is).
 */
export const STANDAARD_MARGE: MargeAannames = {
  oppervlakteTolerantiePct: 5,
  wozTolerantiePct: 5,
  aanrechtOnzeker: true,
  extrasOnbekend: true,
};

export interface HuurprijsInput {
  woning: WwsInput;
  contract: HuurprijsContract;
  /**
   * Verplicht: bepaalt of het zelfstandige stelsel überhaupt geldt. Bewust
   * NIET optioneel — vergeten te vragen was precies de bug (v40, 4-9-2026).
   */
  bewoning: HuurprijsBewoning;
  /** Kale huur per maand in centen (excl. servicekosten). */
  kaleHuurCents: number;
  marge?: MargeAannames;
  vandaag?: Date;
}

export interface HuurprijsResultaat {
  puntenBasis: number;
  puntenRuim: number;
  rubrieken: WwsRubrieken;
  maxHuurBasisCents: number | null;
  maxHuurRuimCents: number | null;
  kaleHuurCents: number;
  verdict: HuurprijsVerdict;
  /** Conservatieve maandverlaging (t.o.v. de RUIME berekening). */
  maandVerlagingMinCents: number;
  /** Maandverlaging t.o.v. de opgegeven waarden. */
  maandVerlagingBasisCents: number;
  /** 12 × de conservatieve maandverlaging — basis voor de fee-indicatie. */
  jaarbesparingMinCents: number;
  feeIndicatieCents: number;
  route: RouteUitkomst;
  waarschuwingen: string[];
}

// ─── Route-bepaling ─────────────────────────────────────────────────────────

/**
 * Welke procedure staat voor deze huurder open? Zie
 * docs/V40_DATA_HUURPRIJS_2026.md voor de letterlijke bronteksten.
 */
export function bepaalRoute(
  punten: number,
  contract: HuurprijsContract,
  vandaag: Date = new Date(),
): RouteUitkomst {
  const nieuwRegime = contract.startDatum.getTime() >= WBH_INWERKING.getTime();

  // 1. Hoogsegment (≥ 187 punten): vrije sector — de Huurcommissie kan geen
  //    bindende uitspraak doen over de huurprijs.
  if (punten > MIDDENHUUR_MAX_PUNTEN_2026) {
    return {
      route: "GEEN_HOOGSEGMENT",
      mogelijk: false,
      titel: "Vrije sector — geen procedure mogelijk",
      uitleg:
        `Met ${punten} punten valt de woning in het hoge segment (vanaf ` +
        `${MIDDENHUUR_MAX_PUNTEN_2026 + 1} punten). Daar geldt geen maximale ` +
        `huurprijs en kan de Huurcommissie geen bindende uitspraak doen.`,
      terugwerkendTotContractstart: false,
      deadline: null,
      legesCents: 0,
    };
  }

  // 2. Toetsing aanvangshuurprijs — de sterkste route: verlaging werkt terug
  //    tot de contractdatum.
  const aanvangDeadline = addMonths(contract.startDatum, AANVANGSTOETS_MAANDEN);
  if (nieuwRegime && vandaag.getTime() <= aanvangDeadline.getTime()) {
    return {
      route: "AANVANGSHUURPRIJS",
      mogelijk: true,
      titel: "Toetsing aanvangshuurprijs",
      uitleg:
        "Je woont hier korter dan 6 maanden. De Huurcommissie kan de " +
        "afgesproken huurprijs toetsen; een verlaging geldt met terugwerkende " +
        "kracht vanaf de datum waarop je contract is ingegaan.",
      terugwerkendTotContractstart: true,
      deadline: aanvangDeadline,
      legesCents: HUURCOMMISSIE_LEGES_CENTS,
    };
  }
  // Tijdelijk contract van vóór 1-7-2024: toetsing kan tot een half jaar ná
  // afloop van het contract.
  if (!nieuwRegime && contract.type === "tijdelijk" && contract.eindDatum) {
    const deadline = addMonths(contract.eindDatum, AANVANGSTOETS_MAANDEN);
    if (vandaag.getTime() <= deadline.getTime()) {
      return {
        route: "AANVANGSHUURPRIJS",
        mogelijk: true,
        titel: "Toetsing aanvangshuurprijs (tijdelijk contract)",
        uitleg:
          "Bij een tijdelijk contract van vóór 1 juli 2024 kun je de huurprijs " +
          "laten toetsen tot een half jaar na afloop van dat contract. Een " +
          "verlaging werkt terug tot de ingangsdatum van het contract.",
        terugwerkendTotContractstart: true,
        deadline,
        legesCents: HUURCOMMISSIE_LEGES_CENTS,
      };
    }
  }

  // 3. Lopend contract onder het nieuwe regime (≤ 186 punten = gereguleerd).
  if (nieuwRegime) {
    return {
      route: "HUURVERLAGING_VOORSTEL",
      mogelijk: true,
      titel: "Huurverlaging voorstellen",
      uitleg:
        `Met ${punten} punten valt de woning in het gereguleerde segment. Je ` +
        "stuurt eerst zelf een voorstel voor huurverlaging naar je verhuurder; " +
        "gaat die niet akkoord, dan beslist de Huurcommissie. De verlaging gaat " +
        "in per de voorgestelde datum — niet met terugwerkende kracht.",
      terugwerkendTotContractstart: false,
      deadline: null,
      legesCents: HUURCOMMISSIE_LEGES_CENTS,
    };
  }

  // 4. Oud contract (< 1-7-2024), laag segment: sinds 1-7-2025 recht op de
  //    maximale huurprijs (Wet betaalbare huur).
  if (
    punten <= LAAG_SEGMENT_MAX_PUNTEN_2026 &&
    vandaag.getTime() >= WBH_LAAG_SEGMENT_VANAF.getTime()
  ) {
    return {
      route: "WBH_LAAG_SEGMENT",
      mogelijk: true,
      titel: "Huurverlaging via de Wet betaalbare huur",
      uitleg:
        `Je contract is van vóór 1 juli 2024 en de woning heeft ${punten} ` +
        `punten (t/m ${LAAG_SEGMENT_MAX_PUNTEN_2026} = laag segment). Sinds ` +
        "1 juli 2025 heb je recht op de maximale huurprijs die bij dat " +
        "puntenaantal hoort. Je stelt de verlaging eerst zelf voor aan je " +
        "verhuurder; daarna kan de Huurcommissie beslissen.",
      terugwerkendTotContractstart: false,
      deadline: null,
      legesCents: HUURCOMMISSIE_LEGES_CENTS,
    };
  }

  // 5. Oud contract met 144–186 punten: middenhuur bestaat niet voor deze
  //    contracten → vrije sector → geen procedure.
  return {
    route: "GEEN_MIDDENHUUR_OUD_CONTRACT",
    mogelijk: false,
    titel: "Oud contract in de vrije sector — geen procedure mogelijk",
    uitleg:
      `Je contract is van vóór 1 juli 2024 en de woning heeft ${punten} punten. ` +
      "Bij contracten van vóór die datum kan er geen sprake zijn van middenhuur: " +
      "de woning valt in de vrije sector en de Huurcommissie kan de huurprijs " +
      "niet verlagen.",
    terugwerkendTotContractstart: false,
    deadline: null,
    legesCents: 0,
  };
}

// ─── Marge-regel ────────────────────────────────────────────────────────────

/**
 * De variant die de punten MAXIMALISEERT — en daarmee de toegestane huur.
 * Alleen als de werkelijke huur óók hierboven ligt, noemen we een zaak
 * kansrijk.
 */
export function ruimeVariant(
  input: WwsInput,
  marge: MargeAannames = STANDAARD_MARGE,
): WwsInput {
  const f = 1 + marge.oppervlakteTolerantiePct / 100;
  const aanrecht = !marge.aanrechtOnzeker
    ? input.aanrechtLengteCm
    : input.aanrechtLengteCm >= 200
      ? input.aanrechtLengteCm
      : input.aanrechtLengteCm >= 100
        ? 200
        : 100;

  return {
    ...input,
    vertrekken: input.vertrekken.map((v) => ({ ...v, m2: v.m2 * f })),
    overigeRuimten: input.overigeRuimten.map((r) => ({ ...r, m2: r.m2 * f })),
    aanrechtLengteCm: aanrecht,
    // 7 en 99 worden intern gecapt op de wettelijke verdubbelingsgrens.
    keukenExtraPunten: marge.extrasOnbekend ? 7 : input.keukenExtraPunten,
    sanitair: marge.extrasOnbekend
      ? { ...input.sanitair, extraPunten: 99 }
      : input.sanitair,
    buitenruimten: input.buitenruimten.geen
      ? input.buitenruimten
      : {
          ...input.buitenruimten,
          priveM2: (input.buitenruimten.priveM2 ?? 0) * f,
          gedeeld: input.buitenruimten.gedeeld?.map((g) => ({ ...g, m2: g.m2 * f })),
        },
    woz: {
      ...input.woz,
      waardeEuro: input.woz.waardeEuro * (1 + marge.wozTolerantiePct / 100),
    },
  };
}

// ─── Hoofdfunctie ───────────────────────────────────────────────────────────

export function checkHuurprijs(input: HuurprijsInput): HuurprijsResultaat {
  const marge = input.marge ?? STANDAARD_MARGE;
  const vandaag = input.vandaag ?? new Date();

  // GATE 0 — geldt ons stelsel wel? Drie of meer bewoners zonder
  // gemeenschappelijke huishouding = juridisch onzelfstandig (BHW art. 1
  // lid 2). Dan is elke uitkomst van berekenWwsPunten misleidend, dus we
  // rekenen niet door en verwijzen door. Belangrijk: dit is GEEN afwijzing —
  // onzelfstandige woonruimte valt altijd in de gereguleerde sector en heeft
  // dus altijd een maximale huurprijs.
  // // bron: Huurcommissie, Beleidsboek WWSO + Huurprijscheck onzelfstandige
  // woonruimte (geverifieerd 4-9-2026).
  if (!isJuridischZelfstandig(input.bewoning)) {
    return {
      puntenBasis: 0,
      puntenRuim: 0,
      rubrieken: berekenWwsPunten(input.woning).rubrieken,
      maxHuurBasisCents: null,
      maxHuurRuimCents: null,
      kaleHuurCents: input.kaleHuurCents,
      verdict: "onzelfstandig",
      maandVerlagingMinCents: 0,
      maandVerlagingBasisCents: 0,
      jaarbesparingMinCents: 0,
      feeIndicatieCents: 0,
      route: {
        route: "ONZELFSTANDIG_WWSO",
        mogelijk: false,
        titel: "Jouw woning valt onder een ander puntenstelsel",
        uitleg:
          `Je woont hier met ${input.bewoning.aantalBewoners} mensen zonder ` +
          "gemeenschappelijke huishouding. Dan telt je woning wettelijk als " +
          "onzelfstandige woonruimte, ook al heb je een eigen voordeur en " +
          "keuken. Daarvoor geldt een ánder puntenstelsel (het WWSO) dat wij " +
          "nog niet berekenen. Goed nieuws: onzelfstandige woonruimte valt " +
          "altijd in de gereguleerde sector, dus er is altijd een maximale " +
          "huurprijs — ongeacht wat je nu betaalt of wanneer je contract is " +
          "ingegaan. Gebruik de officiële Huurprijscheck voor onzelfstandige " +
          "woonruimte van de Huurcommissie.",
        terugwerkendTotContractstart: false,
        deadline: null,
        legesCents: 0,
      },
      waarschuwingen: [],
    };
  }

  const basis = berekenWwsPunten(input.woning);
  const ruim = berekenWwsPunten(ruimeVariant(input.woning, marge));

  const maxHuurBasisCents = maxHuurMetClamp2026Cents(basis.totaalPunten);
  const maxHuurRuimCents = maxHuurMetClamp2026Cents(ruim.totaalPunten);
  const route = bepaalRoute(basis.totaalPunten, input.contract, vandaag);

  const maandVerlagingBasisCents =
    maxHuurBasisCents == null ? 0 : Math.max(0, input.kaleHuurCents - maxHuurBasisCents);
  const maandVerlagingMinCents =
    maxHuurRuimCents == null ? 0 : Math.max(0, input.kaleHuurCents - maxHuurRuimCents);
  const jaarbesparingMinCents = maandVerlagingMinCents * 12;

  const waarschuwingen: string[] = [];
  if (!input.woning.energie.label) {
    waarschuwingen.push(
      "Je hebt geen energielabel ingevuld, dus we rekenen met het bouwjaar. " +
        "Dat levert bijna altijd minder punten op dan een echt label. Zoek je " +
        "label gratis op via EP-Online voor een betrouwbare uitkomst.",
    );
  }
  if (ruim.wozCapToegepast !== basis.wozCapToegepast) {
    waarschuwingen.push(
      "De WOZ-aftopping slaat om binnen de meetmarge — laat de puntentelling " +
        "nakijken voordat je een procedure start.",
    );
  }

  let verdict: HuurprijsVerdict;
  if (maxHuurBasisCents == null || maxHuurRuimCents == null) {
    verdict = "buiten_tabel";
  } else if (!route.mogelijk) {
    verdict = "geen_route";
  } else if (ruim.totaalPunten > MIDDENHUUR_MAX_PUNTEN_2026) {
    // Binnen de meetmarge kan de woning in de vrije sector vallen.
    verdict = "twijfelgeval";
    waarschuwingen.push(
      `Binnen de meetmarge komt de woning boven ${MIDDENHUUR_MAX_PUNTEN_2026} ` +
        "punten uit — dan zou het de vrije sector zijn en is er geen procedure. " +
        "Laat exact opmeten voordat je iets indient.",
    );
  } else if (input.kaleHuurCents > maxHuurRuimCents) {
    verdict = "kansrijk";
  } else if (input.kaleHuurCents > maxHuurBasisCents) {
    verdict = "twijfelgeval";
  } else {
    verdict = "geen_zaak";
  }

  return {
    puntenBasis: basis.totaalPunten,
    puntenRuim: ruim.totaalPunten,
    rubrieken: basis.rubrieken,
    maxHuurBasisCents,
    maxHuurRuimCents,
    kaleHuurCents: input.kaleHuurCents,
    verdict,
    maandVerlagingMinCents,
    maandVerlagingBasisCents,
    jaarbesparingMinCents,
    // Fee alleen op de CONSERVATIEVE besparing; drempel + cap uit V35.
    feeIndicatieCents: verdict === "kansrijk" ? computeHuurFee(jaarbesparingMinCents) : 0,
    route,
    waarschuwingen,
  };
}

/** Haalt de NCNP-drempel op zodat de UI 'm kan tonen zonder eigen constante. */
export const HUURPRIJS_NCNP_DREMPEL_CENTS = HUUR_NCNP_DREMPEL_CENTS;

// ─── Termijn-helpers voor de voorstel-route ─────────────────────────────────

/**
 * Vroegst mogelijke ingangsdatum van een huurverlagingsvoorstel: de eerste dag
 * van de maand ná 2 volle kalendermaanden. Verstuur je op 4 september, dan kan
 * de nieuwe huur op 1 december ingaan.
 */
export function vroegsteIngangsdatum(verstuurdOp: Date): Date {
  const eersteVolgendeMaand = new Date(
    verstuurdOp.getFullYear(),
    verstuurdOp.getMonth() + 1,
    1,
  );
  return addMonths(eersteVolgendeMaand, VOORSTEL_MIN_KALENDERMAANDEN);
}

/** Uiterste datum om de Huurcommissie in te schakelen: 6 weken erna. */
export function huurcommissieDeadline(ingangsdatum: Date): Date {
  const d = new Date(ingangsdatum);
  d.setDate(d.getDate() + VOORSTEL_HUURCOMMISSIE_WEKEN * 7);
  return d;
}

// ─── DIY-brief ──────────────────────────────────────────────────────────────

function eur(cents: number): string {
  return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function nlDatum(d: Date): string {
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Gratis DIY-brief. Bij de voorstel-routes is dit het wettelijk vereiste
 * voorstel aan de verhuurder; bij de aanvangstoets een begeleidende brief.
 * De klant verstuurt zelf — wij dienen nooit namens iemand in.
 */
export function huurverlagingsBrief(
  resultaat: HuurprijsResultaat,
  opts: { adres?: string; vandaag?: Date } = {},
): string {
  const vandaag = opts.vandaag ?? new Date();
  const adres = opts.adres?.trim() || "[adres van de woning]";
  const maxHuur = resultaat.maxHuurBasisCents;
  const punten = resultaat.puntenBasis;

  if (resultaat.route.route === "AANVANGSHUURPRIJS") {
    return [
      `Betreft: verzoek tot toetsing van de aanvangshuurprijs — ${adres}`,
      "",
      "Geachte heer/mevrouw,",
      "",
      `Ik huur de woning aan ${adres}. Op basis van het woningwaarderingsstelsel ` +
        `kom ik uit op ${punten} punten. Daarbij hoort een maximale kale huurprijs ` +
        `van ${maxHuur == null ? "[bedrag]" : eur(maxHuur)} per maand, terwijl ik ` +
        `${eur(resultaat.kaleHuurCents)} per maand betaal.`,
      "",
      "Ik verzoek u de huurprijs in overeenstemming te brengen met het " +
        "puntenaantal. Gaat u hier niet mee akkoord, dan leg ik de " +
        "aanvangshuurprijs binnen de wettelijke termijn van zes maanden ter " +
        "toetsing voor aan de Huurcommissie.",
      "",
      "Een uitspraak van de Huurcommissie werkt terug tot de ingangsdatum van " +
        "het huurcontract.",
      "",
      "Met vriendelijke groet,",
      "",
      "[naam]",
      `[datum: ${nlDatum(vandaag)}]`,
    ].join("\n");
  }

  const ingang = vroegsteIngangsdatum(vandaag);
  return [
    `Betreft: voorstel tot huurverlaging — ${adres}`,
    "",
    "Geachte heer/mevrouw,",
    "",
    `Ik huur de woning aan ${adres} en betaal op dit moment ` +
      `${eur(resultaat.kaleHuurCents)} kale huur per maand.`,
    "",
    `Op basis van het woningwaarderingsstelsel kom ik uit op ${punten} punten. ` +
      `De maximale kale huurprijs die daarbij hoort is ` +
      `${maxHuur == null ? "[bedrag]" : eur(maxHuur)} per maand.`,
    "",
    `Ik stel daarom voor de kale huur per ${nlDatum(ingang)} te verlagen naar ` +
      `${maxHuur == null ? "[bedrag]" : eur(maxHuur)} per maand.`,
    "",
    "Ik ontvang graag binnen drie weken uw schriftelijke reactie. Gaat u niet " +
      "akkoord, dan leg ik het voorstel voor aan de Huurcommissie.",
    "",
    "Met vriendelijke groet,",
    "",
    "[naam]",
    `[datum: ${nlDatum(vandaag)}]`,
  ].join("\n");
}

export const HUURPRIJS_DISCLAIMER =
  "Deze uitkomst is een indicatie op basis van wat je zelf invult, geen " +
  "juridisch advies. De Huurcommissie stelt bij een procedure altijd een eigen " +
  "puntentelling op door een onderzoeker ter plaatse; die telling is leidend.";

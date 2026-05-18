/**
 * v10 — rich per-primary-category info object.
 *
 * Driven by `/onderhandel/analyse` (collapsible "Hoe werkt X onderhandelen?")
 * + `/[category]-besparen` SEO pages.
 *
 * Cijfers zijn indicatief op basis van publieke NL-marktbenchmarks
 * (Consumentenbond, ACM, Nibud, NN-IP rapporten 2025-2026). Geen
 * harde garanties — UI rendert als "realistisch 10-25%" range, niet
 * als belofte.
 */

import type { PrimaryCategory } from "@/lib/categories";

export type CategoryInfo = {
  primary: PrimaryCategory;
  icon: string;
  /** 0..1 — gemiddelde realiseerbare besparing op deze categorie. */
  averageSavingsPct: number;
  /** Gemiddelde NL-huishouden maandlast in cents. */
  averageMonthlySpendNl: number;
  /** 2-4 zinnen over hoe de markt werkt. */
  marketDescription: string;
  /** 3-5 concrete tips. */
  howToSave: string[];
  /** Signalen dat je te veel betaalt. */
  warningSigns: string[];
  /** True voor monopolie-categorieën (water/gemeente in NL). */
  monopolyWarning: boolean;
  /** Range realistische besparing — bv "10-25%". */
  savingsRangeLabel: string;
};

export const CATEGORY_INFO: Record<PrimaryCategory, CategoryInfo> = {
  TELECOM: {
    primary: "TELECOM",
    icon: "📱",
    averageSavingsPct: 0.22,
    averageMonthlySpendNl: 5500,
    marketDescription:
      "De NL-telecommarkt is sinds 2022 oligopolisch (KPN/VodafoneZiggo/Odido) met dozens MVNOs erbovenop. " +
      "Reguliere prijsverhogingen volgen de CBS-inflatie (+/-3% per jaar) maar oude klanten worden vaak vergeten — " +
      "nieuwe-klant-kortingen kunnen tot 40% schelen. Een retentie-call levert vrijwel altijd resultaat op.",
    howToSave: [
      "Bel retentie en noem een concrete concurrent-aanbieding (matchen werkt vaak)",
      "Check of je een 'silent contract verlenging' hebt gekregen (=12 maanden tegen oud tarief)",
      "Switch naar MVNO op zelfde netwerk — bv Simyo/Lebara op KPN heeft 30-50% lager tarief",
      "Combineer thuis+mobiel in één pakket — 10-20% korting bij bundle",
      "Vraag om jaarbetaling-korting (vaak 10% extra)",
    ],
    warningSigns: [
      "Je betaalt meer dan €40/mnd voor mobiel zonder onbeperkte data",
      "Je internet kost meer dan €55/mnd zonder TV-pakket",
      "Je hebt nooit een retentie-aanbod gekregen ondanks 2+ jaar contract",
    ],
    monopolyWarning: false,
    savingsRangeLabel: "15-30%",
  },
  ENERGIE: {
    primary: "ENERGIE",
    icon: "⚡",
    averageSavingsPct: 0.18,
    averageMonthlySpendNl: 14000,
    marketDescription:
      "De EU-energiemarkt is sinds de 2022-crisis zeer volatiel. Variabele tarieven zijn ~30% goedkoper dan vaste " +
      "tarieven in dalende markten, maar bieden geen prijsgarantie. Sinds 2024 mogen leveranciers in NL pas na " +
      "11 maanden vast tarief verhogen — gebruik dit als hefboom bij onderhandeling.",
    howToSave: [
      "Vergelijk vast vs variabel — variabel is goedkoper in dalende markt, vast in stijgende",
      "Vraag prijsgarantie van minimaal 2 jaar bij vast contract",
      "Check de ACM-jaarrapport tarieven (publiek beschikbaar) voor marktmediaan",
      "Combineer stroom+gas — combi-korting van 5-10% gebruikelijk",
      "Vraag terugleververgoeding bij zonnepanelen — wettelijk minimum verschilt per provider",
    ],
    warningSigns: [
      "Je betaalt meer dan €0,30/kWh — markt-mediaan is rond €0,25/kWh (mei 2026)",
      "Je betaalt meer dan €1,20/m³ gas — markt-mediaan is rond €1,05/m³",
      "Je hebt nooit een tariefonderhandeling gevoerd ondanks 3+ jaar bij dezelfde leverancier",
    ],
    monopolyWarning: false,
    savingsRangeLabel: "10-25%",
  },
  VERZEKERING: {
    primary: "VERZEKERING",
    icon: "🛡️",
    averageSavingsPct: 0.28,
    averageMonthlySpendNl: 18000,
    marketDescription:
      "Verzekeringsmarkt heeft hoge oversluit-kosten en lock-in via 'no-claim-korting' opbouw. " +
      "Maar op auto, woon en zorg kun je vaak 20-40% besparen door dekking-review + matching. " +
      "Zorgverzekering: per 1 januari overstap-deadline is dé moment, vergelijken via Zorgwijzer/Independer.",
    howToSave: [
      "Doe een dekking-review: zit je niet oververzekerd? Eigen risico te laag?",
      "Check of je dubbele dekking hebt via werk-collectief (RVB/zorg)",
      "Verzamel 3 concurrent-offertes en vraag jouw verzekeraar om matching",
      "Bundel polissen bij één verzekeraar — 5-10% multi-polis korting",
      "Verhoog eigen risico bij autoverzekering — premie daalt 15-25%",
    ],
    warningSigns: [
      "Je premie is in 2 jaar tijd >20% gestegen zonder claim",
      "Je hebt allrisk op een auto >7 jaar oud (vaak niet meer rendabel)",
      "Je hebt zelfde polis al >5 jaar zonder review",
    ],
    monopolyWarning: false,
    savingsRangeLabel: "20-40%",
  },
  WONEN: {
    primary: "WONEN",
    icon: "🏠",
    averageSavingsPct: 0.08,
    averageMonthlySpendNl: 95000,
    marketDescription:
      "Hypotheek is de grootste maandlast. Bij rentedaling kun je oversluiten of rente-reductie aanvragen " +
      "(vaak goedkoper dan oversluiten). Gemeente-belastingen + waterschap zijn vaste tarieven — onderhandelen " +
      "heeft hier geen effect maar kwijtschelding bij laag inkomen wel.",
    howToSave: [
      "Vraag rente-reductie aan bij je bank — vaak 0,1-0,3% lager mogelijk zonder oversluiten",
      "Bij rentedaling: bereken oversluit-kosten vs maandbesparing (terugverdientijd <3jr → doen)",
      "Check NHG-status — als je >10% afgelost hebt kan NHG vervallen en daalt risicopremie",
      "Voor gemeente-belasting: vraag kwijtschelding bij laag inkomen (minimum bestaan)",
      "VvE-bijdrage: vraag inzage in begroting — bezwaar mogelijk bij onverklaarde stijgingen",
    ],
    warningSigns: [
      "Je rente is >1% hoger dan de huidige markt-mediaan voor jouw rentevaste-periode",
      "Je gemeentebelasting steeg >5% boven CBS-inflatie zonder uitleg",
      "Je hebt nog NHG terwijl restschuld <€200k (premie is dan onnodig)",
    ],
    monopolyWarning: false,
    savingsRangeLabel: "5-15%",
  },
  FINANCIEN: {
    primary: "FINANCIEN",
    icon: "🏦",
    averageSavingsPct: 0.45,
    averageMonthlySpendNl: 350,
    marketDescription:
      "Banken concurreren via abonnementsmodel sinds 2023. Bunq/Knab/Revolut bieden gratis basis-pakketten, " +
      "terwijl ABN/ING/Rabo €2-5/mnd vragen. Op beleggingsfees kun je 50-70% besparen door overstap van " +
      "actieve fondsen naar ETF's (DeGiro/Bux Zero/Trade Republic).",
    howToSave: [
      "Vergelijk pakketkosten — Knab/Bunq Easy zijn gratis (basis-functies)",
      "Vraag fee-waiver bij je bank — als je >€10k spaargeld hebt vaak mogelijk",
      "Overweeg ETF's via DeGiro/Bux Zero ipv actieve beleggingsfondsen (TER 0,15% vs 1,5%)",
      "Sluit overbodige creditcards op — jaarpremie is vaak €30-60",
      "Bij hypotheek bij dezelfde bank: vraag pakket-korting (vaak 50% off)",
    ],
    warningSigns: [
      "Je betaalt >€4/mnd voor basis-betaalpakket zonder extra services",
      "Je beleggingsfees zijn >0,5% TER op een passieve portefeuille",
      "Je hebt creditcards met jaarpremie die je nauwelijks gebruikt",
    ],
    monopolyWarning: false,
    savingsRangeLabel: "30-60%",
  },
  ABONNEMENTEN: {
    primary: "ABONNEMENTEN",
    icon: "📦",
    averageSavingsPct: 0.30,
    averageMonthlySpendNl: 5000,
    marketDescription:
      "Streaming/software/gym abonnementen zijn berucht voor 'silent renewal' en automatische prijsverhoging. " +
      "Een audit van je vaste-lasten levert vaak 25-40% besparing op door te downgraden, family-plans te splitten " +
      "met partners, of overbodige abonnementen op te zeggen.",
    howToSave: [
      "Loop alle abonnementen één voor één na — gebruik je 't laatste 30 dagen?",
      "Downgrade naar 'standard with ads' bij streaming (€5-7 minder)",
      "Splits family-plans met partner/huisgenoten (Spotify Family, Apple One Family)",
      "Software-jaarbetaling levert 20-40% korting tov maandbetaling",
      "Adobe/iCloud geven vaak 30% retentie-korting bij opzeg-poging",
    ],
    warningSigns: [
      "Je betaalt voor abonnementen die je <2x per maand gebruikt",
      "Je hebt overlappende streaming (3+ services voor dezelfde content)",
      "Je software is op maandelijks ipv jaarlijks (~30% duurder)",
    ],
    monopolyWarning: false,
    savingsRangeLabel: "25-50%",
  },
  OVERIG: {
    primary: "OVERIG",
    icon: "📋",
    averageSavingsPct: 0.10,
    averageMonthlySpendNl: 0,
    marketDescription:
      "Catch-all categorie voor uitgaven die niet in een specifieke bucket vallen. Generieke onderhandel-strategieën " +
      "werken hier: langetermijn-korting, jaarbetaling vs maandbetaling, klant-loyaliteit als hefboom.",
    howToSave: [
      "Vraag langetermijn-korting bij contract verlenging",
      "Betaal jaarlijks ipv maandelijks — vaak 10-15% korting",
      "Onderhandel bij contract-einde, niet midden in looptijd",
    ],
    warningSigns: [
      "Je hebt contracten ouder dan 3 jaar zonder ooit te onderhandelen",
    ],
    monopolyWarning: false,
    savingsRangeLabel: "5-15%",
  },
};

export function infoFor(primary: PrimaryCategory): CategoryInfo {
  return CATEGORY_INFO[primary] ?? CATEGORY_INFO.OVERIG;
}

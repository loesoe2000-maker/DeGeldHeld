/**
 * lib/seo-data.ts — content + slugs voor SEO-landing pages.
 *
 * Genereert /onderhandelen-met-{slug} en /{category}-besparen pages.
 * Content is geschreven, niet AI-runtime gegenereerd, om SEO-stabiliteit
 * te waarborgen (Google indexeert beter wat consistent blijft).
 *
 * v24: hypotheek + verzekering zijn AFM-gegate (Wft-producten — we hebben
 * geen vergunning om te adviseren/bemiddelen) en hebben dus GEEN SEO-pagina.
 * In plaats daarvan verbreden we naar categorieën die we wél ondersteunen:
 * telecom, energie, streaming en sportabonnement. Zie lib/market-coverage.ts
 * (UNSUPPORTED_CATEGORIES) voor de single source of truth.
 */

/** Categorieën waarvoor we SEO-pagina's tonen — allemaal supported + negotiable. */
export type SeoCategoryKey = "TELECOM" | "ENERGIE" | "STREAMING" | "GYM";

export type SeoProvider = {
  slug: string;
  name: string;
  category: SeoCategoryKey;
  intro: string;          // 1 zin lead
  averageOverpayEurMonth: number;
  retentionAngle: string; // korte hoek/strategy
};

export const SEO_PROVIDERS: SeoProvider[] = [
  // TELECOM (10)
  { slug: "kpn",            name: "KPN",            category: "TELECOM", intro: "KPN-klanten betalen gemiddeld €8/mnd boven mediaan.", averageOverpayEurMonth: 8, retentionAngle: "retentie-mail met Simyo/Ben/hollandsnieuwe als alternatief" },
  { slug: "vodafone",       name: "Vodafone",       category: "TELECOM", intro: "Vodafone-abonnement met Red-pakket is bijna altijd te verlagen.", averageOverpayEurMonth: 7, retentionAngle: "switch-claim naar Tele2/Odido" },
  { slug: "ziggo",          name: "Ziggo",          category: "TELECOM", intro: "Ziggo internet+tv: €10-15/mnd ruimte na 1e contractjaar.", averageOverpayEurMonth: 11, retentionAngle: "DELTA / Freedom Internet vergelijken" },
  { slug: "t-mobile",       name: "T-Mobile",       category: "TELECOM", intro: "T-Mobile/Odido: pakket-bundeling levert vaak korting.", averageOverpayEurMonth: 6, retentionAngle: "bundel-korting bij thuis+mobiel" },
  { slug: "tele2",          name: "Tele2",          category: "TELECOM", intro: "Tele2 zit standaard hoger dan benchmark.", averageOverpayEurMonth: 5, retentionAngle: "MVNO-overstap dreiging" },
  { slug: "odido",          name: "Odido",          category: "TELECOM", intro: "Odido (ex-T-Mobile): retentie reageert op concrete prijspunt.", averageOverpayEurMonth: 5, retentionAngle: "verwijs naar Simpel/Lebara" },
  { slug: "simyo",          name: "Simyo",          category: "TELECOM", intro: "Simyo is goedkoop, maar abonnement matching is mogelijk.", averageOverpayEurMonth: 3, retentionAngle: "data-matching met andere KPN-MVNO" },
  { slug: "youfone",        name: "Youfone",        category: "TELECOM", intro: "Youfone-klanten kunnen meer data voor zelfde prijs vragen.", averageOverpayEurMonth: 3, retentionAngle: "data-bundel upgrade zonder prijs-stijging" },
  { slug: "hollandsnieuwe", name: "hollandsnieuwe", category: "TELECOM", intro: "hollandsnieuwe: prijs-flex retentie werkt vaak bij 12-mnd verlenging.", averageOverpayEurMonth: 4, retentionAngle: "12-maands korting in ruil voor verlenging" },
  { slug: "lebara",         name: "Lebara",         category: "TELECOM", intro: "Lebara: data-bundel onderhandelen is haalbaar.", averageOverpayEurMonth: 3, retentionAngle: "MVNO concurrentievoordeel" },

  // ENERGIE (8)
  { slug: "eneco",          name: "Eneco",          category: "ENERGIE", intro: "Eneco klanten zitten vaak op een verlopen vast contract met hoog tarief.", averageOverpayEurMonth: 25, retentionAngle: "vast-tarief vergelijking met Vandebron/Frank Energie" },
  { slug: "vattenfall",     name: "Vattenfall",     category: "ENERGIE", intro: "Vattenfall (Nuon) wisselt klanten makkelijk naar variabel — niet altijd voordelig.", averageOverpayEurMonth: 22, retentionAngle: "switch naar Greenchoice / EasyEnergy" },
  { slug: "essent",         name: "Essent",         category: "ENERGIE", intro: "Essent korting blijft bestaand-klant geheim — wij maken het concreet.", averageOverpayEurMonth: 20, retentionAngle: "concrete kWh-prijs benchmark" },
  { slug: "greenchoice",    name: "Greenchoice",    category: "ENERGIE", intro: "Greenchoice is gemiddeld nette prijs, maar vastrecht is hoog.", averageOverpayEurMonth: 8, retentionAngle: "vastrecht-korting onderhandelen" },
  { slug: "vandebron",      name: "Vandebron",      category: "ENERGIE", intro: "Vandebron: groene leverancier, prijs is wel een hoek.", averageOverpayEurMonth: 6, retentionAngle: "switch dreiging naar Pure Energie" },
  { slug: "budget-energie", name: "Budget Energie", category: "ENERGIE", intro: "Budget Energie: variabel kan ineens omhoog springen.", averageOverpayEurMonth: 18, retentionAngle: "vraag vaste prijs lock-in" },
  { slug: "engie",          name: "Engie",          category: "ENERGIE", intro: "Engie heeft historisch hogere tarieven dan markt-mediaan.", averageOverpayEurMonth: 19, retentionAngle: "Eneco / Essent als referentie" },
  { slug: "frank-energie",  name: "Frank Energie",  category: "ENERGIE", intro: "Frank Energie dynamische tarieven kunnen pieken.", averageOverpayEurMonth: 10, retentionAngle: "vastrecht-aftrek bij meer-jarig contract" },

  // STREAMING (8)
  { slug: "netflix",        name: "Netflix",        category: "STREAMING", intro: "Netflix kortingen zijn schaars — maar abonnement-tier omlaag werkt.", averageOverpayEurMonth: 5, retentionAngle: "tier-downgrade ipv opzegging" },
  { slug: "spotify",        name: "Spotify",        category: "STREAMING", intro: "Spotify Family/Duo: vraag of huidige tier nog nodig is.", averageOverpayEurMonth: 4, retentionAngle: "family-bundel onderhandelen" },
  { slug: "disney-plus",    name: "Disney+",        category: "STREAMING", intro: "Disney+ jaarcontract kortingen verschijnen zelden — wel periodiek.", averageOverpayEurMonth: 3, retentionAngle: "jaar-vooruit-betaling korting vragen" },
  { slug: "hbo-max",        name: "HBO Max",        category: "STREAMING", intro: "HBO Max / Max: bundel met telecom-provider levert vaak korting.", averageOverpayEurMonth: 3, retentionAngle: "bundel met telecom" },
  { slug: "videoland",      name: "Videoland",      category: "STREAMING", intro: "Videoland: jaarabonnement is fors goedkoper dan maand-tarief.", averageOverpayEurMonth: 3, retentionAngle: "jaar-tarief ipv maand-tarief" },
  { slug: "viaplay",        name: "Viaplay",        category: "STREAMING", intro: "Viaplay: sport-bundel wordt vaak verlengd zonder te checken of je 'm nog gebruikt.", averageOverpayEurMonth: 5, retentionAngle: "pauzeren buiten het sportseizoen" },
  { slug: "amazon-prime",   name: "Amazon Prime",   category: "STREAMING", intro: "Amazon Prime: jaarbetaling is goedkoper dan twaalf maanden los.", averageOverpayEurMonth: 2, retentionAngle: "jaar-vooruit ipv maand" },
  { slug: "apple-tv",       name: "Apple TV+",      category: "STREAMING", intro: "Apple TV+ zit vaak gratis in een Apple One-bundel die je al hebt.", averageOverpayEurMonth: 3, retentionAngle: "bundel-check Apple One" },

  // GYM / sportabonnement (5)
  { slug: "basic-fit",      name: "Basic-Fit",      category: "GYM", intro: "Basic-Fit: jaarbetaling of een lager lidmaatschap-type scheelt al snel een tientje per maand.", averageOverpayEurMonth: 8, retentionAngle: "downgrade naar Comfort/Basic of jaarbetaling" },
  { slug: "sportcity",      name: "SportCity",      category: "GYM", intro: "SportCity-abonnementen lopen vaak door terwijl je weinig komt.", averageOverpayEurMonth: 10, retentionAngle: "pauze-functie of jaarbetaling-korting" },
  { slug: "fit-for-free",   name: "Fit For Free",   category: "GYM", intro: "Fit For Free: vraag of het all-in tarief past bij hoe vaak je sport.", averageOverpayEurMonth: 7, retentionAngle: "type-downgrade naar basis-tarief" },
  { slug: "anytime-fitness", name: "Anytime Fitness", category: "GYM", intro: "Anytime Fitness: jaarcontract heeft vaak een prepay-korting die je moet vragen.", averageOverpayEurMonth: 9, retentionAngle: "jaarbetaling-korting opvragen" },
  { slug: "trainmore",      name: "TrainMore",      category: "GYM", intro: "TrainMore: maand-flexibel tarief is duurder dan een 12-maands toezegging.", averageOverpayEurMonth: 8, retentionAngle: "12-maands toezegging in ruil voor lager tarief" },
];

export type SeoCategory = {
  slug: string;
  label: string;
  category: SeoCategoryKey;
  averageYearlySaving: number;
  topProviders: string[];
};

export const SEO_CATEGORIES: SeoCategory[] = [
  { slug: "telecom",   label: "telecom",   category: "TELECOM",   averageYearlySaving: 96,  topProviders: ["KPN", "Vodafone", "Ziggo", "T-Mobile"] },
  { slug: "energie",   label: "energie",   category: "ENERGIE",   averageYearlySaving: 480, topProviders: ["Eneco", "Vattenfall", "Essent", "Greenchoice"] },
  { slug: "streaming", label: "streaming", category: "STREAMING", averageYearlySaving: 60,  topProviders: ["Netflix", "Spotify", "Disney+", "Videoland"] },
  { slug: "sportschool", label: "sportschool", category: "GYM",   averageYearlySaving: 108, topProviders: ["Basic-Fit", "SportCity", "Fit For Free", "Anytime Fitness"] },
];

export function findProviderSlug(slug: string): SeoProvider | undefined {
  return SEO_PROVIDERS.find((p) => p.slug === slug);
}
export function findCategorySlug(slug: string): SeoCategory | undefined {
  return SEO_CATEGORIES.find((c) => c.slug === slug);
}

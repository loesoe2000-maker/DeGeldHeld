/**
 * lib/seo-data.ts — content + slugs voor SEO-landing pages.
 *
 * Genereert /onderhandelen-met-{slug} en /{category}-besparen pages.
 * Content is geschreven, niet AI-runtime gegenereerd, om SEO-stabiliteit
 * te waarborgen (Google indexeert beter wat consistent blijft).
 */

export type SeoProvider = {
  slug: string;
  name: string;
  category: "TELECOM" | "ENERGIE" | "VERZEKERING" | "HYPOTHEEK" | "STREAMING";
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

  // VERZEKERING (6)
  { slug: "centraal-beheer",        name: "Centraal Beheer",        category: "VERZEKERING", intro: "Centraal Beheer: stabiele klantenservice, premies wel onderhandelbaar.", averageOverpayEurMonth: 5, retentionAngle: "Inshared / Promovendum offerte als hefboom" },
  { slug: "fbto",                   name: "FBTO",                   category: "VERZEKERING", intro: "FBTO modulair: pakket-keuze geeft ruimte voor besparen.", averageOverpayEurMonth: 4, retentionAngle: "dekking-downgrade voorstellen" },
  { slug: "anwb-verzekeringen",     name: "ANWB Verzekeringen",     category: "VERZEKERING", intro: "ANWB lid? Korting is meestal aanwezig — maar niet maximaal.", averageOverpayEurMonth: 6, retentionAngle: "lidmaatschap-bonus opvragen" },
  { slug: "univ",                   name: "Univé",                  category: "VERZEKERING", intro: "Univé regio-coöperatie: prijs verschilt sterk per polis.", averageOverpayEurMonth: 7, retentionAngle: "regio-benchmark vergelijken" },
  { slug: "inshared",               name: "InShared",               category: "VERZEKERING", intro: "InShared: dividend-model — vraag naar uitkering-cijfers.", averageOverpayEurMonth: 3, retentionAngle: "service-niveau check" },
  { slug: "nationale-nederlanden",  name: "Nationale-Nederlanden",  category: "VERZEKERING", intro: "NN: vaak premie-leider in midden-markt.", averageOverpayEurMonth: 6, retentionAngle: "Aegon / ASR offerte als referentie" },

  // STREAMING + extra (6)
  { slug: "netflix",        name: "Netflix",        category: "STREAMING", intro: "Netflix kortingen zijn schaars — maar abonnement-tier omlaag werkt.", averageOverpayEurMonth: 5, retentionAngle: "tier-downgrade ipv opzegging" },
  { slug: "spotify",        name: "Spotify",        category: "STREAMING", intro: "Spotify Family/Duo: vraag of huidige tier nog nodig is.", averageOverpayEurMonth: 4, retentionAngle: "family-bundel onderhandelen" },
  { slug: "disney-plus",    name: "Disney+",        category: "STREAMING", intro: "Disney+ jaarcontract kortingen verschijnen zelden — wel periodiek.", averageOverpayEurMonth: 3, retentionAngle: "jaar-vooruit-betaling korting vragen" },
  { slug: "hbo-max",        name: "HBO Max",        category: "STREAMING", intro: "HBO Max / Max: bundel met telecom-provider levert vaak korting.", averageOverpayEurMonth: 3, retentionAngle: "bundel met telecom" },

  // HYPOTHEEK (4)
  { slug: "ing-hypotheken",     name: "ING Hypotheken",     category: "HYPOTHEEK", intro: "ING klant met >3,5% rente: oversluiten kan €100+/mnd schelen.", averageOverpayEurMonth: 90, retentionAngle: "concrete offerte van Aegon / Florius" },
  { slug: "rabobank-hypotheek", name: "Rabobank Hypotheek", category: "HYPOTHEEK", intro: "Rabobank rentes zitten vaak boven markt-mediaan.", averageOverpayEurMonth: 85, retentionAngle: "ABN AMRO / Munt offerte ter vergelijking" },
  { slug: "abn-amro-hypotheek", name: "ABN AMRO Hypotheek", category: "HYPOTHEEK", intro: "ABN AMRO: rentevaste-periode aanpassing biedt soms ruimte.", averageOverpayEurMonth: 80, retentionAngle: "rentevaste-periode herzien" },
  { slug: "aegon-hypotheek",    name: "Aegon Hypotheek",    category: "HYPOTHEEK", intro: "Aegon hypotheken: oversluit-mogelijkheden hangen sterk af van looptijd.", averageOverpayEurMonth: 70, retentionAngle: "renteherziening op natuurlijk moment" },
];

export type SeoCategory = {
  slug: string;
  label: string;
  category: "TELECOM" | "ENERGIE" | "VERZEKERING" | "HYPOTHEEK";
  averageYearlySaving: number;
  topProviders: string[];
};

export const SEO_CATEGORIES: SeoCategory[] = [
  { slug: "telecom",      label: "telecom",      category: "TELECOM",      averageYearlySaving: 96,  topProviders: ["KPN", "Vodafone", "Ziggo", "T-Mobile"] },
  { slug: "energie",      label: "energie",      category: "ENERGIE",      averageYearlySaving: 480, topProviders: ["Eneco", "Vattenfall", "Essent", "Greenchoice"] },
  { slug: "verzekering",  label: "verzekering",  category: "VERZEKERING",  averageYearlySaving: 168, topProviders: ["Centraal Beheer", "FBTO", "ANWB", "Univé"] },
  { slug: "hypotheek",    label: "hypotheek",    category: "HYPOTHEEK",    averageYearlySaving: 1080, topProviders: ["ING", "Rabobank", "ABN AMRO", "Aegon"] },
];

export function findProviderSlug(slug: string): SeoProvider | undefined {
  return SEO_PROVIDERS.find((p) => p.slug === slug);
}
export function findCategorySlug(slug: string): SeoCategory | undefined {
  return SEO_CATEGORIES.find((c) => c.slug === slug);
}

/**
 * Canonical NL/EU provider registry — used by OCR matching, comparison,
 * and seed scripts.
 *
 * v3: uitgebreid van ~17 → 150+ providers met aliases voor robuuste OCR-matching.
 * Per provider: canonical naam + aliases (lowercase substrings die OCR kan extracten)
 * + region (NL / EU / GLOBAL) voor toekomstige geo-targeting.
 */

export type Category =
  | "TELECOM"
  | "ENERGIE"
  | "VERZEKERING"
  | "HYPOTHEEK"
  | "BANK"
  | "ABONNEMENT"
  | "OVERIG";

export type Region = "NL" | "EU" | "GLOBAL";

/**
 * NL mobiele netwerk-eigenaars: KPN, Vodafone, Odido (de oude T-Mobile NL).
 * MVNOs draaien op één van deze 3. null = eigen netwerk (geen MVNO).
 * Alleen relevant voor TELECOM (mobiel) — andere categorieën: undefined.
 */
export type MobileNetwork = "KPN" | "Vodafone" | "Odido" | null;

export type ProviderRecord = {
  canonical: string;
  category: Category;
  region: Region;
  aliases: string[];
  /** Voor NL mobiele providers: onderliggend netwerk. null = eigen netwerk.
   *  undefined voor non-telecom of internet/TV providers. */
  network?: MobileNetwork;
};

export const NL_PROVIDERS: ProviderRecord[] = [
  // ===== TELECOM NL — mobiel =====
  // T-Mobile NL = Odido na rebrand 2023; we houden T-Mobile als legacy entry,
  // network = Odido zodat oude facturen correct gelabeld worden.
  { canonical: "T-Mobile", category: "TELECOM", region: "NL", aliases: ["t-mobile", "tmobile", "t mobile"], network: "Odido" },
  { canonical: "KPN", category: "TELECOM", region: "NL", aliases: ["kpn", "k.p.n."], network: null },
  { canonical: "Vodafone", category: "TELECOM", region: "NL", aliases: ["vodafone"], network: null },
  // Tele2: gefuseerd met T-Mobile/Odido sinds 2019 → draait nu op Odido-netwerk.
  { canonical: "Tele2", category: "TELECOM", region: "NL", aliases: ["tele2", "tele 2"], network: "Odido" },
  { canonical: "Odido", category: "TELECOM", region: "NL", aliases: ["odido"], network: null },
  // MVNOs op KPN-netwerk
  { canonical: "Youfone", category: "TELECOM", region: "NL", aliases: ["youfone", "you fone"], network: "KPN" },
  // Ben Mobiel: dochtermerk van Odido — draait op Odido-netwerk.
  { canonical: "Ben", category: "TELECOM", region: "NL", aliases: ["ben mobiel", "ben.nl", "ben telecom"], network: "Odido" },
  // Hollandsnieuwe: KPN-merk → KPN-netwerk.
  { canonical: "Hollandsnieuwe", category: "TELECOM", region: "NL", aliases: ["hollandsnieuwe", "hollands nieuwe"], network: "KPN" },
  // Simpel: Odido-merk → Odido-netwerk.
  { canonical: "Simpel", category: "TELECOM", region: "NL", aliases: ["simpel.nl", "simpel mobiel"], network: "Odido" },
  { canonical: "Lebara", category: "TELECOM", region: "NL", aliases: ["lebara"], network: "KPN" },
  { canonical: "Lyca Mobile", category: "TELECOM", region: "NL", aliases: ["lyca", "lycamobile", "lyca mobile"], network: "KPN" },
  { canonical: "Simyo", category: "TELECOM", region: "NL", aliases: ["simyo"], network: "KPN" },
  { canonical: "Budget Mobiel", category: "TELECOM", region: "NL", aliases: ["budget mobiel", "budgetmobiel"], network: "KPN" },
  { canonical: "Robin Mobile", category: "TELECOM", region: "NL", aliases: ["robin mobile", "robinmobile"], network: "KPN" },
  // Aldi Talk NL: KPN-MVNO (verkocht via Aldi-supermarkten).
  { canonical: "Aldi Talk", category: "TELECOM", region: "NL", aliases: ["aldi talk", "alditalk"], network: "KPN" },
  // Telfort: legacy KPN-merk (verkoop gestaakt 2020, bestaande klanten lopen door).
  { canonical: "Telfort", category: "TELECOM", region: "NL", aliases: ["telfort"], network: "KPN" },

  // ===== TELECOM NL — internet/TV =====
  { canonical: "Ziggo", category: "TELECOM", region: "NL", aliases: ["ziggo"] },
  { canonical: "Online.nl", category: "TELECOM", region: "NL", aliases: ["online.nl", "online nl"] },
  { canonical: "Caiway", category: "TELECOM", region: "NL", aliases: ["caiway"] },
  { canonical: "Delta", category: "TELECOM", region: "NL", aliases: ["delta fiber", "delta internet"] },
  { canonical: "Freedom Internet", category: "TELECOM", region: "NL", aliases: ["freedom internet", "freedom.nl"] },

  // ===== ENERGIE NL =====
  { canonical: "Eneco", category: "ENERGIE", region: "NL", aliases: ["eneco"] },
  { canonical: "Vattenfall", category: "ENERGIE", region: "NL", aliases: ["vattenfall", "nuon"] },
  { canonical: "Essent", category: "ENERGIE", region: "NL", aliases: ["essent"] },
  { canonical: "Greenchoice", category: "ENERGIE", region: "NL", aliases: ["greenchoice", "green choice"] },
  { canonical: "Vandebron", category: "ENERGIE", region: "NL", aliases: ["vandebron", "van de bron"] },
  { canonical: "Pure Energie", category: "ENERGIE", region: "NL", aliases: ["pure energie", "pureenergie"] },
  { canonical: "Engie", category: "ENERGIE", region: "NL", aliases: ["engie"] },
  { canonical: "Budget Energie", category: "ENERGIE", region: "NL", aliases: ["budget energie", "budgetenergie"] },
  { canonical: "Frank Energie", category: "ENERGIE", region: "NL", aliases: ["frank energie", "frankenergie"] },
  { canonical: "EasyEnergy", category: "ENERGIE", region: "NL", aliases: ["easyenergy", "easy energy"] },
  { canonical: "Oxxio", category: "ENERGIE", region: "NL", aliases: ["oxxio"] },
  { canonical: "Energiedirect", category: "ENERGIE", region: "NL", aliases: ["energiedirect", "energie direct"] },
  { canonical: "ANWB Energie", category: "ENERGIE", region: "NL", aliases: ["anwb energie"] },
  { canonical: "Coolblue Energie", category: "ENERGIE", region: "NL", aliases: ["coolblue energie", "coolblue stroom"] },
  { canonical: "DGB Energie", category: "ENERGIE", region: "NL", aliases: ["dgb energie", "dgb"] },

  // ===== VERZEKERING NL — auto/woon =====
  { canonical: "Centraal Beheer", category: "VERZEKERING", region: "NL", aliases: ["centraal beheer", "centraalbeheer"] },
  { canonical: "ANWB Verzekeringen", category: "VERZEKERING", region: "NL", aliases: ["anwb verzekering", "anwb verzekeringen"] },
  { canonical: "FBTO", category: "VERZEKERING", region: "NL", aliases: ["fbto"] },
  { canonical: "InShared", category: "VERZEKERING", region: "NL", aliases: ["inshared", "in shared"] },
  { canonical: "Allianz", category: "VERZEKERING", region: "NL", aliases: ["allianz"] },
  { canonical: "Nationale-Nederlanden", category: "VERZEKERING", region: "NL", aliases: ["nationale-nederlanden", "nationale nederlanden", "nn group"] },
  { canonical: "Univé", category: "VERZEKERING", region: "NL", aliases: ["unive", "univé"] },
  { canonical: "ASR", category: "VERZEKERING", region: "NL", aliases: ["a.s.r.", "asr verzekeringen"] },
  { canonical: "Aegon", category: "VERZEKERING", region: "NL", aliases: ["aegon"] },
  { canonical: "Achmea", category: "VERZEKERING", region: "NL", aliases: ["achmea"] },
  { canonical: "Interpolis", category: "VERZEKERING", region: "NL", aliases: ["interpolis"] },
  { canonical: "Ditzo", category: "VERZEKERING", region: "NL", aliases: ["ditzo"] },
  { canonical: "OHRA", category: "VERZEKERING", region: "NL", aliases: ["ohra"] },
  { canonical: "Promovendum", category: "VERZEKERING", region: "NL", aliases: ["promovendum"] },
  { canonical: "Reaal", category: "VERZEKERING", region: "NL", aliases: ["reaal"] },
  { canonical: "Goudse", category: "VERZEKERING", region: "NL", aliases: ["goudse", "de goudse"] },

  // ===== VERZEKERING NL — zorg =====
  { canonical: "Zilveren Kruis", category: "VERZEKERING", region: "NL", aliases: ["zilveren kruis", "zilverenkruis"] },
  { canonical: "VGZ", category: "VERZEKERING", region: "NL", aliases: ["vgz"] },
  { canonical: "CZ", category: "VERZEKERING", region: "NL", aliases: ["cz zorgverzekering", "c.z."] },
  { canonical: "Menzis", category: "VERZEKERING", region: "NL", aliases: ["menzis"] },
  { canonical: "DSW", category: "VERZEKERING", region: "NL", aliases: ["dsw zorgverzekering"] },
  { canonical: "ONVZ", category: "VERZEKERING", region: "NL", aliases: ["onvz"] },
  { canonical: "Salland", category: "VERZEKERING", region: "NL", aliases: ["salland zorgverzekering"] },

  // ===== BANK NL =====
  { canonical: "ABN AMRO", category: "BANK", region: "NL", aliases: ["abn amro", "abnamro"] },
  { canonical: "ING", category: "BANK", region: "NL", aliases: ["ing bank"] },
  { canonical: "Rabobank", category: "BANK", region: "NL", aliases: ["rabobank", "rabo bank"] },
  { canonical: "SNS", category: "BANK", region: "NL", aliases: ["sns bank", "sns.nl"] },
  { canonical: "Knab", category: "BANK", region: "NL", aliases: ["knab"] },
  { canonical: "Bunq", category: "BANK", region: "NL", aliases: ["bunq"] },
  { canonical: "ASN Bank", category: "BANK", region: "NL", aliases: ["asn bank", "asnbank"] },
  { canonical: "Triodos", category: "BANK", region: "NL", aliases: ["triodos"] },
  { canonical: "Revolut", category: "BANK", region: "EU", aliases: ["revolut"] },
  { canonical: "N26", category: "BANK", region: "EU", aliases: ["n26"] },

  // ===== HYPOTHEEK NL =====
  { canonical: "ABN AMRO Hypotheken", category: "HYPOTHEEK", region: "NL", aliases: ["abn amro hypotheek", "abn hypotheek"] },
  { canonical: "ING Hypotheken", category: "HYPOTHEEK", region: "NL", aliases: ["ing hypotheek"] },
  { canonical: "Rabo Hypotheken", category: "HYPOTHEEK", region: "NL", aliases: ["rabobank hypotheek", "rabo hypotheek"] },
  { canonical: "Aegon Hypotheken", category: "HYPOTHEEK", region: "NL", aliases: ["aegon hypotheek"] },
  { canonical: "Munt Hypotheken", category: "HYPOTHEEK", region: "NL", aliases: ["munt hypotheken", "munt hypotheek"] },
  { canonical: "Argenta", category: "HYPOTHEEK", region: "NL", aliases: ["argenta"] },
  { canonical: "Florius", category: "HYPOTHEEK", region: "NL", aliases: ["florius"] },
  { canonical: "Obvion", category: "HYPOTHEEK", region: "NL", aliases: ["obvion"] },
  { canonical: "BLG Wonen", category: "HYPOTHEEK", region: "NL", aliases: ["blg wonen"] },
  { canonical: "Lloyds NL", category: "HYPOTHEEK", region: "NL", aliases: ["lloyds bank nl"] },
  { canonical: "Tulp Hypotheken", category: "HYPOTHEEK", region: "NL", aliases: ["tulp hypotheken", "tulphypotheken"] },
  { canonical: "Centraal Beheer Hypotheek", category: "HYPOTHEEK", region: "NL", aliases: ["centraal beheer hypotheek"] },

  // ===== ABONNEMENT — streaming =====
  { canonical: "Netflix", category: "ABONNEMENT", region: "GLOBAL", aliases: ["netflix"] },
  { canonical: "Disney+", category: "ABONNEMENT", region: "GLOBAL", aliases: ["disney+", "disneyplus", "disney plus"] },
  { canonical: "HBO Max", category: "ABONNEMENT", region: "GLOBAL", aliases: ["hbo max", "hbomax"] },
  { canonical: "Apple TV+", category: "ABONNEMENT", region: "GLOBAL", aliases: ["apple tv+", "apple tv plus", "appletv"] },
  { canonical: "Amazon Prime Video", category: "ABONNEMENT", region: "GLOBAL", aliases: ["prime video", "amazon prime"] },
  { canonical: "Videoland", category: "ABONNEMENT", region: "NL", aliases: ["videoland"] },
  { canonical: "Spotify", category: "ABONNEMENT", region: "GLOBAL", aliases: ["spotify"] },
  { canonical: "Apple Music", category: "ABONNEMENT", region: "GLOBAL", aliases: ["apple music"] },
  { canonical: "YouTube Premium", category: "ABONNEMENT", region: "GLOBAL", aliases: ["youtube premium", "youtube music"] },
  { canonical: "Tidal", category: "ABONNEMENT", region: "GLOBAL", aliases: ["tidal"] },
  { canonical: "Deezer", category: "ABONNEMENT", region: "EU", aliases: ["deezer"] },
  { canonical: "ESPN+", category: "ABONNEMENT", region: "NL", aliases: ["espn+", "espn plus"] },
  { canonical: "Ziggo Sport", category: "ABONNEMENT", region: "NL", aliases: ["ziggo sport"] },
  { canonical: "Viaplay", category: "ABONNEMENT", region: "EU", aliases: ["viaplay"] },
  { canonical: "Storytel", category: "ABONNEMENT", region: "EU", aliases: ["storytel"] },
  { canonical: "Audible", category: "ABONNEMENT", region: "GLOBAL", aliases: ["audible"] },

  // ===== ABONNEMENT — software/cloud =====
  { canonical: "Microsoft 365", category: "ABONNEMENT", region: "GLOBAL", aliases: ["microsoft 365", "office 365", "ms 365"] },
  { canonical: "Adobe Creative Cloud", category: "ABONNEMENT", region: "GLOBAL", aliases: ["adobe creative cloud", "adobe cc", "creative cloud"] },
  { canonical: "iCloud+", category: "ABONNEMENT", region: "GLOBAL", aliases: ["icloud+", "icloud plus", "icloud storage"] },
  { canonical: "Google One", category: "ABONNEMENT", region: "GLOBAL", aliases: ["google one"] },
  { canonical: "Dropbox", category: "ABONNEMENT", region: "GLOBAL", aliases: ["dropbox plus", "dropbox pro"] },
  { canonical: "ChatGPT Plus", category: "ABONNEMENT", region: "GLOBAL", aliases: ["chatgpt plus", "openai plus"] },
  { canonical: "GitHub Pro", category: "ABONNEMENT", region: "GLOBAL", aliases: ["github copilot", "github pro"] },
  { canonical: "Notion", category: "ABONNEMENT", region: "GLOBAL", aliases: ["notion plus", "notion pro"] },

  // ===== ABONNEMENT — sport / fitness =====
  { canonical: "Basic-Fit", category: "ABONNEMENT", region: "EU", aliases: ["basic-fit", "basicfit", "basic fit"] },
  { canonical: "SportCity", category: "ABONNEMENT", region: "NL", aliases: ["sportcity", "sport city"] },
  { canonical: "Anytime Fitness", category: "ABONNEMENT", region: "GLOBAL", aliases: ["anytime fitness"] },
  { canonical: "Fit For Free", category: "ABONNEMENT", region: "NL", aliases: ["fit for free"] },

  // ===== EU TELECOM =====
  { canonical: "Orange", category: "TELECOM", region: "EU", aliases: ["orange fr", "orange.fr"] },
  { canonical: "Deutsche Telekom", category: "TELECOM", region: "EU", aliases: ["deutsche telekom", "telekom de", "t-mobile de"] },
  { canonical: "O2", category: "TELECOM", region: "EU", aliases: ["o2 de", "o2 uk", "telefonica o2"] },
  { canonical: "Three", category: "TELECOM", region: "EU", aliases: ["three uk", "3 mobile", "three.co.uk"] },
  { canonical: "EE", category: "TELECOM", region: "EU", aliases: ["ee mobile", "ee uk"] },
  { canonical: "BT", category: "TELECOM", region: "EU", aliases: ["bt broadband", "bt uk"] },
  { canonical: "Sky", category: "TELECOM", region: "EU", aliases: ["sky tv", "sky uk", "sky de"] },
  { canonical: "Vodafone DE", category: "TELECOM", region: "EU", aliases: ["vodafone de", "vodafone deutschland"] },
  { canonical: "1&1", category: "TELECOM", region: "EU", aliases: ["1&1", "1und1", "1 und 1"] },
  { canonical: "Bouygues Telecom", category: "TELECOM", region: "EU", aliases: ["bouygues", "bouygues telecom"] },
  { canonical: "SFR", category: "TELECOM", region: "EU", aliases: ["sfr"] },
  { canonical: "Free Mobile", category: "TELECOM", region: "EU", aliases: ["free mobile", "free.fr"] },
  { canonical: "Movistar", category: "TELECOM", region: "EU", aliases: ["movistar"] },
  { canonical: "TIM", category: "TELECOM", region: "EU", aliases: ["tim italia", "telecom italia"] },
  { canonical: "Proximus", category: "TELECOM", region: "EU", aliases: ["proximus"] },
  { canonical: "Telenet", category: "TELECOM", region: "EU", aliases: ["telenet"] },
  { canonical: "Base", category: "TELECOM", region: "EU", aliases: ["base mobile"] },

  // ===== EU ENERGIE =====
  { canonical: "E.ON", category: "ENERGIE", region: "EU", aliases: ["e.on", "eon energie"] },
  { canonical: "RWE", category: "ENERGIE", region: "EU", aliases: ["rwe"] },
  { canonical: "EDF", category: "ENERGIE", region: "EU", aliases: ["edf", "electricite de france"] },
  { canonical: "Enel", category: "ENERGIE", region: "EU", aliases: ["enel"] },
  { canonical: "Engie FR", category: "ENERGIE", region: "EU", aliases: ["engie france", "gdf suez"] },
  { canonical: "Iberdrola", category: "ENERGIE", region: "EU", aliases: ["iberdrola"] },
  { canonical: "TotalEnergies", category: "ENERGIE", region: "EU", aliases: ["totalenergies", "total energies"] },
  { canonical: "Endesa", category: "ENERGIE", region: "EU", aliases: ["endesa"] },
  { canonical: "British Gas", category: "ENERGIE", region: "EU", aliases: ["british gas"] },
  { canonical: "Octopus Energy", category: "ENERGIE", region: "EU", aliases: ["octopus energy"] },
  { canonical: "EWE", category: "ENERGIE", region: "EU", aliases: ["ewe energie"] },
  { canonical: "Yello Strom", category: "ENERGIE", region: "EU", aliases: ["yello strom", "yello"] },

  // ===== EU VERZEKERING =====
  { canonical: "AXA", category: "VERZEKERING", region: "EU", aliases: ["axa"] },
  { canonical: "Generali", category: "VERZEKERING", region: "EU", aliases: ["generali"] },
  { canonical: "AIG", category: "VERZEKERING", region: "EU", aliases: ["aig insurance"] },
  { canonical: "Zurich", category: "VERZEKERING", region: "EU", aliases: ["zurich verzekering", "zurich insurance"] },
  { canonical: "HUK24", category: "VERZEKERING", region: "EU", aliases: ["huk24", "huk-coburg"] },
  { canonical: "Admiral", category: "VERZEKERING", region: "EU", aliases: ["admiral insurance"] },

  // ===== EU BANK =====
  { canonical: "Deutsche Bank", category: "BANK", region: "EU", aliases: ["deutsche bank"] },
  { canonical: "Commerzbank", category: "BANK", region: "EU", aliases: ["commerzbank"] },
  { canonical: "BNP Paribas", category: "BANK", region: "EU", aliases: ["bnp paribas"] },
  { canonical: "Société Générale", category: "BANK", region: "EU", aliases: ["societe generale", "société générale"] },
  { canonical: "Santander", category: "BANK", region: "EU", aliases: ["santander"] },
  { canonical: "BBVA", category: "BANK", region: "EU", aliases: ["bbva"] },
  { canonical: "Barclays", category: "BANK", region: "EU", aliases: ["barclays"] },
  { canonical: "HSBC", category: "BANK", region: "EU", aliases: ["hsbc"] },
  { canonical: "Lloyds Bank", category: "BANK", region: "EU", aliases: ["lloyds bank"] },

  // ===== OVERIG nutsbedrijven / post =====
  { canonical: "Vitens", category: "OVERIG", region: "NL", aliases: ["vitens"] },
  { canonical: "Brabant Water", category: "OVERIG", region: "NL", aliases: ["brabant water"] },
  { canonical: "PWN", category: "OVERIG", region: "NL", aliases: ["pwn waterleiding", "pwn drinkwater"] },
  { canonical: "Evides", category: "OVERIG", region: "NL", aliases: ["evides"] },
  { canonical: "Dunea", category: "OVERIG", region: "NL", aliases: ["dunea"] },
  { canonical: "Waternet", category: "OVERIG", region: "NL", aliases: ["waternet"] },
  { canonical: "PostNL", category: "OVERIG", region: "NL", aliases: ["postnl", "post nl"] },
  { canonical: "DPD", category: "OVERIG", region: "EU", aliases: ["dpd"] },
];

/**
 * Find provider by free-text input. Strategy:
 *  1. Exact canonical name match (case-insensitive).
 *  2. Alias substring match — longest alias wins to avoid false positives
 *     (e.g. "centraal beheer hypotheek" beats "centraal beheer").
 */
export function findProvider(input: string): ProviderRecord | null {
  if (!input) return null;
  const norm = input.toLowerCase().trim();
  for (const p of NL_PROVIDERS) {
    if (p.canonical.toLowerCase() === norm) return p;
  }
  // Build (provider, alias, length) tuples and sort by alias length desc
  const matches: { p: ProviderRecord; aliasLen: number }[] = [];
  for (const p of NL_PROVIDERS) {
    for (const a of p.aliases) {
      if (norm.includes(a)) matches.push({ p, aliasLen: a.length });
    }
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.aliasLen - a.aliasLen);
  return matches[0].p;
}

export function listProvidersByCategory(cat: Category): ProviderRecord[] {
  return NL_PROVIDERS.filter((p) => p.category === cat);
}

export function listProvidersByRegion(region: Region): ProviderRecord[] {
  return NL_PROVIDERS.filter((p) => p.region === region);
}

export function allCategories(): Category[] {
  return ["TELECOM", "ENERGIE", "VERZEKERING", "HYPOTHEEK", "BANK", "ABONNEMENT", "OVERIG"];
}

export function totalProviderCount(): number {
  return NL_PROVIDERS.length;
}

/**
 * Voor een NL mobiele provider: retourneert het onderliggende netwerk
 * ("KPN" | "Vodafone" | "Odido") of null als het de provider zelf is.
 * Undefined als de provider geen NL telecom-mobiel is (internet/TV, energie etc).
 */
export function getProviderNetwork(canonical: string): MobileNetwork | undefined {
  const p = NL_PROVIDERS.find((x) => x.canonical.toLowerCase() === canonical.toLowerCase());
  if (!p || p.category !== "TELECOM" || p.region !== "NL") return undefined;
  return p.network ?? null;
}

/**
 * Korte label voor UI: "eigen netwerk", "MVNO op KPN-netwerk", etc.
 * Returns null voor non-mobile providers (geen label tonen).
 */
export function describeNetwork(canonical: string): string | null {
  const network = getProviderNetwork(canonical);
  if (network === undefined) return null;
  if (network === null) return "eigen netwerk";
  return `MVNO op ${network}-netwerk`;
}

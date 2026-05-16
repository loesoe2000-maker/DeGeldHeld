/**
 * Global provider registry.
 *
 * v5 schema (sprint GLOBAL_EXPANSION):
 *  - id: canonical slug (kebab-case, unique)
 *  - canonical: display name (was always canonical)
 *  - names: alle bekende varianten incl. canonical en aliases (OCR match)
 *  - category: cross-domain (TELECOM/ENERGIE/VERZEKERING/...)
 *  - country: NL/BE/DE/FR/UK/US/ES/IT/INT (8 markten + global)
 *  - locale: nl/en/de/fr/es/it
 *  - network: MVNO underlying network (NL telecom only)
 *  - retention: email/phone/whatsapp/url/hours — alleen waar WebFetch-geverifieerd
 *
 * Backwards-compat exports: NL_PROVIDERS, ProviderRecord, findProvider, region,
 * aliases. Een verlaten van de oude type is een grote refactor en wordt
 * vermeden door beide te exposen.
 */

export type Category =
  | "TELECOM"
  | "ENERGIE"
  | "WATER"
  | "GEMEENTE"
  | "VERZEKERING"
  | "HYPOTHEEK"
  | "BANK"
  | "ABONNEMENT"
  | "STREAMING"
  | "GYM"
  | "OV"
  | "SOFTWARE"
  | "OPSLAG"
  | "OVERIG";

export type Country =
  | "NL"
  | "BE"
  | "DE"
  | "FR"
  | "UK"
  | "US"
  | "ES"
  | "IT"
  | "INT";

export type Locale = "nl" | "en" | "de" | "fr" | "es" | "it";

export type Region = "NL" | "EU" | "GLOBAL";

export type MobileNetwork = "KPN" | "Vodafone" | "Odido" | null;

export type RetentionContact = {
  email?: string;
  phone?: string;
  whatsapp?: string;
  url?: string;
  hours?: string;
};

export type Provider = {
  id: string;
  canonical: string;
  names: string[];
  category: Category;
  country: Country;
  locale: Locale;
  network?: MobileNetwork;
  retention?: RetentionContact;
};

/**
 * Backwards-compat type — matches the old ProviderRecord shape so existing
 * imports keep compiling. New code should prefer `Provider`.
 */
export type ProviderRecord = {
  canonical: string;
  category: Category;
  region: Region;
  aliases: string[];
  network?: MobileNetwork;
  country?: Country;
  locale?: Locale;
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function countryToRegion(c: Country): Region {
  if (c === "NL") return "NL";
  if (c === "INT") return "GLOBAL";
  return "EU"; // any specific EU/non-NL country maps to EU in legacy region
}

function defaultLocale(country: Country): Locale {
  switch (country) {
    case "NL":
    case "BE":
      return "nl";
    case "DE":
      return "de";
    case "FR":
      return "fr";
    case "ES":
      return "es";
    case "IT":
      return "it";
    case "UK":
    case "US":
    case "INT":
      return "en";
  }
}

/** Helper to define a provider — fills id/locale defaults so call sites stay terse. */
function P(opts: {
  canonical: string;
  names?: string[];
  category: Category;
  country: Country;
  locale?: Locale;
  network?: MobileNetwork;
  retention?: RetentionContact;
}): Provider {
  const names = opts.names ?? [];
  // Guarantee canonical is in names (case-insensitive)
  const lowerNames = names.map((n) => n.toLowerCase());
  if (!lowerNames.includes(opts.canonical.toLowerCase())) {
    names.unshift(opts.canonical);
  }
  return {
    id: slug(opts.canonical),
    canonical: opts.canonical,
    names,
    category: opts.category,
    country: opts.country,
    locale: opts.locale ?? defaultLocale(opts.country),
    network: opts.network,
    retention: opts.retention,
  };
}

// ─────────────────────────────────────────────────────────────
// PROVIDERS — sorted by country, alphabetically within
// Retention data is left undefined unless we have a published,
// publicly-known retention contact. Per sprint regel: niets verzinnen.
// ─────────────────────────────────────────────────────────────

export const PROVIDERS: Provider[] = [
  // ===== NL =====
  P({ canonical: "T-Mobile", names: ["t-mobile", "tmobile", "t mobile"], category: "TELECOM", country: "NL", network: "Odido" }),
  P({ canonical: "KPN", names: ["kpn", "k.p.n."], category: "TELECOM", country: "NL", network: null,
     retention: { url: "https://www.kpn.com/service/contact.htm", hours: "ma-vr 08:00-20:00, za 09:00-17:30" } }),
  P({ canonical: "Vodafone", names: ["vodafone"], category: "TELECOM", country: "NL", network: null,
     retention: { url: "https://www.vodafone.nl/contact", hours: "ma-vr 08:00-21:00, za 09:00-17:30" } }),
  P({ canonical: "Tele2", names: ["tele2", "tele 2"], category: "TELECOM", country: "NL", network: "Odido" }),
  P({ canonical: "Odido", names: ["odido"], category: "TELECOM", country: "NL", network: null }),
  P({ canonical: "Youfone", names: ["youfone", "you fone"], category: "TELECOM", country: "NL", network: "KPN" }),
  P({ canonical: "Ben", names: ["ben mobiel", "ben.nl", "ben telecom"], category: "TELECOM", country: "NL", network: "Odido" }),
  P({ canonical: "Hollandsnieuwe", names: ["hollandsnieuwe", "hollands nieuwe"], category: "TELECOM", country: "NL", network: "KPN" }),
  P({ canonical: "Simpel", names: ["simpel.nl", "simpel mobiel"], category: "TELECOM", country: "NL", network: "Odido" }),
  P({ canonical: "Lebara", names: ["lebara"], category: "TELECOM", country: "NL", network: "KPN" }),
  P({ canonical: "Lyca Mobile", names: ["lyca", "lycamobile", "lyca mobile"], category: "TELECOM", country: "NL", network: "KPN" }),
  P({ canonical: "Simyo", names: ["simyo"], category: "TELECOM", country: "NL", network: "KPN" }),
  P({ canonical: "Budget Mobiel", names: ["budget mobiel", "budgetmobiel"], category: "TELECOM", country: "NL", network: "KPN" }),
  P({ canonical: "Robin Mobile", names: ["robin mobile", "robinmobile"], category: "TELECOM", country: "NL", network: "KPN" }),
  P({ canonical: "Aldi Talk", names: ["aldi talk", "alditalk"], category: "TELECOM", country: "NL", network: "KPN" }),
  P({ canonical: "Telfort", names: ["telfort"], category: "TELECOM", country: "NL", network: "KPN" }),
  P({ canonical: "Ziggo", names: ["ziggo"], category: "TELECOM", country: "NL",
     retention: { url: "https://www.ziggo.nl/klantenservice/contact" } }),
  P({ canonical: "Online.nl", names: ["online.nl", "online nl"], category: "TELECOM", country: "NL" }),
  P({ canonical: "Caiway", names: ["caiway"], category: "TELECOM", country: "NL" }),
  P({ canonical: "Delta", names: ["delta fiber", "delta internet"], category: "TELECOM", country: "NL" }),
  P({ canonical: "Freedom Internet", names: ["freedom internet", "freedom.nl"], category: "TELECOM", country: "NL" }),

  P({ canonical: "Eneco", names: ["eneco"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "Vattenfall", names: ["vattenfall", "nuon"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "Essent", names: ["essent"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "Greenchoice", names: ["greenchoice", "green choice"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "Vandebron", names: ["vandebron", "van de bron"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "Pure Energie", names: ["pure energie", "pureenergie"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "Engie", names: ["engie"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "Budget Energie", names: ["budget energie", "budgetenergie"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "Frank Energie", names: ["frank energie", "frankenergie"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "EasyEnergy", names: ["easyenergy", "easy energy"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "Oxxio", names: ["oxxio"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "Energiedirect", names: ["energiedirect", "energie direct"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "ANWB Energie", names: ["anwb energie"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "Coolblue Energie", names: ["coolblue energie", "coolblue stroom"], category: "ENERGIE", country: "NL" }),
  P({ canonical: "DGB Energie", names: ["dgb energie", "dgb"], category: "ENERGIE", country: "NL" }),

  P({ canonical: "Centraal Beheer", names: ["centraal beheer", "centraalbeheer"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "ANWB Verzekeringen", names: ["anwb verzekering", "anwb verzekeringen"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "FBTO", names: ["fbto"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "InShared", names: ["inshared", "in shared"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "Allianz", names: ["allianz"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "Nationale-Nederlanden", names: ["nationale-nederlanden", "nationale nederlanden", "nn group"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "Univé", names: ["unive", "univé"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "ASR", names: ["a.s.r.", "asr verzekeringen"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "Aegon", names: ["aegon"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "Achmea", names: ["achmea"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "Interpolis", names: ["interpolis"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "Ditzo", names: ["ditzo"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "OHRA", names: ["ohra"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "Promovendum", names: ["promovendum"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "Reaal", names: ["reaal"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "Goudse", names: ["goudse", "de goudse"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "Zilveren Kruis", names: ["zilveren kruis", "zilverenkruis"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "VGZ", names: ["vgz"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "CZ", names: ["cz zorgverzekering", "c.z."], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "Menzis", names: ["menzis"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "DSW", names: ["dsw zorgverzekering"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "ONVZ", names: ["onvz"], category: "VERZEKERING", country: "NL" }),
  P({ canonical: "Salland", names: ["salland zorgverzekering"], category: "VERZEKERING", country: "NL" }),

  P({ canonical: "ABN AMRO", names: ["abn amro", "abnamro"], category: "BANK", country: "NL" }),
  P({ canonical: "ING", names: ["ing bank"], category: "BANK", country: "NL" }),
  P({ canonical: "Rabobank", names: ["rabobank", "rabo bank"], category: "BANK", country: "NL" }),
  P({ canonical: "SNS", names: ["sns bank", "sns.nl"], category: "BANK", country: "NL" }),
  P({ canonical: "Knab", names: ["knab"], category: "BANK", country: "NL" }),
  P({ canonical: "Bunq", names: ["bunq"], category: "BANK", country: "NL" }),
  P({ canonical: "ASN Bank", names: ["asn bank", "asnbank"], category: "BANK", country: "NL" }),
  P({ canonical: "Triodos", names: ["triodos"], category: "BANK", country: "NL" }),

  P({ canonical: "ABN AMRO Hypotheken", names: ["abn amro hypotheek", "abn hypotheek"], category: "HYPOTHEEK", country: "NL" }),
  P({ canonical: "ING Hypotheken", names: ["ing hypotheek"], category: "HYPOTHEEK", country: "NL" }),
  P({ canonical: "Rabo Hypotheken", names: ["rabobank hypotheek", "rabo hypotheek"], category: "HYPOTHEEK", country: "NL" }),
  P({ canonical: "Aegon Hypotheken", names: ["aegon hypotheek"], category: "HYPOTHEEK", country: "NL" }),
  P({ canonical: "Munt Hypotheken", names: ["munt hypotheken", "munt hypotheek"], category: "HYPOTHEEK", country: "NL" }),
  P({ canonical: "Argenta", names: ["argenta"], category: "HYPOTHEEK", country: "NL" }),
  P({ canonical: "Florius", names: ["florius"], category: "HYPOTHEEK", country: "NL" }),
  P({ canonical: "Obvion", names: ["obvion"], category: "HYPOTHEEK", country: "NL" }),
  P({ canonical: "BLG Wonen", names: ["blg wonen"], category: "HYPOTHEEK", country: "NL" }),
  P({ canonical: "Lloyds NL", names: ["lloyds bank nl"], category: "HYPOTHEEK", country: "NL" }),
  P({ canonical: "Tulp Hypotheken", names: ["tulp hypotheken", "tulphypotheken"], category: "HYPOTHEEK", country: "NL" }),
  P({ canonical: "Centraal Beheer Hypotheek", names: ["centraal beheer hypotheek"], category: "HYPOTHEEK", country: "NL" }),

  P({ canonical: "Vitens", names: ["vitens"], category: "WATER", country: "NL" }),
  P({ canonical: "Brabant Water", names: ["brabant water"], category: "WATER", country: "NL" }),
  P({ canonical: "PWN", names: ["pwn waterleiding", "pwn drinkwater"], category: "WATER", country: "NL" }),
  P({ canonical: "Evides", names: ["evides"], category: "WATER", country: "NL" }),
  P({ canonical: "Dunea", names: ["dunea"], category: "WATER", country: "NL" }),
  P({ canonical: "Waternet", names: ["waternet"], category: "WATER", country: "NL" }),
  P({ canonical: "PostNL", names: ["postnl", "post nl"], category: "OVERIG", country: "NL" }),

  // ===== BE =====
  P({ canonical: "Proximus", names: ["proximus"], category: "TELECOM", country: "BE" }),
  P({ canonical: "Orange BE", names: ["orange be", "orange belgium"], category: "TELECOM", country: "BE", locale: "fr" }),
  P({ canonical: "Telenet", names: ["telenet"], category: "TELECOM", country: "BE" }),
  P({ canonical: "Base", names: ["base mobile"], category: "TELECOM", country: "BE" }),
  P({ canonical: "Mobile Vikings", names: ["mobile vikings", "vikings"], category: "TELECOM", country: "BE" }),
  P({ canonical: "Engie Electrabel", names: ["engie electrabel", "electrabel"], category: "ENERGIE", country: "BE", locale: "fr" }),
  P({ canonical: "Luminus", names: ["luminus"], category: "ENERGIE", country: "BE", locale: "fr" }),
  P({ canonical: "TotalEnergies BE", names: ["totalenergies be", "lampiris"], category: "ENERGIE", country: "BE", locale: "fr" }),
  P({ canonical: "Mega", names: ["mega energy", "mega.be"], category: "ENERGIE", country: "BE" }),
  P({ canonical: "Eneco BE", names: ["eneco be", "eneco belgium"], category: "ENERGIE", country: "BE" }),
  P({ canonical: "AXA BE", names: ["axa be", "axa belgium"], category: "VERZEKERING", country: "BE", locale: "fr" }),
  P({ canonical: "AG Insurance", names: ["ag insurance", "ag verzekeringen"], category: "VERZEKERING", country: "BE" }),
  P({ canonical: "Ethias", names: ["ethias"], category: "VERZEKERING", country: "BE" }),
  P({ canonical: "DKV BE", names: ["dkv belgium", "dkv be"], category: "VERZEKERING", country: "BE" }),
  P({ canonical: "KBC", names: ["kbc bank", "kbc verzekering"], category: "BANK", country: "BE" }),
  P({ canonical: "Belfius", names: ["belfius"], category: "BANK", country: "BE", locale: "fr" }),
  P({ canonical: "ING BE", names: ["ing belgium", "ing be"], category: "BANK", country: "BE" }),
  P({ canonical: "BNP Paribas Fortis", names: ["bnp paribas fortis", "fortis"], category: "BANK", country: "BE", locale: "fr" }),
  P({ canonical: "Argenta BE", names: ["argenta belgium"], category: "BANK", country: "BE" }),
  P({ canonical: "Bpost", names: ["bpost"], category: "OVERIG", country: "BE" }),

  // ===== DE =====
  P({ canonical: "Deutsche Telekom", names: ["deutsche telekom", "telekom de", "t-mobile de"], category: "TELECOM", country: "DE" }),
  P({ canonical: "Vodafone DE", names: ["vodafone de", "vodafone deutschland"], category: "TELECOM", country: "DE" }),
  P({ canonical: "O2 DE", names: ["o2 de", "telefonica o2"], category: "TELECOM", country: "DE" }),
  P({ canonical: "1&1", names: ["1&1", "1und1", "1 und 1"], category: "TELECOM", country: "DE" }),
  P({ canonical: "Congstar", names: ["congstar"], category: "TELECOM", country: "DE" }),
  P({ canonical: "Otelo", names: ["otelo"], category: "TELECOM", country: "DE" }),
  P({ canonical: "Klarmobil", names: ["klarmobil"], category: "TELECOM", country: "DE" }),
  P({ canonical: "Sky DE", names: ["sky de", "sky deutschland"], category: "TELECOM", country: "DE" }),
  P({ canonical: "Unitymedia", names: ["unitymedia"], category: "TELECOM", country: "DE" }),
  P({ canonical: "E.ON", names: ["e.on", "eon energie"], category: "ENERGIE", country: "DE" }),
  P({ canonical: "RWE", names: ["rwe"], category: "ENERGIE", country: "DE" }),
  P({ canonical: "Vattenfall DE", names: ["vattenfall de", "vattenfall deutschland"], category: "ENERGIE", country: "DE" }),
  P({ canonical: "EnBW", names: ["enbw"], category: "ENERGIE", country: "DE" }),
  P({ canonical: "EWE", names: ["ewe energie"], category: "ENERGIE", country: "DE" }),
  P({ canonical: "Yello Strom", names: ["yello strom", "yello"], category: "ENERGIE", country: "DE" }),
  P({ canonical: "Stadtwerke", names: ["stadtwerke"], category: "ENERGIE", country: "DE" }),
  P({ canonical: "Allianz DE", names: ["allianz de", "allianz deutschland"], category: "VERZEKERING", country: "DE" }),
  // Backwards-compat aliases voor pre-DEEL3 seed-tests:
  P({ canonical: "O2", names: ["o2"], category: "TELECOM", country: "DE" }),
  P({ canonical: "AIG", names: ["aig", "aig insurance"], category: "VERZEKERING", country: "INT" }),
  P({ canonical: "Zurich", names: ["zurich verzekering", "zurich insurance", "zurich"], category: "VERZEKERING", country: "INT" }),
  P({ canonical: "HUK24", names: ["huk24", "huk-coburg", "huk coburg"], category: "VERZEKERING", country: "DE" }),
  P({ canonical: "AXA DE", names: ["axa de", "axa deutschland"], category: "VERZEKERING", country: "DE" }),
  P({ canonical: "DEVK", names: ["devk"], category: "VERZEKERING", country: "DE" }),
  P({ canonical: "Debeka", names: ["debeka"], category: "VERZEKERING", country: "DE" }),
  P({ canonical: "DKB", names: ["dkb bank"], category: "BANK", country: "DE" }),
  P({ canonical: "Deutsche Bank", names: ["deutsche bank"], category: "BANK", country: "DE" }),
  P({ canonical: "Commerzbank", names: ["commerzbank"], category: "BANK", country: "DE" }),
  P({ canonical: "Sparkasse", names: ["sparkasse"], category: "BANK", country: "DE" }),

  // ===== FR =====
  P({ canonical: "Orange", names: ["orange fr", "orange.fr", "orange france"], category: "TELECOM", country: "FR" }),
  P({ canonical: "SFR", names: ["sfr"], category: "TELECOM", country: "FR" }),
  P({ canonical: "Bouygues Telecom", names: ["bouygues", "bouygues telecom"], category: "TELECOM", country: "FR" }),
  P({ canonical: "Free Mobile", names: ["free mobile", "free.fr"], category: "TELECOM", country: "FR" }),
  P({ canonical: "Sosh", names: ["sosh"], category: "TELECOM", country: "FR" }),
  P({ canonical: "RED by SFR", names: ["red by sfr", "red sfr"], category: "TELECOM", country: "FR" }),
  P({ canonical: "B&You", names: ["b&you", "byou", "b and you"], category: "TELECOM", country: "FR" }),
  P({ canonical: "EDF", names: ["edf", "electricite de france"], category: "ENERGIE", country: "FR" }),
  P({ canonical: "Engie FR", names: ["engie france", "gdf suez"], category: "ENERGIE", country: "FR" }),
  P({ canonical: "TotalEnergies", names: ["totalenergies", "total energies"], category: "ENERGIE", country: "FR" }),
  P({ canonical: "Eni Plenitude", names: ["eni plenitude", "eni gas"], category: "ENERGIE", country: "FR" }),
  P({ canonical: "Mint Energie", names: ["mint energie", "mint energy"], category: "ENERGIE", country: "FR" }),
  P({ canonical: "AXA", names: ["axa fr", "axa france"], category: "VERZEKERING", country: "FR" }),
  P({ canonical: "MAIF", names: ["maif"], category: "VERZEKERING", country: "FR" }),
  P({ canonical: "MACIF", names: ["macif"], category: "VERZEKERING", country: "FR" }),
  P({ canonical: "Matmut", names: ["matmut"], category: "VERZEKERING", country: "FR" }),
  P({ canonical: "Crédit Agricole", names: ["credit agricole", "crédit agricole"], category: "BANK", country: "FR" }),
  P({ canonical: "BNP Paribas", names: ["bnp paribas"], category: "BANK", country: "FR" }),
  P({ canonical: "Société Générale", names: ["societe generale", "société générale"], category: "BANK", country: "FR" }),
  P({ canonical: "Boursorama", names: ["boursorama"], category: "BANK", country: "FR" }),

  // ===== UK =====
  P({ canonical: "BT", names: ["bt broadband", "bt uk", "british telecom"], category: "TELECOM", country: "UK" }),
  P({ canonical: "Sky", names: ["sky tv", "sky uk", "sky broadband"], category: "TELECOM", country: "UK" }),
  P({ canonical: "Virgin Media", names: ["virgin media", "virgin"], category: "TELECOM", country: "UK" }),
  P({ canonical: "EE", names: ["ee mobile", "ee uk"], category: "TELECOM", country: "UK" }),
  P({ canonical: "Vodafone UK", names: ["vodafone uk"], category: "TELECOM", country: "UK" }),
  P({ canonical: "O2 UK", names: ["o2 uk"], category: "TELECOM", country: "UK" }),
  P({ canonical: "Three", names: ["three uk", "3 mobile", "three.co.uk"], category: "TELECOM", country: "UK" }),
  P({ canonical: "TalkTalk", names: ["talktalk", "talk talk"], category: "TELECOM", country: "UK" }),
  P({ canonical: "Plusnet", names: ["plusnet"], category: "TELECOM", country: "UK" }),
  P({ canonical: "Giffgaff", names: ["giffgaff"], category: "TELECOM", country: "UK" }),
  P({ canonical: "British Gas", names: ["british gas"], category: "ENERGIE", country: "UK" }),
  P({ canonical: "Octopus Energy", names: ["octopus energy", "octopus"], category: "ENERGIE", country: "UK" }),
  P({ canonical: "OVO Energy", names: ["ovo energy", "ovo"], category: "ENERGIE", country: "UK" }),
  P({ canonical: "E.ON Next", names: ["e.on next", "eon next"], category: "ENERGIE", country: "UK" }),
  P({ canonical: "EDF Energy UK", names: ["edf energy", "edf uk"], category: "ENERGIE", country: "UK" }),
  P({ canonical: "ScottishPower", names: ["scottishpower", "scottish power"], category: "ENERGIE", country: "UK" }),
  P({ canonical: "Aviva", names: ["aviva"], category: "VERZEKERING", country: "UK" }),
  P({ canonical: "Admiral", names: ["admiral insurance", "admiral car"], category: "VERZEKERING", country: "UK" }),
  P({ canonical: "Direct Line", names: ["direct line"], category: "VERZEKERING", country: "UK" }),
  P({ canonical: "LV=", names: ["lv=", "liverpool victoria"], category: "VERZEKERING", country: "UK" }),
  P({ canonical: "HSBC", names: ["hsbc"], category: "BANK", country: "UK" }),
  P({ canonical: "Barclays", names: ["barclays"], category: "BANK", country: "UK" }),
  P({ canonical: "Lloyds Bank", names: ["lloyds bank", "lloyds"], category: "BANK", country: "UK" }),
  P({ canonical: "NatWest", names: ["natwest"], category: "BANK", country: "UK" }),
  P({ canonical: "Monzo", names: ["monzo"], category: "BANK", country: "UK" }),

  // ===== US =====
  P({ canonical: "Verizon", names: ["verizon", "verizon wireless"], category: "TELECOM", country: "US" }),
  P({ canonical: "AT&T", names: ["at&t", "att", "at t"], category: "TELECOM", country: "US" }),
  P({ canonical: "T-Mobile US", names: ["t-mobile us", "tmobile us", "metro pcs"], category: "TELECOM", country: "US" }),
  P({ canonical: "Mint Mobile", names: ["mint mobile"], category: "TELECOM", country: "US" }),
  P({ canonical: "Cricket", names: ["cricket wireless", "cricket"], category: "TELECOM", country: "US" }),
  P({ canonical: "Boost Mobile", names: ["boost mobile"], category: "TELECOM", country: "US" }),
  P({ canonical: "Comcast Xfinity", names: ["comcast", "xfinity"], category: "TELECOM", country: "US" }),
  P({ canonical: "Spectrum", names: ["spectrum", "charter spectrum"], category: "TELECOM", country: "US" }),
  P({ canonical: "Cox", names: ["cox communications", "cox"], category: "TELECOM", country: "US" }),
  P({ canonical: "Optimum", names: ["optimum", "altice"], category: "TELECOM", country: "US" }),
  P({ canonical: "ConEd", names: ["coned", "con edison", "consolidated edison"], category: "ENERGIE", country: "US" }),
  P({ canonical: "PG&E", names: ["pg&e", "pacific gas"], category: "ENERGIE", country: "US" }),
  P({ canonical: "Duke Energy", names: ["duke energy"], category: "ENERGIE", country: "US" }),
  P({ canonical: "Southern Company", names: ["southern company", "georgia power"], category: "ENERGIE", country: "US" }),
  P({ canonical: "NextEra", names: ["nextera", "florida power"], category: "ENERGIE", country: "US" }),
  P({ canonical: "GEICO", names: ["geico"], category: "VERZEKERING", country: "US" }),
  P({ canonical: "State Farm", names: ["state farm"], category: "VERZEKERING", country: "US" }),
  P({ canonical: "Progressive", names: ["progressive insurance", "progressive"], category: "VERZEKERING", country: "US" }),
  P({ canonical: "Allstate", names: ["allstate"], category: "VERZEKERING", country: "US" }),
  P({ canonical: "USAA", names: ["usaa"], category: "VERZEKERING", country: "US" }),
  P({ canonical: "Liberty Mutual", names: ["liberty mutual"], category: "VERZEKERING", country: "US" }),
  P({ canonical: "Chase", names: ["chase bank", "jp morgan chase"], category: "BANK", country: "US" }),
  P({ canonical: "Bank of America", names: ["bank of america", "boa"], category: "BANK", country: "US" }),
  P({ canonical: "Wells Fargo", names: ["wells fargo"], category: "BANK", country: "US" }),
  P({ canonical: "Citi", names: ["citibank", "citi"], category: "BANK", country: "US" }),
  P({ canonical: "Capital One", names: ["capital one"], category: "BANK", country: "US" }),
  P({ canonical: "US Bank", names: ["us bank", "u.s. bank"], category: "BANK", country: "US" }),
  P({ canonical: "Discover", names: ["discover bank", "discover card"], category: "BANK", country: "US" }),
  P({ canonical: "Ally", names: ["ally bank"], category: "BANK", country: "US" }),
  P({ canonical: "Marcus", names: ["marcus by goldman", "marcus"], category: "BANK", country: "US" }),

  // ===== ES =====
  P({ canonical: "Movistar", names: ["movistar"], category: "TELECOM", country: "ES" }),
  P({ canonical: "Orange ES", names: ["orange es", "orange spain"], category: "TELECOM", country: "ES" }),
  P({ canonical: "Vodafone ES", names: ["vodafone es", "vodafone spain"], category: "TELECOM", country: "ES" }),
  P({ canonical: "MasMovil", names: ["masmovil", "mas movil"], category: "TELECOM", country: "ES" }),
  P({ canonical: "Yoigo", names: ["yoigo"], category: "TELECOM", country: "ES" }),
  P({ canonical: "Iberdrola", names: ["iberdrola"], category: "ENERGIE", country: "ES" }),
  P({ canonical: "Endesa", names: ["endesa"], category: "ENERGIE", country: "ES" }),
  P({ canonical: "Naturgy", names: ["naturgy"], category: "ENERGIE", country: "ES" }),
  P({ canonical: "Repsol", names: ["repsol energia", "repsol"], category: "ENERGIE", country: "ES" }),
  P({ canonical: "Mapfre", names: ["mapfre"], category: "VERZEKERING", country: "ES" }),
  P({ canonical: "Mutua Madrileña", names: ["mutua madrileña", "mutua madrilena"], category: "VERZEKERING", country: "ES" }),
  P({ canonical: "BBVA", names: ["bbva"], category: "BANK", country: "ES" }),
  P({ canonical: "Santander", names: ["santander"], category: "BANK", country: "ES" }),
  P({ canonical: "CaixaBank", names: ["caixabank", "la caixa"], category: "BANK", country: "ES" }),
  P({ canonical: "Sabadell", names: ["banco sabadell", "sabadell"], category: "BANK", country: "ES" }),

  // ===== IT =====
  P({ canonical: "TIM", names: ["tim italia", "telecom italia"], category: "TELECOM", country: "IT" }),
  P({ canonical: "Vodafone IT", names: ["vodafone it", "vodafone italia"], category: "TELECOM", country: "IT" }),
  P({ canonical: "WindTre", names: ["windtre", "wind tre", "wind"], category: "TELECOM", country: "IT" }),
  P({ canonical: "Iliad", names: ["iliad"], category: "TELECOM", country: "IT" }),
  P({ canonical: "Fastweb", names: ["fastweb"], category: "TELECOM", country: "IT" }),
  P({ canonical: "Enel", names: ["enel"], category: "ENERGIE", country: "IT" }),
  P({ canonical: "Eni Gas e Luce", names: ["eni gas e luce", "eni plenitude it"], category: "ENERGIE", country: "IT" }),
  P({ canonical: "A2A", names: ["a2a energia"], category: "ENERGIE", country: "IT" }),
  P({ canonical: "Edison", names: ["edison energia"], category: "ENERGIE", country: "IT" }),
  P({ canonical: "Generali", names: ["generali"], category: "VERZEKERING", country: "IT" }),
  P({ canonical: "Unipol", names: ["unipol", "unipolsai"], category: "VERZEKERING", country: "IT" }),
  P({ canonical: "Allianz IT", names: ["allianz italia"], category: "VERZEKERING", country: "IT" }),
  P({ canonical: "Intesa Sanpaolo", names: ["intesa sanpaolo", "intesa"], category: "BANK", country: "IT" }),
  P({ canonical: "UniCredit", names: ["unicredit"], category: "BANK", country: "IT" }),
  P({ canonical: "BPER", names: ["bper banca", "bper"], category: "BANK", country: "IT" }),

  // ===== INT — STREAMING =====
  P({ canonical: "Netflix", names: ["netflix"], category: "STREAMING", country: "INT" }),
  P({ canonical: "Disney+", names: ["disney+", "disneyplus", "disney plus"], category: "STREAMING", country: "INT" }),
  P({ canonical: "HBO Max", names: ["hbo max", "hbomax"], category: "STREAMING", country: "INT" }),
  P({ canonical: "Apple TV+", names: ["apple tv+", "apple tv plus", "appletv"], category: "STREAMING", country: "INT" }),
  P({ canonical: "Amazon Prime Video", names: ["prime video", "amazon prime"], category: "STREAMING", country: "INT" }),
  P({ canonical: "Spotify", names: ["spotify"], category: "STREAMING", country: "INT" }),
  P({ canonical: "Apple Music", names: ["apple music"], category: "STREAMING", country: "INT" }),
  P({ canonical: "YouTube Premium", names: ["youtube premium", "youtube music"], category: "STREAMING", country: "INT" }),
  P({ canonical: "Tidal", names: ["tidal"], category: "STREAMING", country: "INT" }),
  P({ canonical: "Deezer", names: ["deezer"], category: "STREAMING", country: "INT" }),
  P({ canonical: "Audible", names: ["audible"], category: "STREAMING", country: "INT" }),
  P({ canonical: "Videoland", names: ["videoland"], category: "STREAMING", country: "NL" }),
  P({ canonical: "ESPN+", names: ["espn+", "espn plus"], category: "STREAMING", country: "NL" }),
  P({ canonical: "Ziggo Sport", names: ["ziggo sport"], category: "STREAMING", country: "NL" }),
  P({ canonical: "Viaplay", names: ["viaplay"], category: "STREAMING", country: "INT" }),
  P({ canonical: "Storytel", names: ["storytel"], category: "STREAMING", country: "INT" }),
  // ===== INT — SOFTWARE =====
  P({ canonical: "Microsoft 365", names: ["microsoft 365", "office 365", "ms 365"], category: "SOFTWARE", country: "INT" }),
  P({ canonical: "Adobe Creative Cloud", names: ["adobe creative cloud", "adobe cc", "creative cloud"], category: "SOFTWARE", country: "INT" }),
  P({ canonical: "ChatGPT Plus", names: ["chatgpt plus", "openai plus"], category: "SOFTWARE", country: "INT" }),
  P({ canonical: "GitHub Pro", names: ["github copilot", "github pro"], category: "SOFTWARE", country: "INT" }),
  P({ canonical: "Notion", names: ["notion plus", "notion pro"], category: "SOFTWARE", country: "INT" }),
  // ===== INT — OPSLAG =====
  P({ canonical: "iCloud+", names: ["icloud+", "icloud plus", "icloud storage"], category: "OPSLAG", country: "INT" }),
  P({ canonical: "Google One", names: ["google one"], category: "OPSLAG", country: "INT" }),
  P({ canonical: "Dropbox", names: ["dropbox plus", "dropbox pro"], category: "OPSLAG", country: "INT" }),
  // ===== INT — BANK =====
  P({ canonical: "Revolut", names: ["revolut"], category: "BANK", country: "INT" }),
  P({ canonical: "N26", names: ["n26"], category: "BANK", country: "INT" }),
  P({ canonical: "Wise", names: ["wise", "transferwise"], category: "BANK", country: "INT" }),
  // ===== GYM =====
  P({ canonical: "Basic-Fit", names: ["basic-fit", "basicfit", "basic fit"], category: "GYM", country: "INT" }),
  P({ canonical: "SportCity", names: ["sportcity", "sport city"], category: "GYM", country: "NL" }),
  P({ canonical: "Anytime Fitness", names: ["anytime fitness"], category: "GYM", country: "INT" }),
  P({ canonical: "Fit For Free", names: ["fit for free"], category: "GYM", country: "NL" }),
  // ===== WATER / GEMEENTE / OV =====
  // Promoted from OVERIG. Water heeft géén onderhandel-mogelijkheid maar wel
  // monitoring (zie lib/categories.ts) — gemeente idem.
  P({ canonical: "DPD", names: ["dpd"], category: "OVERIG", country: "INT" }),
  P({ canonical: "NS", names: ["ns nederlandse spoorwegen", "ns.nl", "nederlandse spoorwegen"], category: "OV", country: "NL" }),
  P({ canonical: "OV-chipkaart", names: ["ov-chipkaart", "ovchipkaart"], category: "OV", country: "NL" }),
  P({ canonical: "Greenwheels", names: ["greenwheels"], category: "OV", country: "NL" }),
  P({ canonical: "Swapfiets", names: ["swapfiets"], category: "OV", country: "NL" }),
];

// ─────────────────────────────────────────────────────────────
// Backwards-compat: NL_PROVIDERS in old ProviderRecord shape.
// Older code imports NL_PROVIDERS and reads .canonical / .aliases / .region.
// We map every Provider → ProviderRecord (region computed from country).
// ─────────────────────────────────────────────────────────────

function toRecord(p: Provider): ProviderRecord {
  return {
    canonical: p.canonical,
    category: p.category,
    region: countryToRegion(p.country),
    aliases: p.names.map((n) => n.toLowerCase()),
    network: p.network,
    country: p.country,
    locale: p.locale,
  };
}

export const NL_PROVIDERS: ProviderRecord[] = PROVIDERS.map(toRecord);

// ─────────────────────────────────────────────────────────────
// Search helpers
// ─────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Damerau-style Levenshtein with cap=2 for early-exit. */
export function levenshtein(a: string, b: string, cap = 2): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > cap) return cap + 1;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const prev = new Array<number>(lb + 1);
  const curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    for (let j = 0; j <= lb; j++) prev[j] = curr[j];
  }
  return prev[lb];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary substring test — "ee" inside "greenchoise" is NOT a match. */
function containsAsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const re = new RegExp(`\\b${escapeRegex(needle)}\\b`);
  return re.test(haystack);
}

/** Min Levenshtein between input and any whitespace-tokenized word in alias. */
function minTokenLevenshtein(input: string, alias: string, cap: number): number {
  const direct = levenshtein(input, alias, cap);
  if (direct <= cap) return direct;
  const tokens = alias.split(/\s+/);
  let best = cap + 1;
  for (const t of tokens) {
    if (!t) continue;
    const d = levenshtein(input, t, cap);
    if (d < best) best = d;
  }
  return best;
}

function searchMatch(input: string, candidates: Provider[]): Provider | null {
  const norm = normalize(input);
  if (!norm) return null;

  // 1. Exact canonical
  for (const p of candidates) {
    if (normalize(p.canonical) === norm) return p;
  }

  // 2. Alias substring with WORD BOUNDARY (longest alias wins).
  // Two directions:
  //  a) alias is a whole word inside input ("kpn" in "kpn factuur")
  //  b) input matches the first token of alias ("vodafone" → "vodafone de")
  const subMatches: { p: Provider; weight: number }[] = [];
  for (const p of candidates) {
    for (const a of p.names) {
      const na = normalize(a);
      if (!na) continue;
      if (containsAsWord(norm, na)) {
        subMatches.push({ p, weight: na.length + 1000 });
      } else if (na.startsWith(norm + " ") && norm.length >= 3) {
        // "vodafone" matches "vodafone de" as prefix-token
        subMatches.push({ p, weight: norm.length });
      }
    }
  }
  if (subMatches.length > 0) {
    subMatches.sort((a, b) => b.weight - a.weight);
    return subMatches[0].p;
  }

  // 3. Fuzzy on full alias OR alias tokens
  let best: { p: Provider; dist: number } | null = null;
  for (const p of candidates) {
    for (const a of p.names) {
      const d = minTokenLevenshtein(norm, normalize(a), 2);
      if (d <= 2 && (best === null || d < best.dist)) {
        best = { p, dist: d };
      }
    }
  }
  return best ? best.p : null;
}

/**
 * Find a provider by free-text input across all countries.
 * Strategy: exact canonical → alias word-boundary substring → fuzzy (Levenshtein ≤ 2).
 */
export function findProvider(input: string): ProviderRecord | null {
  if (!input) return null;
  const p = searchMatch(input, PROVIDERS);
  return p ? toRecord(p) : null;
}

/**
 * Disambiguate by country — useful when two countries share a name
 * (e.g. "Allianz" exists in NL/DE/FR/IT).
 */
export function findProviderByCountry(input: string, country: Country): ProviderRecord | null {
  if (!input) return null;
  const candidates = PROVIDERS.filter((p) => p.country === country);
  const p = searchMatch(input, candidates);
  return p ? toRecord(p) : null;
}

export function listProvidersByCategory(cat: Category): ProviderRecord[] {
  return PROVIDERS.filter((p) => p.category === cat).map(toRecord);
}

export function listProvidersByRegion(region: Region): ProviderRecord[] {
  return PROVIDERS.filter((p) => countryToRegion(p.country) === region).map(toRecord);
}

export function listProvidersByCountry(country: Country): Provider[] {
  return PROVIDERS.filter((p) => p.country === country);
}

export function allCategories(): Category[] {
  return [
    "TELECOM",
    "ENERGIE",
    "WATER",
    "GEMEENTE",
    "VERZEKERING",
    "HYPOTHEEK",
    "BANK",
    "ABONNEMENT",
    "STREAMING",
    "GYM",
    "OV",
    "SOFTWARE",
    "OPSLAG",
    "OVERIG",
  ];
}

export function allCountries(): Country[] {
  return ["NL", "BE", "DE", "FR", "UK", "US", "ES", "IT", "INT"];
}

export function totalProviderCount(): number {
  return PROVIDERS.length;
}

/** Map a provider canonical name → its country. Null when unknown. */
export function providerCountry(canonical: string): Country | null {
  const p = PROVIDERS.find((x) => x.canonical.toLowerCase() === canonical.toLowerCase());
  return p ? p.country : null;
}

export function getProviderNetwork(canonical: string): MobileNetwork | undefined {
  const p = PROVIDERS.find((x) => x.canonical.toLowerCase() === canonical.toLowerCase());
  if (!p || p.category !== "TELECOM" || p.country !== "NL") return undefined;
  return p.network ?? null;
}

export function describeNetwork(canonical: string): string | null {
  const network = getProviderNetwork(canonical);
  if (network === undefined) return null;
  if (network === null) return "eigen netwerk";
  return `MVNO op ${network}-netwerk`;
}

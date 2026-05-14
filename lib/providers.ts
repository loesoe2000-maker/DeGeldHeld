/**
 * Canonical NL provider registry — used by OCR matching, comparison,
 * and seed scripts.
 */

export type Category = "TELECOM" | "ENERGIE" | "VERZEKERING" | "HYPOTHEEK" | "ABONNEMENT" | "OVERIG";

export type ProviderRecord = {
  canonical: string;
  category: Category;
  aliases: string[];
};

export const NL_PROVIDERS: ProviderRecord[] = [
  // --- TELECOM ---
  { canonical: "T-Mobile", category: "TELECOM", aliases: ["t-mobile", "tmobile", "t mobile"] },
  { canonical: "KPN", category: "TELECOM", aliases: ["kpn", "k.p.n."] },
  { canonical: "Vodafone", category: "TELECOM", aliases: ["vodafone", "vf"] },
  { canonical: "Tele2", category: "TELECOM", aliases: ["tele2", "tele 2"] },
  { canonical: "Odido", category: "TELECOM", aliases: ["odido"] },
  { canonical: "Ziggo", category: "TELECOM", aliases: ["ziggo", "ziggo internet", "ziggo tv"] },
  { canonical: "Online.nl", category: "TELECOM", aliases: ["online.nl", "online nl"] },

  // --- ENERGIE ---
  { canonical: "Eneco", category: "ENERGIE", aliases: ["eneco"] },
  { canonical: "Vattenfall", category: "ENERGIE", aliases: ["vattenfall", "nuon"] },
  { canonical: "Essent", category: "ENERGIE", aliases: ["essent"] },
  { canonical: "Greenchoice", category: "ENERGIE", aliases: ["greenchoice", "green choice"] },
  { canonical: "Vandebron", category: "ENERGIE", aliases: ["vandebron", "van de bron"] },
  { canonical: "Budget Energie", category: "ENERGIE", aliases: ["budget energie", "budgetenergie"] },

  // --- VERZEKERING ---
  { canonical: "Centraal Beheer", category: "VERZEKERING", aliases: ["centraal beheer", "centraalbeheer"] },
  { canonical: "Aegon", category: "VERZEKERING", aliases: ["aegon"] },
  { canonical: "Nationale-Nederlanden", category: "VERZEKERING", aliases: ["nationale-nederlanden", "nn", "nn group", "nationale nederlanden"] },

  // --- HYPOTHEEK ---
  { canonical: "ING", category: "HYPOTHEEK", aliases: ["ing", "ing bank"] },
  { canonical: "ABN AMRO", category: "HYPOTHEEK", aliases: ["abn amro", "abn", "abnamro"] },
  { canonical: "Rabobank", category: "HYPOTHEEK", aliases: ["rabobank", "rabo"] },
];

export function findProvider(input: string): ProviderRecord | null {
  if (!input) return null;
  const norm = input.toLowerCase().trim();
  for (const p of NL_PROVIDERS) {
    if (p.canonical.toLowerCase() === norm) return p;
    if (p.aliases.some((a) => norm.includes(a))) return p;
  }
  return null;
}

export function listProvidersByCategory(cat: Category): ProviderRecord[] {
  return NL_PROVIDERS.filter((p) => p.category === cat);
}

export function allCategories(): Category[] {
  return ["TELECOM", "ENERGIE", "VERZEKERING", "HYPOTHEEK", "ABONNEMENT", "OVERIG"];
}

/**
 * Markt-prijs DB seed data + lookup helpers.
 * Run scripts/seed.ts om te schrijven naar Postgres.
 */

import type { Category } from "@/lib/providers";

export type SeedPlan = {
  provider: string;
  category: Category;
  name: string;
  priceCents: number;
  features: string;
};

export const MARKET_PLANS: SeedPlan[] = [
  // --- TELECOM (mobiel) ---
  { provider: "T-Mobile", category: "TELECOM", name: "Go Unlimited", priceCents: 2700, features: "Onbeperkt data 5G, EU roaming" },
  { provider: "T-Mobile", category: "TELECOM", name: "Go 10 GB", priceCents: 1500, features: "10 GB data, 5G" },
  { provider: "KPN", category: "TELECOM", name: "Klein 5 GB", priceCents: 1700, features: "5 GB data, 5G basis" },
  { provider: "KPN", category: "TELECOM", name: "Compleet Onbeperkt", priceCents: 3500, features: "Onbeperkt 5G+ EU" },
  { provider: "Vodafone", category: "TELECOM", name: "Red Unlimited", priceCents: 3000, features: "Onbeperkt 5G, EU+VK" },
  { provider: "Vodafone", category: "TELECOM", name: "Start 8 GB", priceCents: 1400, features: "8 GB, 5G" },
  { provider: "Tele2", category: "TELECOM", name: "Onbeperkt 5G", priceCents: 2500, features: "Onbeperkt 5G basis" },
  { provider: "Odido", category: "TELECOM", name: "Klein 4 GB", priceCents: 1200, features: "4 GB" },
  { provider: "Odido", category: "TELECOM", name: "Onbeperkt", priceCents: 2400, features: "Onbeperkt 5G" },

  // --- TELECOM (internet/TV) ---
  { provider: "Ziggo", category: "TELECOM", name: "Internet Start 100 Mbps", priceCents: 4500, features: "100 Mbps download" },
  { provider: "Ziggo", category: "TELECOM", name: "Mediabox Next 1 Gbps", priceCents: 7995, features: "1 Gbps + TV + bellen" },
  { provider: "KPN", category: "TELECOM", name: "KPN Start glasvezel", priceCents: 4200, features: "100 Mbps glas" },
  { provider: "Online.nl", category: "TELECOM", name: "Goedkoop 200 Mbps", priceCents: 3900, features: "200 Mbps glas" },

  // --- ENERGIE ---
  { provider: "Eneco", category: "ENERGIE", name: "HollandseWind 1 jaar", priceCents: 18000, features: "100% NL wind, 1jr vast" },
  { provider: "Eneco", category: "ENERGIE", name: "Variabel basis", priceCents: 16500, features: "Variabel tarief" },
  { provider: "Vattenfall", category: "ENERGIE", name: "Vast 3 jaar groene stroom", priceCents: 17500, features: "3jr vast tarief" },
  { provider: "Essent", category: "ENERGIE", name: "Variabel groen", priceCents: 16000, features: "Variabel groen" },
  { provider: "Greenchoice", category: "ENERGIE", name: "Vast 1 jaar 100% groen", priceCents: 15800, features: "1jr vast 100% groen" },

  // --- VERZEKERING (auto WA basis) ---
  { provider: "Centraal Beheer", category: "VERZEKERING", name: "Auto WA basis", priceCents: 1500, features: "WA basis" },
  { provider: "Aegon", category: "VERZEKERING", name: "Auto Plus", priceCents: 2400, features: "Allrisk basis" },
  { provider: "Nationale-Nederlanden", category: "VERZEKERING", name: "Auto Compact", priceCents: 1800, features: "WA + beperkt casco" },

  // --- HYPOTHEEK (rente per maand voor 250k 30jr — indicatief) ---
  { provider: "ING", category: "HYPOTHEEK", name: "10jr vast NHG", priceCents: 78000, features: "10jr vast, NHG" },
  { provider: "ABN AMRO", category: "HYPOTHEEK", name: "20jr vast NHG", priceCents: 81000, features: "20jr vast, NHG" },
  { provider: "Rabobank", category: "HYPOTHEEK", name: "30jr vast", priceCents: 86000, features: "30jr vast" },
];

export function plansForCategory(cat: Category): SeedPlan[] {
  return MARKET_PLANS.filter((p) => p.category === cat);
}

export function plansForProvider(name: string): SeedPlan[] {
  return MARKET_PLANS.filter((p) => p.provider.toLowerCase() === name.toLowerCase());
}

export function cheapestPlan(cat: Category): SeedPlan | null {
  const list = plansForCategory(cat);
  if (list.length === 0) return null;
  return list.reduce((a, b) => (a.priceCents <= b.priceCents ? a : b));
}

export function uniqueProviders(): string[] {
  return Array.from(new Set(MARKET_PLANS.map((p) => p.provider)));
}

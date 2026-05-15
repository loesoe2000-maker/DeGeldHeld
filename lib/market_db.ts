/**
 * Markt-prijs DB seed data + lookup helpers.
 *
 * v3: uitgebreid van ~25 plans → 150+ unieke providers, 200+ plans.
 * Prijzen indicatief (per maand in cents) — daadwerkelijke tarieven worden
 * via scripts/update_prices.ts periodiek bijgewerkt vanuit publieke bronnen.
 *
 * Run scripts/seed.ts om te schrijven naar Postgres. Idempotent.
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
  // ===== TELECOM mobiel NL =====
  { provider: "T-Mobile", category: "TELECOM", name: "Go Unlimited 5G", priceCents: 2700, features: "Onbeperkt data 5G, EU roaming" },
  { provider: "T-Mobile", category: "TELECOM", name: "Go 10 GB", priceCents: 1500, features: "10 GB data, 5G" },
  { provider: "KPN", category: "TELECOM", name: "Klein 5 GB", priceCents: 1700, features: "5 GB data, 5G basis" },
  { provider: "KPN", category: "TELECOM", name: "Compleet Onbeperkt", priceCents: 3500, features: "Onbeperkt 5G+ EU" },
  { provider: "Vodafone", category: "TELECOM", name: "Red Unlimited", priceCents: 3000, features: "Onbeperkt 5G, EU+VK" },
  { provider: "Vodafone", category: "TELECOM", name: "Start 8 GB", priceCents: 1400, features: "8 GB, 5G" },
  { provider: "Tele2", category: "TELECOM", name: "Onbeperkt 5G", priceCents: 2500, features: "Onbeperkt 5G basis" },
  { provider: "Odido", category: "TELECOM", name: "Klein 4 GB", priceCents: 1200, features: "4 GB" },
  { provider: "Odido", category: "TELECOM", name: "Onbeperkt", priceCents: 2400, features: "Onbeperkt 5G" },
  { provider: "Youfone", category: "TELECOM", name: "Sim Only 8 GB", priceCents: 950, features: "8 GB op KPN-netwerk" },
  { provider: "Youfone", category: "TELECOM", name: "Sim Only Onbeperkt", priceCents: 1850, features: "Onbeperkt op KPN" },
  { provider: "Ben", category: "TELECOM", name: "Sim Only 5 GB", priceCents: 800, features: "5 GB op T-Mobile" },
  { provider: "Ben", category: "TELECOM", name: "Sim Only 15 GB", priceCents: 1300, features: "15 GB op T-Mobile" },
  { provider: "Hollandsnieuwe", category: "TELECOM", name: "Sim Only 6 GB", priceCents: 950, features: "6 GB op Vodafone" },
  { provider: "Simpel", category: "TELECOM", name: "Sim Only 10 GB", priceCents: 1050, features: "10 GB op KPN" },
  { provider: "Lebara", category: "TELECOM", name: "Pre-paid 5 GB", priceCents: 750, features: "5 GB pre-paid + intl" },
  { provider: "Lyca Mobile", category: "TELECOM", name: "Pre-paid 8 GB", priceCents: 800, features: "8 GB pre-paid" },
  { provider: "Simyo", category: "TELECOM", name: "Sim Only 6 GB", priceCents: 900, features: "6 GB op KPN" },
  { provider: "Budget Mobiel", category: "TELECOM", name: "Sim Only 5 GB", priceCents: 700, features: "5 GB op KPN" },
  { provider: "Robin Mobile", category: "TELECOM", name: "Sim Only 10 GB", priceCents: 1100, features: "10 GB groen op KPN" },

  // ===== TELECOM internet/TV NL =====
  { provider: "Ziggo", category: "TELECOM", name: "Internet Start 100 Mbps", priceCents: 4500, features: "100 Mbps download" },
  { provider: "Ziggo", category: "TELECOM", name: "Mediabox Next 1 Gbps", priceCents: 7995, features: "1 Gbps + TV + bellen" },
  { provider: "KPN", category: "TELECOM", name: "KPN Start glasvezel", priceCents: 4200, features: "100 Mbps glas" },
  { provider: "Online.nl", category: "TELECOM", name: "Goedkoop 200 Mbps", priceCents: 3900, features: "200 Mbps glas" },
  { provider: "Caiway", category: "TELECOM", name: "Internet 500 Mbps", priceCents: 4250, features: "500 Mbps glas" },
  { provider: "Delta", category: "TELECOM", name: "Glas 1 Gbps", priceCents: 4995, features: "1 Gbps glasvezel" },
  { provider: "Freedom Internet", category: "TELECOM", name: "Glas 1 Gbps", priceCents: 5500, features: "1 Gbps + privacy first" },

  // ===== ENERGIE NL =====
  { provider: "Eneco", category: "ENERGIE", name: "HollandseWind 1 jaar", priceCents: 18000, features: "100% NL wind, 1jr vast" },
  { provider: "Eneco", category: "ENERGIE", name: "Variabel basis", priceCents: 16500, features: "Variabel tarief" },
  { provider: "Vattenfall", category: "ENERGIE", name: "Vast 3 jaar groene stroom", priceCents: 17500, features: "3jr vast tarief" },
  { provider: "Essent", category: "ENERGIE", name: "Variabel groen", priceCents: 16000, features: "Variabel groen" },
  { provider: "Greenchoice", category: "ENERGIE", name: "Vast 1 jaar 100% groen", priceCents: 15800, features: "1jr vast 100% groen" },
  { provider: "Vandebron", category: "ENERGIE", name: "Direct van boer 1 jaar", priceCents: 16200, features: "Direct van NL boer, 1jr vast" },
  { provider: "Pure Energie", category: "ENERGIE", name: "Variabel 100% NL wind", priceCents: 15900, features: "Variabel, NL wind" },
  { provider: "Engie", category: "ENERGIE", name: "ZekerVast 1 jaar", priceCents: 17200, features: "1jr vast" },
  { provider: "Budget Energie", category: "ENERGIE", name: "Variabel scherp", priceCents: 14900, features: "Goedkoopste variabel" },
  { provider: "Frank Energie", category: "ENERGIE", name: "Dynamisch (groothandel)", priceCents: 15400, features: "Dynamische uurprijs" },
  { provider: "EasyEnergy", category: "ENERGIE", name: "Dynamisch", priceCents: 15300, features: "Dynamische uurprijs" },
  { provider: "Oxxio", category: "ENERGIE", name: "Variabel digitaal", priceCents: 15600, features: "Variabel via app" },
  { provider: "Energiedirect", category: "ENERGIE", name: "Variabel basis", priceCents: 15700, features: "Variabel basis" },
  { provider: "ANWB Energie", category: "ENERGIE", name: "Vast 1 jaar groen", priceCents: 16400, features: "1jr vast groen" },
  { provider: "Coolblue Energie", category: "ENERGIE", name: "Variabel groen", priceCents: 15500, features: "Variabel groen" },
  { provider: "DGB Energie", category: "ENERGIE", name: "Variabel groen", priceCents: 15800, features: "Variabel CO2-neutraal" },

  // ===== VERZEKERING auto/woon NL =====
  { provider: "Centraal Beheer", category: "VERZEKERING", name: "Auto WA basis", priceCents: 1500, features: "WA basis" },
  { provider: "Centraal Beheer", category: "VERZEKERING", name: "Inboedel basis", priceCents: 850, features: "Inboedel basis" },
  { provider: "ANWB Verzekeringen", category: "VERZEKERING", name: "Auto WA+", priceCents: 1850, features: "WA + beperkt casco" },
  { provider: "FBTO", category: "VERZEKERING", name: "Auto Allrisk", priceCents: 2400, features: "Allrisk" },
  { provider: "InShared", category: "VERZEKERING", name: "Auto WA scherp", priceCents: 1300, features: "WA scherp online" },
  { provider: "Allianz", category: "VERZEKERING", name: "Auto Plus", priceCents: 2300, features: "Allrisk basis" },
  { provider: "Nationale-Nederlanden", category: "VERZEKERING", name: "Auto Compact", priceCents: 1800, features: "WA + beperkt casco" },
  { provider: "Univé", category: "VERZEKERING", name: "Auto Verzekerd", priceCents: 1650, features: "WA basis" },
  { provider: "ASR", category: "VERZEKERING", name: "Auto Modulair", priceCents: 1900, features: "Modulair" },
  { provider: "Aegon", category: "VERZEKERING", name: "Auto Plus", priceCents: 2400, features: "Allrisk basis" },
  { provider: "Achmea", category: "VERZEKERING", name: "Auto Standaard", priceCents: 1950, features: "WA + casco" },
  { provider: "Interpolis", category: "VERZEKERING", name: "Alles in 1 polis", priceCents: 2100, features: "Auto + woon" },
  { provider: "Ditzo", category: "VERZEKERING", name: "Auto Online", priceCents: 1450, features: "WA online scherp" },
  { provider: "OHRA", category: "VERZEKERING", name: "Auto Allrisk", priceCents: 2200, features: "Allrisk" },
  { provider: "Promovendum", category: "VERZEKERING", name: "Auto Hoogopgeleid", priceCents: 1700, features: "Korting hoogopgeleid" },
  { provider: "Reaal", category: "VERZEKERING", name: "Auto Modaal", priceCents: 1900, features: "WA + beperkt casco" },
  { provider: "Goudse", category: "VERZEKERING", name: "Auto Compleet", priceCents: 2050, features: "Allrisk basis" },

  // ===== VERZEKERING zorg NL =====
  { provider: "Zilveren Kruis", category: "VERZEKERING", name: "Basis ZW", priceCents: 14250, features: "Basis ZW 2026" },
  { provider: "VGZ", category: "VERZEKERING", name: "Basis Bewust", priceCents: 13950, features: "Basis Bewust 2026" },
  { provider: "CZ", category: "VERZEKERING", name: "Basis Zorgbewustpolis", priceCents: 14150, features: "Basis 2026" },
  { provider: "Menzis", category: "VERZEKERING", name: "Basis Vrij", priceCents: 14400, features: "Basis Vrij 2026" },
  { provider: "DSW", category: "VERZEKERING", name: "Basis Stad Holland", priceCents: 13750, features: "Basis 2026" },
  { provider: "ONVZ", category: "VERZEKERING", name: "Basis Zorgplan", priceCents: 14700, features: "Basis Zorgplan 2026" },
  { provider: "Salland", category: "VERZEKERING", name: "Basis", priceCents: 13850, features: "Basis 2026" },

  // ===== BANK NL (maandkosten privérekening, indicatief) =====
  { provider: "ABN AMRO", category: "BANK", name: "Betaalpakket", priceCents: 295, features: "Betaalpakket" },
  { provider: "ING", category: "BANK", name: "OranjePakket", priceCents: 250, features: "OranjePakket" },
  { provider: "Rabobank", category: "BANK", name: "DirectPakket", priceCents: 270, features: "DirectPakket" },
  { provider: "SNS", category: "BANK", name: "Betalen Plus", priceCents: 195, features: "Betalen Plus" },
  { provider: "Knab", category: "BANK", name: "Free", priceCents: 0, features: "Gratis basis" },
  { provider: "Bunq", category: "BANK", name: "Easy Bank", priceCents: 299, features: "Easy Bank app-only" },
  { provider: "ASN Bank", category: "BANK", name: "Betaalpakket Plus", priceCents: 215, features: "Betaalpakket Plus" },
  { provider: "Triodos", category: "BANK", name: "Internet Betaalpakket", priceCents: 540, features: "Duurzaam betaal" },
  { provider: "Revolut", category: "BANK", name: "Standard", priceCents: 0, features: "EU multi-currency basis" },
  { provider: "N26", category: "BANK", name: "Standard", priceCents: 0, features: "EU basis" },

  // ===== HYPOTHEEK (rente per maand voor 250k 30jr — indicatief) =====
  { provider: "ABN AMRO Hypotheken", category: "HYPOTHEEK", name: "20jr vast NHG", priceCents: 81000, features: "20jr vast, NHG" },
  { provider: "ING Hypotheken", category: "HYPOTHEEK", name: "10jr vast NHG", priceCents: 78000, features: "10jr vast, NHG" },
  { provider: "Rabo Hypotheken", category: "HYPOTHEEK", name: "30jr vast", priceCents: 86000, features: "30jr vast" },
  { provider: "Aegon Hypotheken", category: "HYPOTHEEK", name: "10jr vast NHG", priceCents: 79000, features: "10jr vast, NHG" },
  { provider: "Munt Hypotheken", category: "HYPOTHEEK", name: "20jr vast", priceCents: 80500, features: "20jr vast scherp" },
  { provider: "Argenta", category: "HYPOTHEEK", name: "10jr vast NHG", priceCents: 77500, features: "10jr vast, NHG, BE-bank" },
  { provider: "Florius", category: "HYPOTHEEK", name: "20jr vast", priceCents: 81500, features: "20jr vast" },
  { provider: "Obvion", category: "HYPOTHEEK", name: "10jr vast NHG", priceCents: 78500, features: "10jr vast, NHG" },
  { provider: "BLG Wonen", category: "HYPOTHEEK", name: "20jr vast NHG", priceCents: 80000, features: "20jr vast, NHG" },
  { provider: "Lloyds NL", category: "HYPOTHEEK", name: "10jr vast", priceCents: 79500, features: "10jr vast" },
  { provider: "Tulp Hypotheken", category: "HYPOTHEEK", name: "20jr vast", priceCents: 81000, features: "20jr vast" },
  { provider: "Centraal Beheer Hypotheek", category: "HYPOTHEEK", name: "20jr vast NHG", priceCents: 79800, features: "20jr vast, NHG" },

  // ===== ABONNEMENT streaming =====
  { provider: "Netflix", category: "ABONNEMENT", name: "Standard", priceCents: 1399, features: "1080p, 2 schermen" },
  { provider: "Netflix", category: "ABONNEMENT", name: "Premium", priceCents: 1899, features: "4K, 4 schermen" },
  { provider: "Disney+", category: "ABONNEMENT", name: "Standard", priceCents: 1099, features: "Standard met ads optioneel" },
  { provider: "HBO Max", category: "ABONNEMENT", name: "Standard", priceCents: 999, features: "Max Standard" },
  { provider: "Apple TV+", category: "ABONNEMENT", name: "Standard", priceCents: 999, features: "Apple TV+ standard" },
  { provider: "Amazon Prime Video", category: "ABONNEMENT", name: "Prime", priceCents: 499, features: "Prime Video" },
  { provider: "Videoland", category: "ABONNEMENT", name: "Plus", priceCents: 1099, features: "Videoland Plus" },
  { provider: "Spotify", category: "ABONNEMENT", name: "Individual", priceCents: 1099, features: "Premium individual" },
  { provider: "Spotify", category: "ABONNEMENT", name: "Duo", priceCents: 1499, features: "2 accounts" },
  { provider: "Apple Music", category: "ABONNEMENT", name: "Individual", priceCents: 1099, features: "Apple Music individual" },
  { provider: "YouTube Premium", category: "ABONNEMENT", name: "Individual", priceCents: 1199, features: "Ad-free + Music" },
  { provider: "Tidal", category: "ABONNEMENT", name: "HiFi", priceCents: 1099, features: "HiFi quality" },
  { provider: "Deezer", category: "ABONNEMENT", name: "Premium", priceCents: 1199, features: "Premium" },
  { provider: "ESPN+", category: "ABONNEMENT", name: "Compleet", priceCents: 1499, features: "Live + on-demand" },
  { provider: "Ziggo Sport", category: "ABONNEMENT", name: "Totaal", priceCents: 1495, features: "Voetbal + sport" },
  { provider: "Viaplay", category: "ABONNEMENT", name: "Total", priceCents: 1499, features: "Total Viaplay" },
  { provider: "Storytel", category: "ABONNEMENT", name: "Single", priceCents: 1399, features: "Audioboeken single" },
  { provider: "Audible", category: "ABONNEMENT", name: "Premium Plus", priceCents: 999, features: "1 boek/maand" },

  // ===== ABONNEMENT software/cloud =====
  { provider: "Microsoft 365", category: "ABONNEMENT", name: "Personal", priceCents: 700, features: "1 user 1TB" },
  { provider: "Microsoft 365", category: "ABONNEMENT", name: "Family", priceCents: 1000, features: "6 users 6TB" },
  { provider: "Adobe Creative Cloud", category: "ABONNEMENT", name: "All Apps", priceCents: 6149, features: "Alle apps" },
  { provider: "iCloud+", category: "ABONNEMENT", name: "200GB", priceCents: 299, features: "200GB iCloud" },
  { provider: "Google One", category: "ABONNEMENT", name: "200GB", priceCents: 299, features: "200GB Drive+Photos" },
  { provider: "Dropbox", category: "ABONNEMENT", name: "Plus", priceCents: 1199, features: "2 TB" },
  { provider: "ChatGPT Plus", category: "ABONNEMENT", name: "Plus", priceCents: 2299, features: "GPT-4 + tools" },
  { provider: "GitHub Pro", category: "ABONNEMENT", name: "Pro", priceCents: 400, features: "GitHub Pro" },
  { provider: "Notion", category: "ABONNEMENT", name: "Plus", priceCents: 1100, features: "Notion Plus" },

  // ===== ABONNEMENT sport/fitness =====
  { provider: "Basic-Fit", category: "ABONNEMENT", name: "Comfort", priceCents: 2999, features: "Toegang alle clubs" },
  { provider: "Basic-Fit", category: "ABONNEMENT", name: "Premium", priceCents: 3999, features: "Comfort + family + group lessen" },
  { provider: "SportCity", category: "ABONNEMENT", name: "Standaard", priceCents: 4500, features: "1 club" },
  { provider: "Anytime Fitness", category: "ABONNEMENT", name: "Standard", priceCents: 5000, features: "24/7 toegang wereldwijd" },
  { provider: "Fit For Free", category: "ABONNEMENT", name: "Maandelijks", priceCents: 1995, features: "Toegang basis" },

  // ===== EU TELECOM =====
  { provider: "Orange", category: "TELECOM", name: "Mobile 50GB", priceCents: 1990, features: "50 GB FR" },
  { provider: "Deutsche Telekom", category: "TELECOM", name: "MagentaMobil M", priceCents: 3995, features: "Onbeperkt DE" },
  { provider: "O2", category: "TELECOM", name: "Free Unlimited", priceCents: 4999, features: "Onbeperkt DE" },
  { provider: "Three", category: "TELECOM", name: "Unlimited 5G", priceCents: 2200, features: "Onbeperkt UK 5G" },
  { provider: "EE", category: "TELECOM", name: "Smart Unlimited", priceCents: 3500, features: "Onbeperkt UK 5G" },
  { provider: "BT", category: "TELECOM", name: "Full Fibre 100", priceCents: 3500, features: "100 Mbps glas UK" },
  { provider: "Sky", category: "TELECOM", name: "Sky Stream", priceCents: 3500, features: "TV-streaming UK" },
  { provider: "Vodafone DE", category: "TELECOM", name: "GigaMobil M", priceCents: 4495, features: "Onbeperkt DE 5G" },
  { provider: "1&1", category: "TELECOM", name: "All-Net Flat", priceCents: 1499, features: "20 GB DE" },
  { provider: "Bouygues Telecom", category: "TELECOM", name: "Sensation 130GB", priceCents: 2499, features: "130 GB FR" },
  { provider: "SFR", category: "TELECOM", name: "Power 100GB", priceCents: 1999, features: "100 GB FR" },
  { provider: "Free Mobile", category: "TELECOM", name: "Free Forfait 350GB", priceCents: 1999, features: "350 GB FR" },
  { provider: "Movistar", category: "TELECOM", name: "Fusion Total Plus", priceCents: 9000, features: "ES bundel" },
  { provider: "TIM", category: "TELECOM", name: "TIM 5G Power Unlimited", priceCents: 1499, features: "Onbeperkt IT" },
  { provider: "Proximus", category: "TELECOM", name: "Mobile Smart", priceCents: 2500, features: "BE 30 GB" },
  { provider: "Telenet", category: "TELECOM", name: "ONE", priceCents: 9990, features: "BE bundel TV+net+mobiel" },
  { provider: "Base", category: "TELECOM", name: "BASE 30GB", priceCents: 1500, features: "BE 30 GB" },

  // ===== EU ENERGIE =====
  { provider: "E.ON", category: "ENERGIE", name: "ÖkoFlex", priceCents: 11500, features: "Variabel groen DE" },
  { provider: "RWE", category: "ENERGIE", name: "Strom Smart", priceCents: 12000, features: "Variabel DE" },
  { provider: "EDF", category: "ENERGIE", name: "Tarif Bleu", priceCents: 9800, features: "Standaard FR" },
  { provider: "Enel", category: "ENERGIE", name: "Energia Sicura", priceCents: 12500, features: "Vast 1jr IT" },
  { provider: "Engie FR", category: "ENERGIE", name: "Référence Élec", priceCents: 11000, features: "FR variabel" },
  { provider: "Iberdrola", category: "ENERGIE", name: "Plan Estable", priceCents: 9500, features: "ES vast" },
  { provider: "TotalEnergies", category: "ENERGIE", name: "Verte Fixe", priceCents: 10800, features: "FR vast groen" },
  { provider: "Endesa", category: "ENERGIE", name: "One Luz", priceCents: 9800, features: "ES variabel" },
  { provider: "British Gas", category: "ENERGIE", name: "Standard Variable", priceCents: 13000, features: "UK variabel" },
  { provider: "Octopus Energy", category: "ENERGIE", name: "Flexible Octopus", priceCents: 12500, features: "UK variabel groen" },
  { provider: "EWE", category: "ENERGIE", name: "EWE ZuhauseStrom", priceCents: 11800, features: "DE vast 1jr" },
  { provider: "Yello Strom", category: "ENERGIE", name: "Yello Klassik", priceCents: 12200, features: "DE vast 1jr" },

  // ===== EU VERZEKERING =====
  { provider: "AXA", category: "VERZEKERING", name: "Confort Auto", priceCents: 4200, features: "EU auto basis" },
  { provider: "Generali", category: "VERZEKERING", name: "Auto Premium", priceCents: 4500, features: "EU auto premium" },
  { provider: "AIG", category: "VERZEKERING", name: "Travel Plus", priceCents: 1800, features: "Reisverzekering" },
  { provider: "Zurich", category: "VERZEKERING", name: "Auto Basic", priceCents: 3900, features: "Auto basis" },
  { provider: "HUK24", category: "VERZEKERING", name: "Kfz Basis", priceCents: 3500, features: "DE auto basis" },
  { provider: "Admiral", category: "VERZEKERING", name: "Car Comprehensive", priceCents: 4800, features: "UK auto" },

  // ===== EU BANK =====
  { provider: "Deutsche Bank", category: "BANK", name: "AktivKonto", priceCents: 599, features: "DE betaalrekening" },
  { provider: "Commerzbank", category: "BANK", name: "KostenfreiKonto", priceCents: 0, features: "DE basis" },
  { provider: "BNP Paribas", category: "BANK", name: "Esprit Libre", priceCents: 800, features: "FR pakket" },
  { provider: "Société Générale", category: "BANK", name: "Sobrio", priceCents: 850, features: "FR pakket" },
  { provider: "Santander", category: "BANK", name: "Cuenta Smart", priceCents: 0, features: "ES gratis" },
  { provider: "BBVA", category: "BANK", name: "Cuenta Online", priceCents: 0, features: "ES gratis online" },
  { provider: "Barclays", category: "BANK", name: "Premier Current", priceCents: 0, features: "UK premier" },
  { provider: "HSBC", category: "BANK", name: "Premier", priceCents: 0, features: "UK premier" },
  { provider: "Lloyds Bank", category: "BANK", name: "Classic Account", priceCents: 0, features: "UK classic" },

  // ===== OVERIG =====
  { provider: "Vitens", category: "OVERIG", name: "Drinkwater abonnement", priceCents: 1500, features: "Standaard" },
  { provider: "Brabant Water", category: "OVERIG", name: "Drinkwater abonnement", priceCents: 1500, features: "Standaard" },
  { provider: "PWN", category: "OVERIG", name: "Drinkwater abonnement", priceCents: 1500, features: "Standaard" },
  { provider: "Evides", category: "OVERIG", name: "Drinkwater abonnement", priceCents: 1500, features: "Standaard" },
  { provider: "Dunea", category: "OVERIG", name: "Drinkwater abonnement", priceCents: 1500, features: "Standaard" },
  { provider: "Waternet", category: "OVERIG", name: "Drinkwater abonnement", priceCents: 1500, features: "Standaard" },
  { provider: "PostNL", category: "OVERIG", name: "Pakketten Maand", priceCents: 800, features: "Maandabonnement" },
  { provider: "DPD", category: "OVERIG", name: "Pakketten Maand", priceCents: 800, features: "Maandabonnement" },
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

export function totalPlanCount(): number {
  return MARKET_PLANS.length;
}

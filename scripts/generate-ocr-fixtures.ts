/**
 * scripts/generate-ocr-fixtures.ts
 *
 * Generates 30 synthetic single-page PDF bill fixtures under
 * tests/fixtures/bills/. Each gets a paired .expected.json with the
 * ground-truth provider/amount/category/country. Real bills can't be
 * shipped in OSS for privacy reasons, so these are plausible look-alikes
 * built from the public-domain layout-only.
 *
 * Run once:
 *   npx tsx scripts/generate-ocr-fixtures.ts
 */

export {};

import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(__dirname, "../tests/fixtures/bills");
fs.mkdirSync(OUT, { recursive: true });

type Spec = {
  slug: string;
  provider: string;
  category: "TELECOM" | "ENERGIE" | "VERZEKERING" | "BANK";
  country: "NL" | "DE" | "UK" | "US";
  monthlyEur: number;
  totalEur?: number;
  plan?: string;
  period?: string;
  customerNumber: string;
};

const SPECS: Spec[] = [
  // NL telecom (6)
  { slug: "nl-tel-kpn", provider: "KPN", category: "TELECOM", country: "NL", monthlyEur: 29.65, plan: "Compleet", period: "mei 2026", customerNumber: "12345678" },
  { slug: "nl-tel-vodafone", provider: "Vodafone", category: "TELECOM", country: "NL", monthlyEur: 28.50, plan: "Red Unlimited", period: "mei 2026", customerNumber: "87654321" },
  { slug: "nl-tel-odido", provider: "Odido", category: "TELECOM", country: "NL", monthlyEur: 24.95, plan: "Onbeperkt", period: "mei 2026", customerNumber: "10101010" },
  { slug: "nl-tel-ziggo", provider: "Ziggo", category: "TELECOM", country: "NL", monthlyEur: 43.95, plan: "Internet+TV", period: "mei 2026", customerNumber: "20202020" },
  { slug: "nl-tel-tele2", provider: "Tele2", category: "TELECOM", country: "NL", monthlyEur: 19.50, plan: "Mobiel", period: "mei 2026", customerNumber: "30303030" },
  { slug: "nl-tel-budget", provider: "Budget Mobiel", category: "TELECOM", country: "NL", monthlyEur: 12.99, plan: "Sim Only", period: "mei 2026", customerNumber: "40404040" },
  // NL energie (6)
  { slug: "nl-ene-eneco", provider: "Eneco", category: "ENERGIE", country: "NL", monthlyEur: 185.00, plan: "Variabel", period: "april 2026", customerNumber: "50505050" },
  { slug: "nl-ene-vattenfall", provider: "Vattenfall", category: "ENERGIE", country: "NL", monthlyEur: 175.50, plan: "Vast 1 jaar", period: "april 2026", customerNumber: "60606060" },
  { slug: "nl-ene-greenchoice", provider: "Greenchoice", category: "ENERGIE", country: "NL", monthlyEur: 142.30, plan: "Groen Vast", period: "april 2026", customerNumber: "70707070" },
  { slug: "nl-ene-nle", provider: "Nederlandse Energie Maatschappij", category: "ENERGIE", country: "NL", monthlyEur: 159.95, plan: "Voordeel", period: "april 2026", customerNumber: "80808080" },
  { slug: "nl-ene-budget", provider: "Budget Energie", category: "ENERGIE", country: "NL", monthlyEur: 168.50, plan: "Variabel", period: "april 2026", customerNumber: "90909090" },
  { slug: "nl-ene-coolblue", provider: "Coolblue Energie", category: "ENERGIE", country: "NL", monthlyEur: 152.00, plan: "Stroom+Gas", period: "april 2026", customerNumber: "11111111" },
  // NL verzekering (4)
  { slug: "nl-verz-centraal", provider: "Centraal Beheer", category: "VERZEKERING", country: "NL", monthlyEur: 28.90, plan: "WA+ Polo", period: "mei 2026", customerNumber: "X1234567" },
  { slug: "nl-verz-unive", provider: "Univé", category: "VERZEKERING", country: "NL", monthlyEur: 26.50, plan: "WA+ Golf", period: "mei 2026", customerNumber: "X2234567" },
  { slug: "nl-verz-fbto", provider: "FBTO", category: "VERZEKERING", country: "NL", monthlyEur: 22.80, plan: "Allrisk Modulair", period: "mei 2026", customerNumber: "X3234567" },
  { slug: "nl-verz-achmea", provider: "Achmea", category: "VERZEKERING", country: "NL", monthlyEur: 31.40, plan: "WA Casco", period: "mei 2026", customerNumber: "X4234567" },
  // NL bank (4)
  { slug: "nl-bank-abn", provider: "ABN AMRO", category: "BANK", country: "NL", monthlyEur: 3.30, plan: "Betaalpakket", period: "mei 2026", customerNumber: "NL12ABNA0123456789" },
  { slug: "nl-bank-ing", provider: "ING", category: "BANK", country: "NL", monthlyEur: 2.95, plan: "Oranje Pakket", period: "mei 2026", customerNumber: "NL12INGB0123456789" },
  { slug: "nl-bank-rabo", provider: "Rabobank", category: "BANK", country: "NL", monthlyEur: 3.75, plan: "DirectPakket", period: "mei 2026", customerNumber: "NL12RABO0123456789" },
  { slug: "nl-bank-bunq", provider: "bunq", category: "BANK", country: "NL", monthlyEur: 8.99, plan: "Easy Bank", period: "mei 2026", customerNumber: "NL12BUNQ0123456789" },
  // DE (4)
  { slug: "de-tel-telekom", provider: "Telekom", category: "TELECOM", country: "DE", monthlyEur: 39.95, plan: "MagentaMobil", period: "Mai 2026", customerNumber: "K-123456789" },
  { slug: "de-tel-vodafone", provider: "Vodafone", category: "TELECOM", country: "DE", monthlyEur: 32.99, plan: "Red M", period: "Mai 2026", customerNumber: "VK-987654" },
  { slug: "de-ene-eon", provider: "E.ON", category: "ENERGIE", country: "DE", monthlyEur: 145.00, plan: "Strom Fix", period: "Mai 2026", customerNumber: "E-1122334" },
  { slug: "de-ene-rwe", provider: "RWE", category: "ENERGIE", country: "DE", monthlyEur: 138.50, plan: "Strom Klassik", period: "Mai 2026", customerNumber: "R-5566778" },
  // UK (3)
  { slug: "uk-tel-bt", provider: "BT", category: "TELECOM", country: "UK", monthlyEur: 35.00, plan: "Fibre 100", period: "May 2026", customerNumber: "BT-9988776" },
  { slug: "uk-tel-sky", provider: "Sky", category: "TELECOM", country: "UK", monthlyEur: 42.00, plan: "Superfast", period: "May 2026", customerNumber: "SKY-554433" },
  { slug: "uk-ene-britgas", provider: "British Gas", category: "ENERGIE", country: "UK", monthlyEur: 120.00, plan: "Fixed", period: "May 2026", customerNumber: "BG-887766" },
  // US (3)
  { slug: "us-tel-verizon", provider: "Verizon", category: "TELECOM", country: "US", monthlyEur: 70.00, plan: "Unlimited Plus", period: "May 2026", customerNumber: "VZN-1234567" },
  { slug: "us-tel-att", provider: "AT&T", category: "TELECOM", country: "US", monthlyEur: 65.00, plan: "Premium", period: "May 2026", customerNumber: "ATT-7654321" },
  { slug: "us-tel-comcast", provider: "Comcast", category: "TELECOM", country: "US", monthlyEur: 75.00, plan: "Xfinity Gigabit", period: "May 2026", customerNumber: "CMC-9988776" },
];

function makePdf(spec: Spec): Buffer {
  const cur = spec.country === "UK" ? "GBP" : spec.country === "US" ? "USD" : "EUR";
  const sign = spec.country === "UK" ? "GBP" : spec.country === "US" ? "USD" : "EUR";
  const monthly = spec.monthlyEur.toFixed(2).replace(".", ",");
  const total = (spec.totalEur ?? spec.monthlyEur).toFixed(2).replace(".", ",");
  const lines = [
    `${spec.provider} — Factuur`,
    `Klantnummer: ${spec.customerNumber}`,
    `Periode: ${spec.period}`,
    `Pakket: ${spec.plan}`,
    `Land: ${spec.country}`,
    `Maandbedrag: ${sign} ${monthly}`,
    `Totaal: ${sign} ${total}`,
    `Valuta: ${cur}`,
  ];

  // Build a hand-rolled PDF stream with each line at decreasing y
  const streamCommands = lines
    .map((l, i) => `BT /F1 11 Tf 50 ${750 - i * 22} Td (${l.replace(/[()\\]/g, (m) => `\\${m}`)}) Tj ET`)
    .join("\n");
  const stream = streamCommands;
  const streamLength = Buffer.byteLength(stream, "utf-8");
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${streamLength}>>stream
${stream}
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000110 00000 n
0000000220 00000 n
0000000${800 + streamLength} 00000 n
trailer<</Size 6/Root 1 0 R>>
startxref
${850 + streamLength}
%%EOF
`;
  return Buffer.from(pdf);
}

function main() {
  for (const spec of SPECS) {
    const pdf = makePdf(spec);
    fs.writeFileSync(path.join(OUT, `${spec.slug}.pdf`), pdf);
    const expected = {
      provider: spec.provider,
      monthlyCents: Math.round(spec.monthlyEur * 100),
      totalCents: Math.round((spec.totalEur ?? spec.monthlyEur) * 100),
      category: spec.category,
      country: spec.country,
    };
    fs.writeFileSync(
      path.join(OUT, `${spec.slug}.expected.json`),
      JSON.stringify(expected, null, 2) + "\n",
    );
  }
  console.log(`Generated ${SPECS.length} fixtures in ${OUT}`);
}

main();

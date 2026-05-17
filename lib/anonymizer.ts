/**
 * lib/anonymizer.ts — PII scrubber for OCR training samples.
 *
 * Strips: NL/BE/DE/FR/UK names (best-effort by heuristic), full
 * addresses, IBANs, phone numbers, e-mail addresses, customer numbers.
 * Replaces with stable placeholder tokens so downstream label-shape
 * stays intact.
 */

const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,3}\d{2,4}/g;
const POSTCODE_NL_RE = /\b\d{4}\s?[A-Z]{2}\b/g;
const CUSTNUM_RE = /(?:klant(?:nummer|nr|id)|customer(?:\s|-)?(?:number|id|nr)|kundennummer|nº?\s?client|account\s?(?:number|nr))\s*[:#]?\s*(\d{4,20})/gi;
// Capitalised name guesses — Dutch + most Western: "Jan Janssen", "Pieter de Boer"
const NAME_RE = /\b[A-Z][a-zà-ÿ']{2,}(?:\s+(?:van\s|de\s|der\s|den\s|von\s)?[A-Z][a-zà-ÿ']{2,}){1,3}\b/g;

const WHITELIST_NAME_TOKENS = new Set([
  "Nederland", "Amsterdam", "Rotterdam", "Den Haag", "Utrecht", "Eindhoven",
  "KPN", "Vodafone", "Ziggo", "Eneco", "Vattenfall", "Essent", "Greenchoice",
  "Allianz", "Centraal Beheer", "FBTO", "Univ", "Inshared", "Nationale",
  "Tele2", "Odido", "T-Mobile", "Aegon", "Promovendum", "Frank Energie",
  "Pure Energie", "Vandebron", "Engie", "OHRA", "Achmea", "Interpolis",
  "Reaal", "ASR", "Ditzo",
]);

function maskName(s: string): string {
  // Keep brand-name tokens untouched
  for (const w of WHITELIST_NAME_TOKENS) {
    if (s.includes(w)) return s;
  }
  return "<NAME>";
}

export function anonymizeText(input: string): string {
  if (!input) return "";
  let out = input;
  out = out.replace(EMAIL_RE, "<EMAIL>");
  out = out.replace(IBAN_RE, "<IBAN>");
  out = out.replace(POSTCODE_NL_RE, "<POSTCODE>");
  out = out.replace(CUSTNUM_RE, (_full, n) => `<CUSTNR=${"x".repeat(String(n).length)}>`);
  out = out.replace(PHONE_RE, "<PHONE>");
  out = out.replace(NAME_RE, maskName);
  return out;
}

export type StructuredExtract = {
  provider?: string | null;
  category?: string | null;
  amountCents?: number | null;
  monthlyAmountCents?: number | null;
  totalAmountCents?: number | null;
  plan?: string | null;
  period?: string | null;
  customerNumber?: string | null;
  language?: string | null;
  country?: string | null;
  rawText?: string | null;
};

export function anonymizeStructured(s: StructuredExtract): Omit<StructuredExtract, "customerNumber" | "rawText"> & {
  rawText?: string;
} {
  return {
    provider: s.provider ?? null,
    category: s.category ?? null,
    amountCents: s.amountCents ?? null,
    monthlyAmountCents: s.monthlyAmountCents ?? null,
    totalAmountCents: s.totalAmountCents ?? null,
    plan: s.plan ?? null,
    period: s.period ?? null,
    language: s.language ?? null,
    country: s.country ?? null,
    rawText: s.rawText ? anonymizeText(s.rawText) : undefined,
    // customerNumber explicitly dropped — never train on it
  };
}

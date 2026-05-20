/**
 * lib/contract-end.ts — derive a contract-end date for the renewal radar.
 *
 * Strategy:
 *   1. Detect an explicit end-date in the OCR text ("contract loopt tot …",
 *      "einde looptijd …", "tot en met …", "verloopt op …").
 *   2. Else estimate invoiceDate + 12 months (the common NL contract term),
 *      flagged as an estimate.
 *   3. Else null (no alert).
 */

const MONTHS_NL: Record<string, number> = {
  jan: 0, januari: 0, feb: 1, februari: 1, mrt: 2, maart: 2, apr: 3, april: 3,
  mei: 4, jun: 5, juni: 5, jul: 6, juli: 6, aug: 7, augustus: 7,
  sep: 8, sept: 8, september: 8, okt: 9, oktober: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

/** Parse a NL date in dd-mm-yyyy / dd/mm/yyyy or "12 januari 2027" form. */
export function parseNlDate(s: string): Date | null {
  const numeric = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (numeric) {
    const d = Number(numeric[1]);
    const m = Number(numeric[2]) - 1;
    let y = Number(numeric[3]);
    if (y < 100) y += 2000;
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      const dt = new Date(Date.UTC(y, m, d));
      return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  }
  const named = s.match(/(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/i);
  if (named) {
    const d = Number(named[1]);
    const m = MONTHS_NL[named[2].toLowerCase()];
    const y = Number(named[3]);
    if (m != null && d >= 1 && d <= 31) {
      const dt = new Date(Date.UTC(y, m, d));
      return isNaN(dt.getTime()) ? null : dt;
    }
  }
  return null;
}

const DATE_FRAGMENT = "(\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}|\\d{1,2}\\s+[a-zA-Z]+\\.?\\s+\\d{4})";
const END_PHRASES = [
  `contract\\s+loopt\\s+(?:nog\\s+)?tot(?:\\s+en\\s+met)?\\s+${DATE_FRAGMENT}`,
  `einde\\s+looptijd[:\\s]+${DATE_FRAGMENT}`,
  `looptijd\\s+tot(?:\\s+en\\s+met)?[:\\s]+${DATE_FRAGMENT}`,
  `contract(?:duur|periode)?\\s+tot(?:\\s+en\\s+met)?[:\\s]+${DATE_FRAGMENT}`,
  `verloopt\\s+(?:op|per)\\s+${DATE_FRAGMENT}`,
  `(?:einddatum|opzegdatum)[:\\s]+${DATE_FRAGMENT}`,
];

export type ContractEnd = { date: Date | null; estimated: boolean };

export function contractEndFromOcr(opts: {
  rawText: string | null | undefined;
  invoiceDate: Date | null;
}): ContractEnd {
  const text = opts.rawText ?? "";
  for (const phrase of END_PHRASES) {
    const m = new RegExp(phrase, "i").exec(text);
    if (m && m[1]) {
      const parsed = parseNlDate(m[1]);
      if (parsed) return { date: parsed, estimated: false };
    }
  }
  // Estimate: 12 months after the invoice date (typical NL contract term).
  if (opts.invoiceDate) {
    const d = new Date(opts.invoiceDate);
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return { date: d, estimated: true };
  }
  return { date: null, estimated: false };
}

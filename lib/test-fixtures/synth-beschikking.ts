/**
 * lib/test-fixtures/synth-beschikking.ts — v34 synthetische Belastingdienst-
 * beschikking-PDF voor OCR-tests.
 *
 * Bouwt een minimale, valide PDF 1.4 met Helvetica + WinAnsiEncoding. We
 * vermijden bewust het "€"-glyph (zou byte 0x80 vereisen i.c.m. WinAnsi):
 * de regex-parser in lib/box3-claim.ts accepteert óók "EUR 1234,56" zonder
 * symbool, en Belastingdienst-beschikkingen mixen in praktijk "€" en "EUR".
 *
 * Géén nieuwe dependencies — pdf-lib/canvas/PDFKit zijn niet geïnstalleerd
 * en de PDF-spec is simpel genoeg om in ~80 regels te genereren.
 *
 * Geconsumeerd door: tests/box3-ocr.test.ts
 */

export type BeschikkingScenario =
  | { kind: "happy"; jaar: number; toegekendCents: number }
  | { kind: "no-amount"; jaar: number; bodyLines?: string[] }
  | { kind: "below-gate"; jaar: number; toegekendCents: number }; // < € 500

function fmtNlEur(cents: number): string {
  // "1.234,56" — NL-format zonder symbool. Negatief blijft eerlijk.
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  const euroStr = euros.toLocaleString("nl-NL").replace(/ /g, " ");
  return `${sign}${euroStr},${String(rest).padStart(2, "0")}`;
}

/**
 * Escape voor PDF string literals: backslash, paren, en non-printable bytes.
 * We blijven binnen WinAnsi/ASCII en raken hier dus alleen ()/\.
 */
function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Bouw één-pagina PDF 1.4 met de gegeven tekst-regels. */
function buildPdf(lines: string[]): Buffer {
  // Per regel een Tj-operator. Helvetica @ 12pt op A4 (595 × 842).
  const stream = [
    "BT",
    "/F1 12 Tf",
    "50 800 Td", // start positie op de pagina
    ...lines.flatMap((ln, i) => {
      const prefix = i === 0 ? "" : "0 -20 Td "; // 20pt regel-hoogte
      return [`${prefix}(${pdfEscape(ln)}) Tj`];
    }),
    "ET",
    "",
  ].join("\n");
  const streamBytes = Buffer.from(stream, "binary");

  const objects: string[] = [];
  // OBJ 1 — Catalog
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  // OBJ 2 — Pages root
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  // OBJ 3 — Page
  objects.push(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
  );
  // OBJ 4 — Content stream (length = stream bytes)
  // OBJ 5 — Font (Helvetica, WinAnsi)

  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const chunks: Buffer[] = [];
  const offsets: number[] = []; // 1-indexed in xref
  let pos = Buffer.byteLength(header, "binary");
  chunks.push(Buffer.from(header, "binary"));

  function pushObj(n: number, body: Buffer): void {
    offsets[n] = pos;
    const start = Buffer.from(`${n} 0 obj\n`, "binary");
    const end = Buffer.from(`\nendobj\n`, "binary");
    chunks.push(start, body, end);
    pos += start.length + body.length + end.length;
  }

  pushObj(1, Buffer.from(objects[0], "binary"));
  pushObj(2, Buffer.from(objects[1], "binary"));
  pushObj(3, Buffer.from(objects[2], "binary"));

  // OBJ 4 — content stream
  const dictBuf = Buffer.from(`<< /Length ${streamBytes.length} >>\nstream\n`, "binary");
  const tailBuf = Buffer.from(`\nendstream`, "binary");
  const obj4Body = Buffer.concat([dictBuf, streamBytes, tailBuf]);
  pushObj(4, obj4Body);

  // OBJ 5 — Helvetica
  pushObj(
    5,
    Buffer.from(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "binary",
    ),
  );

  // xref
  const xrefOffset = pos;
  const xrefLines: string[] = [];
  xrefLines.push("xref");
  xrefLines.push("0 6");
  xrefLines.push("0000000000 65535 f ");
  for (let i = 1; i <= 5; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }
  const xref = Buffer.from(xrefLines.join("\n") + "\n", "binary");
  chunks.push(xref);

  // trailer
  const trailer = Buffer.from(
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    "binary",
  );
  chunks.push(trailer);

  return Buffer.concat(chunks);
}

/**
 * Bouw een synthetische Belastingdienst-beschikking-PDF voor het opgegeven
 * scenario. Retourneert een Buffer die direct naar `extractPdfText()` mag.
 */
export function buildSyntheticBeschikkingPdf(scenario: BeschikkingScenario): Buffer {
  if (scenario.kind === "happy" || scenario.kind === "below-gate") {
    const eur = fmtNlEur(scenario.toegekendCents);
    const lines = [
      `Voorlopige aanslag inkomstenbelasting ${scenario.jaar}`,
      `Beslissing op uw bezwaar Box 3-rechtsherstel`,
      ``,
      `Toegekend bedrag: EUR ${eur}`,
      `Te ontvangen: EUR ${eur}`,
      ``,
      `De vermindering wordt binnen 6 weken op uw rekening overgemaakt.`,
    ];
    return buildPdf(lines);
  }
  // no-amount: realistische lege beschikking-tekst zonder herkenbaar bedrag
  const lines = scenario.bodyLines ?? [
    `Voorlopige aanslag inkomstenbelasting ${scenario.jaar}`,
    `Uw bezwaar is in behandeling genomen.`,
    `U ontvangt nader bericht zodra de beslissing is verwerkt.`,
  ];
  return buildPdf(lines);
}

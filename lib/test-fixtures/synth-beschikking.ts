/**
 * lib/test-fixtures/synth-beschikking.ts — v34/v36 synthetische
 * Belastingdienst-beschikking-PDF voor OCR-tests.
 *
 * Bouwt een minimale, valide PDF 1.4 met Helvetica + WinAnsiEncoding.
 * Géén nieuwe dependencies — geen pdf-lib / pdf-kit / canvas — pure
 * PDF-spec-bytes (catalog, pages, page(s), content-stream(s), font,
 * xref, trailer). Werkt met pdfjs-dist legacy build via lib/pdf_extract.
 *
 * Geconsumeerd door: tests/box3-ocr.test.ts
 *
 * V36 DEEL 4 uitbreidingen:
 *  - "multi-page" scenario (totaalbedrag op pagina 1, specs op pagina 2)
 *  - "decimal-comma-only" scenario (geen thousands-separator)
 *  - "euro-symbol" scenario (rendert € via WinAnsi byte 0x80)
 */

/** WinAnsiEncoding mapt byte 0x80 op het € teken. Schrijven we als raw byte. */
const EURO_WINANSI = "\x80";

export type BeschikkingScenario =
  | { kind: "happy"; jaar: number; toegekendCents: number }
  | { kind: "no-amount"; jaar: number; bodyLines?: string[] }
  | { kind: "below-gate"; jaar: number; toegekendCents: number } // < € 500
  // v36 — robustness variaties:
  | { kind: "multi-page"; jaar: number; toegekendCents: number }
  | { kind: "decimal-comma-only"; jaar: number; toegekendCents: number }
  | { kind: "euro-symbol"; jaar: number; toegekendCents: number };

/**
 * NL-bedrag-formatter met thousands-separator (1.234,56).
 */
function fmtNlEur(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  const euroStr = euros.toLocaleString("nl-NL").replace(/ /g, " ");
  return `${sign}${euroStr},${String(rest).padStart(2, "0")}`;
}

/**
 * NL-bedrag ZONDER thousands-separator (1234,56) — typisch in
 * compute-output van administratiesystemen.
 */
function fmtNlEurNoThousands(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  return `${sign}${euros},${String(rest).padStart(2, "0")}`;
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Bouw één content-stream voor de gegeven regels van één pagina. */
function pageContentStream(lines: string[]): Buffer {
  const stream = [
    "BT",
    "/F1 12 Tf",
    "50 800 Td",
    ...lines.flatMap((ln, i) => {
      const prefix = i === 0 ? "" : "0 -20 Td ";
      return [`${prefix}(${pdfEscape(ln)}) Tj`];
    }),
    "ET",
    "",
  ].join("\n");
  return Buffer.from(stream, "binary");
}

/**
 * Bouw een PDF 1.4 met N pagina's. Élke `pages[i]` is de lijst regels voor
 * pagina i. Object-layout:
 *   1. Catalog
 *   2. Pages (Kids = [3, 5, 7, ...] N pages)
 *   3, 5, 7, ...   Page object i
 *   4, 6, 8, ...   Content stream voor pagina i
 *   2N+3. Font
 */
function buildPdf(pages: string[][]): Buffer {
  if (pages.length === 0) throw new Error("at least 1 page required");
  const n = pages.length;
  const fontObjNum = 3 + 2 * n;
  const pageObjNums = Array.from({ length: n }, (_, i) => 3 + i * 2);
  const contentObjNums = Array.from({ length: n }, (_, i) => 4 + i * 2);

  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const chunks: Buffer[] = [];
  const offsets: number[] = []; // 1-indexed in xref
  let pos = Buffer.byteLength(header, "binary");
  chunks.push(Buffer.from(header, "binary"));

  function pushObj(num: number, body: Buffer): void {
    offsets[num] = pos;
    const start = Buffer.from(`${num} 0 obj\n`, "binary");
    const end = Buffer.from(`\nendobj\n`, "binary");
    chunks.push(start, body, end);
    pos += start.length + body.length + end.length;
  }

  // OBJ 1 — Catalog
  pushObj(1, Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "binary"));
  // OBJ 2 — Pages root
  const kidsStr = pageObjNums.map((k) => `${k} 0 R`).join(" ");
  pushObj(
    2,
    Buffer.from(`<< /Type /Pages /Kids [${kidsStr}] /Count ${n} >>`, "binary"),
  );

  for (let i = 0; i < n; i++) {
    const pageNum = pageObjNums[i];
    const contentNum = contentObjNums[i];
    // Page object
    pushObj(
      pageNum,
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentNum} 0 R >>`,
        "binary",
      ),
    );
    // Content stream
    const streamBytes = pageContentStream(pages[i]);
    const dictBuf = Buffer.from(`<< /Length ${streamBytes.length} >>\nstream\n`, "binary");
    const tailBuf = Buffer.from(`\nendstream`, "binary");
    pushObj(contentNum, Buffer.concat([dictBuf, streamBytes, tailBuf]));
  }

  // Font (Helvetica, WinAnsi)
  pushObj(
    fontObjNum,
    Buffer.from(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "binary",
    ),
  );

  // xref
  const xrefOffset = pos;
  const totalObjects = fontObjNum + 1; // +1 for the free-list entry 0
  const xrefLines: string[] = [];
  xrefLines.push("xref");
  xrefLines.push(`0 ${totalObjects}`);
  xrefLines.push("0000000000 65535 f ");
  for (let i = 1; i < totalObjects; i++) {
    xrefLines.push(`${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n `);
  }
  chunks.push(Buffer.from(xrefLines.join("\n") + "\n", "binary"));

  // Trailer
  chunks.push(
    Buffer.from(
      `trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
      "binary",
    ),
  );

  return Buffer.concat(chunks);
}

/**
 * Bouw een synthetische Belastingdienst-beschikking-PDF voor het opgegeven
 * scenario. Retourneert een Buffer die direct naar `extractPdfText()` mag.
 */
export function buildSyntheticBeschikkingPdf(scenario: BeschikkingScenario): Buffer {
  if (scenario.kind === "happy" || scenario.kind === "below-gate") {
    const eur = fmtNlEur(scenario.toegekendCents);
    return buildPdf([
      [
        `Voorlopige aanslag inkomstenbelasting ${scenario.jaar}`,
        `Beslissing op uw bezwaar Box 3-rechtsherstel`,
        ``,
        `Toegekend bedrag: EUR ${eur}`,
        `Te ontvangen: EUR ${eur}`,
        ``,
        `De vermindering wordt binnen 6 weken op uw rekening overgemaakt.`,
      ],
    ]);
  }
  if (scenario.kind === "no-amount") {
    const lines = scenario.bodyLines ?? [
      `Voorlopige aanslag inkomstenbelasting ${scenario.jaar}`,
      `Uw bezwaar is in behandeling genomen.`,
      `U ontvangt nader bericht zodra de beslissing is verwerkt.`,
    ];
    return buildPdf([lines]);
  }
  if (scenario.kind === "multi-page") {
    // Belastingdienst-beschikkingen splitsen soms over meerdere pagina's:
    // pagina 1 = samenvatting + totaalbedrag, pagina 2 = berekening-specs.
    // De parser moet het Toegekend-bedrag op pagina 1 of pagina 2 vinden —
    // pdfjs extract concatenates de pagina's, dus beide patterns zijn OK.
    const eur = fmtNlEur(scenario.toegekendCents);
    return buildPdf([
      [
        `Beschikking Belastingdienst — overzicht`,
        `Voorlopige aanslag inkomstenbelasting ${scenario.jaar}`,
        ``,
        `Zie pagina 2 voor de uitgebreide berekening.`,
        ``,
        `Toegekend bedrag: EUR ${eur}`,
      ],
      [
        `Berekening Box 3-rechtsherstel ${scenario.jaar}`,
        ``,
        `Banktegoeden:           EUR 200000,00`,
        `Overige bezittingen:    EUR 0,00`,
        `Schulden:               EUR 0,00`,
        `Werkelijk rendement:    EUR 0,00`,
        ``,
        `Vermindering box 3: ${eur}`,
      ],
    ]);
  }
  if (scenario.kind === "decimal-comma-only") {
    // Sommige Belastingdienst-output gebruikt geen thousands-separator:
    // "1234,56" i.p.v. "1.234,56". De regex MOET beide accepteren.
    const eur = fmtNlEurNoThousands(scenario.toegekendCents);
    return buildPdf([
      [
        `Voorlopige aanslag inkomstenbelasting ${scenario.jaar}`,
        `Beslissing op uw bezwaar Box 3-rechtsherstel`,
        ``,
        `Toegekend bedrag: ${eur} euro`,
        `Te ontvangen: ${eur}`,
      ],
    ]);
  }
  // scenario.kind === "euro-symbol"
  // Géén "EUR" of "euro" — alleen het € teken (WinAnsi byte 0x80).
  const eur = fmtNlEur(scenario.toegekendCents);
  return buildPdf([
    [
      `Voorlopige aanslag inkomstenbelasting ${scenario.jaar}`,
      `Beslissing op uw bezwaar Box 3-rechtsherstel`,
      ``,
      // EURO_WINANSI = byte 0x80; pdfjs decodeert dit naar Unicode €.
      `Toegekend bedrag: ${EURO_WINANSI} ${eur}`,
      `Te ontvangen: ${EURO_WINANSI} ${eur}`,
    ],
  ]);
}

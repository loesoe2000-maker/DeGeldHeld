/**
 * lib/pdf_extract.ts — PDF tekst-extractie via pdfjs-dist legacy build.
 *
 * Werkt zonder canvas/native binaries — pure Node, dus Vercel-veilig.
 * Voor scan-PDFs (afbeelding in PDF gevangen) geeft pdfjs lege tekst —
 * dan vallen we hogerop terug op vision via Groq-image.
 *
 * v12: leest tot MAX_PDF_PAGES (5) pagina's. Jaarafrekeningen (Eneco
 * warmte e.d.) hebben het totaalbedrag op pagina 1 maar specificatie
 * verspreid over pagina 2-7. Cost-guard: max 5 pagina's, warning op
 * grotere PDFs (logging tot Sentry).
 */

import * as Sentry from "@sentry/nextjs";

/** Hard limit op aantal pagina's per OCR-call (cost-guard). */
export const MAX_PDF_PAGES = 5;

export type PdfText = {
  ok: boolean;
  text: string;
  /** Total pages in the PDF. */
  pages: number;
  /** Pages we actually extracted text from (capped at MAX_PDF_PAGES). */
  extractedPages: number;
  /** True when we could not extract any text content (likely scan-pdf). */
  empty: boolean;
  /** True when the PDF had more pages than MAX_PDF_PAGES so we truncated. */
  truncated: boolean;
  /** v18: true when the PDF is password/permission protected. */
  passwordProtected?: boolean;
  error?: string;
};

/** pdfjs throws a PasswordException (name) when a PDF needs a password. */
function isPasswordError(e: unknown): boolean {
  if (!e) return false;
  const name = (e as { name?: string }).name ?? "";
  const msg = (e as Error).message ?? "";
  return name === "PasswordException" || /password/i.test(msg);
}

export async function extractPdfText(buf: Buffer): Promise<PdfText> {
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — legacy build heeft geen formele types
    pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch (e) {
    return {
      ok: false,
      text: "",
      pages: 0,
      extractedPages: 0,
      empty: true,
      truncated: false,
      error: `pdfjs import: ${(e as Error).message}`,
    };
  }
  try {
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buf),
      useSystemFonts: false,
      useWorkerFetch: false,
      isEvalSupported: false,
    } as unknown as Parameters<typeof pdfjs.getDocument>[0]).promise;

    const pageCount = doc.numPages;
    if (pageCount <= 0) {
      // v18: empty / 0-page PDF — bail with a clear marker.
      return {
        ok: false,
        text: "",
        pages: 0,
        extractedPages: 0,
        empty: true,
        truncated: false,
        error: "PDF_EMPTY",
      };
    }
    // v12: read up to MAX_PDF_PAGES — page 1 is always included (summary
    // is usually there); extra pages catch jaarafrekening specifications.
    const maxPages = Math.min(pageCount, MAX_PDF_PAGES);
    const truncated = pageCount > MAX_PDF_PAGES;
    if (truncated) {
      try {
        Sentry.captureMessage(
          `[pdf_extract] truncated ${pageCount}-page PDF to ${MAX_PDF_PAGES} pages`,
          { level: "warning", tags: { module: "pdf_extract" } },
        );
      } catch {
        /* sentry not configured — ignore */
      }
    }
    const chunks: string[] = [];
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const items = (tc.items as Array<{ str?: string }>)
        .map((it) => it.str ?? "")
        .filter((s) => s.length > 0);
      if (items.length === 0) continue;
      // Tag each page so the LLM can reason about cross-page references
      // (jaarafrekening: totaalbedrag op pagina 1, specificatie op p.2+).
      chunks.push(`--- page ${i} ---\n${items.join(" ")}`);
    }
    const text = chunks.join("\n").trim();
    return {
      ok: true,
      text,
      pages: pageCount,
      extractedPages: maxPages,
      empty: text.length < 20,
      truncated,
    };
  } catch (e) {
    return {
      ok: false,
      text: "",
      pages: 0,
      extractedPages: 0,
      empty: true,
      truncated: false,
      passwordProtected: isPasswordError(e),
      error: (e as Error).message,
    };
  }
}

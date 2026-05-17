/**
 * lib/pdf_extract.ts — PDF tekst-extractie via pdfjs-dist legacy build.
 *
 * Werkt zonder canvas/native binaries — pure Node, dus Vercel-veilig.
 * Voor scan-PDFs (afbeelding in PDF gevangen) geeft pdfjs lege tekst —
 * dan vallen we hogerop terug op vision via Groq-image. Voor de overgrote
 * meerderheid factuur-PDFs is dit pad voldoende én sneller dan vision.
 */

export type PdfText = {
  ok: boolean;
  text: string;
  pages: number;
  /** True when we could not extract any text content (likely scan-pdf). */
  empty: boolean;
  error?: string;
};

export async function extractPdfText(buf: Buffer): Promise<PdfText> {
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — legacy build heeft geen formele types
    pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch (e) {
    return { ok: false, text: "", pages: 0, empty: true, error: `pdfjs import: ${(e as Error).message}` };
  }
  try {
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buf),
      useSystemFonts: false,
      useWorkerFetch: false,
      isEvalSupported: false,
    } as unknown as Parameters<typeof pdfjs.getDocument>[0]).promise;

    const pageCount = doc.numPages;
    // Only read page 1 — invoice summaries are almost always on the first page.
    // Multi-page reading would 3x the LLM token cost without recall improvement.
    const maxPages = Math.min(pageCount, 1);
    let out = "";
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const items = (tc.items as Array<{ str?: string }>)
        .map((it) => it.str ?? "")
        .filter((s) => s.length > 0);
      out += items.join(" ") + "\n";
    }
    const text = out.trim();
    return { ok: true, text, pages: pageCount, empty: text.length < 20 };
  } catch (e) {
    return { ok: false, text: "", pages: 0, empty: true, error: (e as Error).message };
  }
}

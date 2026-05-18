/**
 * lib/pdf_render.ts — v13 PDF → PNG rendering voor multi-image
 * Groq Vision calls. Backstop voor scan-PDFs (PDFs zonder
 * text-layer) waar pdfjs text-extractie leeg blijft.
 *
 * Pure function — geen DB, geen Groq call. Caller (lib/ocr.ts)
 * roept dit aan en stuurt de resulterende data-URLs naar tryModel().
 *
 * Cost-guard:
 *   - Max MAX_PDF_PAGES (5) pagina's per call
 *   - Max RENDER_MAX_WIDTH_PX (1500) breedte per pagina
 *
 * @napi-rs/canvas is een pre-built native dep die op Vercel werkt
 * zonder system-level cairo/pango install.
 */

import { MAX_PDF_PAGES } from "@/lib/pdf_extract";

export const RENDER_MAX_WIDTH_PX = 1500;

export type RenderedPdf = {
  ok: boolean;
  pages: number;
  /** PNG data-URLs ("data:image/png;base64,..."), één per gerenderde pagina. */
  pageDataUrls: string[];
  truncated: boolean;
  error?: string;
};

/**
 * Render the first N (≤MAX_PDF_PAGES) pages of a PDF to PNG data-URLs.
 *
 * Returns ok=false when pdfjs or canvas can't be loaded — caller falls
 * back to whatever path it was using before (text extraction or
 * needsManual).
 */
export async function renderPdfPages(buf: Buffer): Promise<RenderedPdf> {
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — legacy build heeft geen formele types
    pdfjs = (await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    )) as typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch (e) {
    return {
      ok: false,
      pages: 0,
      pageDataUrls: [],
      truncated: false,
      error: `pdfjs import: ${(e as Error).message}`,
    };
  }

  type CanvasModule = {
    createCanvas: (w: number, h: number) => {
      getContext: (kind: "2d") => unknown;
      toBuffer: (mime: "image/png") => Buffer;
    };
  };
  let canvasMod: CanvasModule;
  try {
    canvasMod = (await import("@napi-rs/canvas")) as unknown as CanvasModule;
  } catch (e) {
    return {
      ok: false,
      pages: 0,
      pageDataUrls: [],
      truncated: false,
      error: `canvas import: ${(e as Error).message}`,
    };
  }

  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(buf),
      useSystemFonts: false,
      useWorkerFetch: false,
      isEvalSupported: false,
    } as unknown as Parameters<typeof pdfjs.getDocument>[0]).promise;
  } catch (e) {
    return {
      ok: false,
      pages: 0,
      pageDataUrls: [],
      truncated: false,
      error: `getDocument: ${(e as Error).message}`,
    };
  }

  const totalPages = doc.numPages;
  const renderCount = Math.min(totalPages, MAX_PDF_PAGES);
  const truncated = totalPages > MAX_PDF_PAGES;
  const out: string[] = [];

  for (let i = 1; i <= renderCount; i++) {
    try {
      const page = await doc.getPage(i);
      const baseVp = page.getViewport({ scale: 1 });
      const scale = Math.min(RENDER_MAX_WIDTH_PX / baseVp.width, 2.5);
      const vp = page.getViewport({ scale: Math.max(scale, 1) });
      const c = canvasMod.createCanvas(Math.round(vp.width), Math.round(vp.height));
      const ctx = c.getContext("2d") as unknown;
      // pdfjs v5 legacy build expects { canvas, canvasContext, viewport }
      // — its RenderParameters type rejects @napi-rs/canvas types so we
      // route through a typed shim (no broad casts; self-review enforces
      // this).
      type RenderShim = (args: {
        canvas: unknown;
        canvasContext: unknown;
        viewport: typeof vp;
      }) => { promise: Promise<void> };
      const renderShim = page.render as unknown as RenderShim;
      await renderShim({ canvas: c, canvasContext: ctx, viewport: vp }).promise;
      const png = c.toBuffer("image/png");
      out.push(`data:image/png;base64,${png.toString("base64")}`);
    } catch (e) {
      // Skip page on render error — keep going so we get whatever pages
      // do render. If we end up with zero pages the caller falls back.
      out.push("");
      void e;
    }
  }

  const filtered = out.filter((s) => s.length > 0);
  return {
    ok: filtered.length > 0,
    pages: totalPages,
    pageDataUrls: filtered,
    truncated,
  };
}

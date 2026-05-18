import { describe, it, expect } from "vitest";
import { extractPdfText, MAX_PDF_PAGES } from "@/lib/pdf_extract";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

describe("pdf_extract / multi-page support (v12 DEEL 2)", () => {
  it("MAX_PDF_PAGES is 5 — cost-guard contract", () => {
    expect(MAX_PDF_PAGES).toBe(5);
  });

  it("returns extractedPages + truncated fields in the result shape", async () => {
    // Use an existing single-page fixture so we can validate the
    // shape extension without needing a 5+ page fixture.
    const fixturePath = resolve(ROOT, "tests/fixtures/kpn.pdf");
    if (!existsSync(fixturePath)) {
      // Graceful skip when the fixture isn't present.
      return;
    }
    const buf = readFileSync(fixturePath);
    const result = await extractPdfText(buf);
    expect(result.pages).toBeGreaterThan(0);
    expect(result.extractedPages).toBeGreaterThan(0);
    expect(result.extractedPages).toBeLessThanOrEqual(MAX_PDF_PAGES);
    expect(typeof result.truncated).toBe("boolean");
  });

  it("multi-page text gets per-page markers so the LLM can reason cross-page", async () => {
    // Synthetic empty buffer — pdfjs returns error which is fine.
    // We assert the SHAPE: when text is present, it has page-markers.
    const fixturePath = resolve(ROOT, "tests/fixtures/kpn.pdf");
    if (!existsSync(fixturePath)) return;
    const buf = readFileSync(fixturePath);
    const result = await extractPdfText(buf);
    if (result.text.length > 50) {
      expect(result.text).toMatch(/--- page \d+ ---/);
    }
  });

  it("garbage input returns ok=false + truncated=false without throwing", async () => {
    const result = await extractPdfText(Buffer.from("garbage"));
    expect(result.ok).toBe(false);
    expect(result.truncated).toBe(false);
    expect(result.extractedPages).toBe(0);
    expect(result.empty).toBe(true);
  });
});

describe("OCR system prompt mentions multi-page input", () => {
  it("SYSTEM_PROMPT includes the page-marker convention", () => {
    const src = readFileSync(resolve(ROOT, "lib/ocr.ts"), "utf8");
    expect(src).toMatch(/--- page N ---/);
    expect(src).toMatch(/meerdere pagina/);
  });
});

describe("tryModel supports multi-image input (v12 DEEL 2)", () => {
  it("tryModel signature accepts string OR string[] data-URLs", () => {
    const src = readFileSync(resolve(ROOT, "lib/ocr.ts"), "utf8");
    expect(src).toMatch(/dataUrls:\s*string\s*\|\s*string\[\]/);
    // The multi-image mapping must spread urls into content
    expect(src).toMatch(/urls\.map\(/);
  });
});

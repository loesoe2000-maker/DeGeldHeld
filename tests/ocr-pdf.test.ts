import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { extractBill } from "../lib/ocr";
import { extractPdfText } from "../lib/pdf_extract";

describe("pdf_extract: pdfjs text extraction (legacy build)", () => {
  it("extracts text content from a synthetic KPN PDF", async () => {
    const buf = readFileSync(path.resolve(__dirname, "fixtures/kpn.pdf"));
    const r = await extractPdfText(buf);
    expect(r.ok).toBe(true);
    expect(r.empty).toBe(false);
    expect(r.text).toMatch(/KPN/);
    expect(r.text).toMatch(/29,65/);
    expect(r.pages).toBeGreaterThanOrEqual(1);
  });

  it("returns empty=true for non-pdf garbage", async () => {
    const r = await extractPdfText(Buffer.from("not a pdf"));
    expect(r.ok).toBe(false);
    expect(r.empty).toBe(true);
  });
});

describe("extractBill: PDF flow integration", () => {
  it("real KPN PDF: no API key → needsManual but not crashed", async () => {
    const buf = readFileSync(path.resolve(__dirname, "fixtures/kpn.pdf"));
    const r = await extractBill(buf, "application/pdf");
    // Without GROQ_API_KEY tests will hit PDF_OCR_SKIPPED_NO_API_KEY, met API key zou
    // het OK met provider KPN moeten zijn. We accepteren beide paden hier.
    if (r.ok) {
      expect(r.provider).toMatch(/KPN/i);
      expect(r.amountCents).toBeGreaterThan(0);
    } else {
      expect(r.rawText).toMatch(/PDF_(OCR_SKIPPED|LLM_ERR|PARSE_LOW_CONFIDENCE)/);
      expect(r.imageHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

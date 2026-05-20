import { describe, it, expect } from "vitest";
import { extractPdfText } from "@/lib/pdf_extract";
import { pdfFallbackMessage } from "@/lib/ocr";

describe("v18 PDF edge-cases — extractPdfText", () => {
  it("corrupt buffer → ok=false, never throws", async () => {
    const r = await extractPdfText(Buffer.from("not a pdf at all"));
    expect(r.ok).toBe(false);
    expect(r.empty).toBe(true);
    expect(r.pages).toBe(0);
  });

  it("empty buffer → ok=false, no crash", async () => {
    const r = await extractPdfText(Buffer.alloc(0));
    expect(r.ok).toBe(false);
  });

  it("result always carries the v18 shape fields", async () => {
    const r = await extractPdfText(Buffer.from("garbage"));
    expect(typeof r.truncated).toBe("boolean");
    expect(typeof r.extractedPages).toBe("number");
    // passwordProtected is optional but must not be true for a non-pw error
    expect(r.passwordProtected ?? false).toBe(false);
  });
});

describe("v18 PDF fallback messages — every marker has friendly NL copy", () => {
  it("PDF_SCAN_NO_TEXT → upload foto", () => {
    expect(pdfFallbackMessage("PDF_SCAN_NO_TEXT")).toMatch(/ingescand|foto/i);
  });
  it("PDF_EXTRACT_FAIL → opnieuw downloaden", () => {
    expect(pdfFallbackMessage("PDF_EXTRACT_FAIL: boom")).toMatch(/uitlezen|opnieuw/i);
  });
  it("PDF_PASSWORD_PROTECTED → clear unlock instruction", () => {
    const m = pdfFallbackMessage("PDF_PASSWORD_PROTECTED");
    expect(m).toMatch(/wachtwoord/i);
    expect(m).toMatch(/zonder wachtwoord|foto/i);
  });
  it("PDF_EMPTY → empty-file instruction", () => {
    expect(pdfFallbackMessage("PDF_EMPTY")).toMatch(/leeg|0 pagina/i);
  });
  it("PDF_PARSE_LOW_CONFIDENCE → manual entry", () => {
    expect(pdfFallbackMessage("PDF_PARSE_LOW_CONFIDENCE")).toMatch(/handmatig/i);
  });
  it("PDF_LLM_ERR → retry message", () => {
    expect(pdfFallbackMessage("PDF_LLM_ERR: x")).toMatch(/opnieuw|AI/i);
  });
  it("unknown marker → null (no false message)", () => {
    expect(pdfFallbackMessage("SOMETHING_ELSE")).toBeNull();
    expect(pdfFallbackMessage("")).toBeNull();
  });
});

describe("v18 PDF — password detection contract (source-level)", () => {
  it("pdf_extract detects PasswordException + sets passwordProtected", () => {
    const { readFileSync } = require("node:fs");
    const { resolve } = require("node:path");
    const src = readFileSync(resolve(__dirname, "../lib/pdf_extract.ts"), "utf8");
    expect(src).toMatch(/PasswordException/);
    expect(src).toMatch(/passwordProtected/);
  });

  it("ocr extractFromPdf maps password + empty to dedicated markers", () => {
    const { readFileSync } = require("node:fs");
    const { resolve } = require("node:path");
    const src = readFileSync(resolve(__dirname, "../lib/ocr.ts"), "utf8");
    expect(src).toMatch(/PDF_PASSWORD_PROTECTED/);
    expect(src).toMatch(/PDF_EMPTY/);
  });
});

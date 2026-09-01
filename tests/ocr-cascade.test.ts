import { describe, it, expect } from "vitest";
import { extractBill, VISION_MODELS } from "../lib/ocr";

describe("ocr/VISION_MODELS cascade order", () => {
  it("uses qwen3.8 (huidige Groq-lineup, sept 2026)", () => {
    expect(VISION_MODELS[0]).toMatch(/qwen3\.8/);
  });

  it("single model — geen llama meer (Groq schrapte het hele aanbod)", () => {
    expect(VISION_MODELS).toHaveLength(1);
    expect(VISION_MODELS.join(",")).not.toMatch(/llama/);
  });
});

describe("ocr/extractBill PDF handling", () => {
  it("garbage PDF returns extract-fail or scan-no-text", async () => {
    const r = await extractBill(Buffer.from("%PDF-1.4"), "application/pdf");
    expect(r.ok).toBe(false);
    expect(r.rawText).toMatch(/PDF_(EXTRACT_FAIL|SCAN_NO_TEXT|OCR_SKIPPED|LLM_ERR)/);
  });

  it("returns case-insensitive PDF handling", async () => {
    const r = await extractBill(Buffer.from("%PDF"), "APPLICATION/PDF");
    expect(r.rawText).toMatch(/PDF_/);
  });

  it("PDF still hashes the buffer", async () => {
    const r = await extractBill(Buffer.from("%PDF-1.4 content"), "application/pdf");
    expect(r.imageHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("ocr/extractBill error paths", () => {
  it("returns 0 attempts when no API key", async () => {
    const r = await extractBill(Buffer.from("x"), "image/jpeg");
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(0);
    expect(r.rawText).toMatch(/SKIPPED/);
  });
});

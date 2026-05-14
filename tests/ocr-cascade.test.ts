import { describe, it, expect } from "vitest";
import { extractBill, VISION_MODELS } from "../lib/ocr";

describe("ocr/VISION_MODELS cascade order", () => {
  it("first try is 90b vision", () => {
    expect(VISION_MODELS[0]).toMatch(/90b-vision/);
  });

  it("fallback is 11b vision", () => {
    expect(VISION_MODELS[1]).toMatch(/11b-vision/);
  });

  it("exactly 2 models in cascade", () => {
    expect(VISION_MODELS).toHaveLength(2);
  });
});

describe("ocr/extractBill PDF handling", () => {
  it("returns PDF_SKIPPED for application/pdf", async () => {
    const r = await extractBill(Buffer.from("%PDF-1.4"), "application/pdf");
    expect(r.ok).toBe(false);
    expect(r.rawText).toMatch(/PDF_SKIPPED/);
  });

  it("returns case-insensitive PDF skip", async () => {
    const r = await extractBill(Buffer.from("%PDF"), "APPLICATION/PDF");
    expect(r.rawText).toMatch(/PDF_SKIPPED/);
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

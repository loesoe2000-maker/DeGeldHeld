import { describe, it, expect } from "vitest";
import { hashImage, extractEurFromText, parseOcrJson, validateUploadedFile, extractBill } from "../lib/ocr";

describe("ocr/hashImage", () => {
  it("produces stable sha256", () => {
    const a = hashImage(Buffer.from("hello"));
    const b = hashImage(Buffer.from("hello"));
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("different inputs → different hashes", () => {
    expect(hashImage(Buffer.from("a"))).not.toBe(hashImage(Buffer.from("b")));
  });
});

describe("ocr/extractEurFromText", () => {
  it("parses NL comma format", () => {
    expect(extractEurFromText("Totaal € 42,50")).toBe(4250);
  });
  it("parses dot format", () => {
    expect(extractEurFromText("Total: 67.95")).toBe(6795);
  });
  it("parses EUR prefix", () => {
    expect(extractEurFromText("EUR 12,99")).toBe(1299);
  });
  it("returns null when no number", () => {
    expect(extractEurFromText("no money here")).toBeNull();
  });
});

describe("ocr/parseOcrJson", () => {
  it("parses well-formed JSON response", () => {
    const r = parseOcrJson(`{"provider":"T-Mobile","amount_eur":42.5,"plan":"Unlimited","period":"mei","confidence":0.9}`);
    expect(r.provider).toBe("T-Mobile");
    expect(r.amountCents).toBe(4250);
    expect(r.confidence).toBe(0.9);
  });

  it("strips markdown code fence", () => {
    const r = parseOcrJson("```json\n{\"provider\":\"KPN\",\"amount_eur\":30,\"plan\":null,\"period\":null,\"confidence\":0.8}\n```");
    expect(r.provider).toBe("KPN");
    expect(r.amountCents).toBe(3000);
  });

  it("returns confidence=0 on garbage input", () => {
    const r = parseOcrJson("not json at all");
    expect(r.confidence).toBe(0);
  });

  it("clamps confidence to 0..1", () => {
    expect(parseOcrJson(`{"confidence":1.5}`).confidence).toBe(1);
    expect(parseOcrJson(`{"confidence":-0.2}`).confidence).toBe(0);
  });

  it("handles null fields", () => {
    const r = parseOcrJson(`{"provider":null,"amount_eur":null,"plan":null,"period":null,"confidence":0.3}`);
    expect(r.provider).toBeNull();
    expect(r.amountCents).toBeNull();
  });
});

describe("ocr/validateUploadedFile", () => {
  it("accepts valid jpg under 10MB", () => {
    expect(validateUploadedFile({ size: 1_000_000, type: "image/jpeg" }).ok).toBe(true);
  });
  it("accepts png", () => {
    expect(validateUploadedFile({ size: 500, type: "image/png" }).ok).toBe(true);
  });
  it("accepts webp", () => {
    expect(validateUploadedFile({ size: 500, type: "image/webp" }).ok).toBe(true);
  });
  it("accepts heic", () => {
    expect(validateUploadedFile({ size: 500, type: "image/heic" }).ok).toBe(true);
  });
  it("rejects file >10MB", () => {
    const r = validateUploadedFile({ size: 11_000_000, type: "image/jpeg" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/10\s*MB/);
  });
  it("rejects empty file", () => {
    const r = validateUploadedFile({ size: 0, type: "image/jpeg" });
    expect(r.ok).toBe(false);
  });
  it("rejects non-image types", () => {
    const r = validateUploadedFile({ size: 500, type: "application/pdf" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/JPG/);
  });
  it("is case-insensitive for mime", () => {
    expect(validateUploadedFile({ size: 500, type: "IMAGE/JPEG" }).ok).toBe(true);
  });
});

describe("ocr/extractBill (no API key)", () => {
  it("returns OCR_SKIPPED when key is dummy", async () => {
    const r = await extractBill(Buffer.from("fake-image"), "image/jpeg");
    expect(r.ok).toBe(false);
    expect(r.rawText).toMatch(/SKIPPED/);
    expect(r.imageHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

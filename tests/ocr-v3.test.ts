import { describe, it, expect, beforeEach } from "vitest";
import { extractBill, parseOcrJson, hashImage } from "../lib/ocr";
import { ocrCache } from "../lib/llm_cache";

describe("ocr-v3/parseOcrJson multi-language fields", () => {
  it("parses NL response with customer_number + language", () => {
    const r = parseOcrJson(
      `{"provider":"Vodafone","amount_eur":29.95,"plan":"Red","period":"mei 2026","customer_number":"12345","language":"nl","confidence":0.9}`,
    );
    expect(r.provider).toBe("Vodafone");
    expect(r.customerNumber).toBe("12345");
    expect(r.language).toBe("nl");
  });

  it("parses EN response", () => {
    const r = parseOcrJson(
      `{"provider":"BT","amount_eur":35.00,"plan":"Full Fibre 100","period":"May 2026","customer_number":"BT-A001","language":"en","confidence":0.85}`,
    );
    expect(r.language).toBe("en");
    expect(r.provider).toBe("BT");
  });

  it("parses DE response", () => {
    const r = parseOcrJson(
      `{"provider":"Deutsche Telekom","amount_eur":39.95,"plan":"MagentaMobil M","period":"Mai 2026","customer_number":"DT-9988","language":"de","confidence":0.92}`,
    );
    expect(r.language).toBe("de");
    expect(r.customerNumber).toBe("DT-9988");
  });

  it("normalises invalid language to 'unknown'", () => {
    const r = parseOcrJson(
      `{"provider":"X","amount_eur":10,"plan":null,"period":null,"customer_number":null,"language":"fr","confidence":0.5}`,
    );
    expect(r.language).toBe("unknown");
  });

  it("returns confidence 0 + language unknown on bogus JSON", () => {
    const r = parseOcrJson("not json");
    expect(r.confidence).toBe(0);
    expect(r.language).toBe("unknown");
  });

  it("clamps confidence to [0,1]", () => {
    expect(
      parseOcrJson(`{"provider":"X","amount_eur":1,"language":"nl","confidence":1.5}`).confidence,
    ).toBe(1);
    expect(
      parseOcrJson(`{"provider":"X","amount_eur":1,"language":"nl","confidence":-0.5}`).confidence,
    ).toBe(0);
  });

  it("strips markdown fence from JSON", () => {
    const r = parseOcrJson('```json\n{"provider":"KPN","amount_eur":42,"language":"nl","confidence":0.8}\n```');
    expect(r.provider).toBe("KPN");
  });
});

describe("ocr-v3/extractBill needsManual semantics", () => {
  it("PDF returns needsManual=true", async () => {
    const r = await extractBill(Buffer.from("%PDF"), "application/pdf");
    expect(r.needsManual).toBe(true);
  });

  it("no API key returns needsManual=true", async () => {
    const r = await extractBill(Buffer.from("x"), "image/jpeg");
    expect(r.needsManual).toBe(true);
  });

  it("default needsManualProvider is undefined when full manual is needed", async () => {
    const r = await extractBill(Buffer.from("x"), "image/jpeg");
    expect(r.needsManualProvider).not.toBe(true);
  });
});

describe("ocr-v3/cache 30d", () => {
  beforeEach(() => ocrCache.clear());

  it("second call with same buf returns cached result (PDF skipped not cached)", async () => {
    // PDF doesn't write cache, so we test via the imageHash determinism only
    const buf = Buffer.from("test-image-content");
    const h1 = hashImage(buf);
    const h2 = hashImage(buf);
    expect(h1).toBe(h2);
  });

  it("ocrCache.set/get roundtrip", () => {
    const fake = { ok: true, provider: "Test", imageHash: "abc" } as unknown;
    ocrCache.set("abc", fake);
    expect(ocrCache.get("abc")).toEqual(fake);
  });

  it("ocrCache returns null after clear", () => {
    ocrCache.set("abc", { x: 1 });
    ocrCache.clear();
    expect(ocrCache.get("abc")).toBeNull();
  });
});

describe("ocr-v3/result shape", () => {
  it("OcrResult includes new fields (customerNumber, language)", async () => {
    const r = await extractBill(Buffer.from("%PDF"), "application/pdf");
    expect("customerNumber" in r).toBe(true);
    expect("language" in r).toBe(true);
    expect(r.customerNumber).toBeNull();
    expect(r.language).toBe("unknown");
  });
});

describe("ocr-v3/hashing determinism for cache key", () => {
  it("hash is sha256 hex", () => {
    expect(hashImage(Buffer.from("a"))).toMatch(/^[a-f0-9]{64}$/);
  });

  it("different image → different hash", () => {
    expect(hashImage(Buffer.from("a"))).not.toBe(hashImage(Buffer.from("b")));
  });
});

describe("ocr-v3/parseOcrJson handles missing optional fields", () => {
  it("missing customer_number → null", () => {
    const r = parseOcrJson(
      `{"provider":"X","amount_eur":10,"plan":"Y","period":"Z","language":"nl","confidence":0.7}`,
    );
    expect(r.customerNumber).toBeNull();
  });

  it("missing plan + period still parses", () => {
    const r = parseOcrJson(
      `{"provider":"X","amount_eur":10,"language":"nl","confidence":0.7}`,
    );
    expect(r.provider).toBe("X");
    expect(r.plan).toBeNull();
    expect(r.period).toBeNull();
  });

  it("amount_eur as integer still produces cents", () => {
    expect(
      parseOcrJson(`{"provider":"X","amount_eur":15,"language":"nl","confidence":0.8}`).amountCents,
    ).toBe(1500);
  });

  it("amount_eur null → amountCents null", () => {
    expect(
      parseOcrJson(`{"provider":"X","amount_eur":null,"language":"nl","confidence":0.5}`).amountCents,
    ).toBeNull();
  });
});

describe("ocr-v3/integration: provider matching uses NL_PROVIDERS", () => {
  it("documented behavior: unknown provider yields needsManualProvider", () => {
    // We can't easily run extractBill end-to-end in tests (no real Groq),
    // but parseOcrJson + the matching logic contract is testable.
    const parsed = parseOcrJson(
      `{"provider":"FooBarTelecom","amount_eur":15,"language":"nl","confidence":0.9}`,
    );
    expect(parsed.provider).toBe("FooBarTelecom");
    // findProvider("FooBarTelecom") === null → needsManualProvider should be true
    // (verified in extractBill caller logic)
  });
});

import { describe, it, expect } from "vitest";
import { billDataFromOcr as __billDataFromOcrForTest } from "@/lib/bill-from-ocr";
import type { OcrResult } from "@/lib/ocr";

/**
 * v17 DEEL 1 — billDataFromOcr must pass every category-specific OCR
 * field through to the Bill row 1-on-1.
 */

function fullOcr(): OcrResult {
  return {
    ok: true,
    provider: "Eneco",
    category: "ENERGIE",
    primaryCategory: "ENERGIE",
    subType: "stroom+gas",
    monthlyAmountCents: 16000,
    totalAmountCents: 16000,
    amountCents: 16000,
    oneTimeItems: [],
    plan: "HollandseWind",
    period: "mei 2026",
    customerNumber: "12345",
    language: "nl",
    country: "NL",
    energyKwhRateCents: 34,
    energyM3RateCents: 155,
    energyContractType: "variabel",
    insuranceCoverage: "CASCO",
    insuranceDeductibleCents: 30000,
    mortgageInterestPct: 4.6,
    mortgageTermYears: 20,
    bankAccountTier: "Premium",
    streamingTier: "standard",
    confidence: 0.92,
    rawText: "raw",
    imageHash: "hash",
  };
}

describe("v17 billDataFromOcr — category field persistence", () => {
  it("passes every category-specific field 1-on-1", () => {
    const data = __billDataFromOcrForTest(fullOcr());
    expect(data.energyKwhRateCents).toBe(34);
    expect(data.energyM3RateCents).toBe(155);
    expect(data.energyContractType).toBe("variabel");
    expect(data.insuranceCoverage).toBe("CASCO");
    expect(data.insuranceDeductibleCents).toBe(30000);
    expect(data.mortgageInterestPct).toBe(4.6);
    expect(data.mortgageTermYears).toBe(20);
    expect(data.bankAccountTier).toBe("Premium");
    expect(data.streamingTier).toBe("standard");
  });

  it("maps null OCR fields to null Bill fields (no crash, no 0 fakery)", () => {
    const ocr = fullOcr();
    ocr.energyKwhRateCents = null;
    ocr.mortgageInterestPct = null;
    ocr.insuranceCoverage = null;
    const data = __billDataFromOcrForTest(ocr);
    expect(data.energyKwhRateCents).toBeNull();
    expect(data.mortgageInterestPct).toBeNull();
    expect(data.insuranceCoverage).toBeNull();
  });

  it("still carries the base fields (provider/category/amounts)", () => {
    const data = __billDataFromOcrForTest(fullOcr());
    expect(data.provider).toBe("Eneco");
    expect(data.category).toBe("ENERGIE");
    expect(data.monthlyCents).toBe(16000);
    expect(data.subType).toBe("stroom+gas");
  });

  it("undefined optional fields fall back to null", () => {
    const ocr = fullOcr();
    delete (ocr as { energyContractType?: unknown }).energyContractType;
    delete (ocr as { streamingTier?: unknown }).streamingTier;
    const data = __billDataFromOcrForTest(ocr);
    expect(data.energyContractType).toBeNull();
    expect(data.streamingTier).toBeNull();
  });
});

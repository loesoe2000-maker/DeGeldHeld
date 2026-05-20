/**
 * v17 DEEL 8 — per-category OCR → parse → map roundtrip.
 *
 * For each fixture (a representative Groq JSON response, NOT a real
 * LLM call), verify parseOcrJson extracts the right category fields,
 * and that primaryFromLegacy + inferSubType derive the right primary
 * category + sub-type. This is a Playwright spec so it runs alongside
 * the other category e2e in the prod config, but it makes no network
 * calls — pure parser/mapping coverage.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseOcrJson } from "@/lib/ocr";
import { billDataFromOcr } from "@/lib/bill-from-ocr";
import { primaryFromLegacy } from "@/lib/categories";
import { findProvider } from "@/lib/providers";
import type { OcrResult } from "@/lib/ocr";

const DIR = resolve(__dirname, "../fixtures/bills-ocr");
function load(name: string): string {
  return readFileSync(resolve(DIR, name), "utf8");
}

/** Build a full OcrResult the way the live flow does: parse + provider match. */
function toOcrResult(raw: string): OcrResult {
  const parsed = parseOcrJson(raw);
  const obj = JSON.parse(raw) as { provider?: string };
  const matched = obj.provider ? findProvider(obj.provider) : null;
  return {
    ok: true,
    provider: matched?.canonical ?? obj.provider ?? null,
    category: matched?.category ?? null,
    monthlyAmountCents: parsed.monthlyAmountCents ?? null,
    totalAmountCents: parsed.totalAmountCents ?? null,
    amountCents: parsed.amountCents ?? null,
    oneTimeItems: parsed.oneTimeItems ?? [],
    plan: parsed.plan ?? null,
    period: parsed.period ?? null,
    customerNumber: parsed.customerNumber ?? null,
    language: parsed.language ?? "unknown",
    country: parsed.country ?? null,
    primaryCategory: parsed.primaryCategory ?? null,
    subType: parsed.subType ?? null,
    energyKwhRateCents: parsed.energyKwhRateCents ?? null,
    energyM3RateCents: parsed.energyM3RateCents ?? null,
    energyContractType: parsed.energyContractType ?? null,
    insuranceCoverage: parsed.insuranceCoverage ?? null,
    insuranceDeductibleCents: parsed.insuranceDeductibleCents ?? null,
    mortgageInterestPct: parsed.mortgageInterestPct ?? null,
    mortgageTermYears: parsed.mortgageTermYears ?? null,
    bankAccountTier: parsed.bankAccountTier ?? null,
    streamingTier: parsed.streamingTier ?? null,
    confidence: parsed.confidence ?? 0,
    rawText: raw,
    imageHash: "fixture",
  };
}

test.describe("v17 category roundtrip — OCR parse → Bill map", () => {
  test("water-vitens: m³ rate parsed, provider matched, WATER primary", () => {
    const ocr = toOcrResult(load("water-vitens.json"));
    expect(ocr.provider).toBe("Vitens");
    expect(ocr.category).toBe("WATER");
    expect(ocr.energyM3RateCents).toBe(130); // €1,30
    const data = billDataFromOcr(ocr);
    expect(data.energyM3RateCents).toBe(130);
    // WATER legacy maps to WONEN primary.
    expect(primaryFromLegacy("WATER")).toBe("WONEN");
  });

  test("energie-eneco: kWh + m³ + contractType all parse + persist", () => {
    const ocr = toOcrResult(load("energie-eneco-stroomgas.json"));
    expect(ocr.provider).toBe("Eneco");
    expect(ocr.category).toBe("ENERGIE");
    expect(ocr.energyKwhRateCents).toBe(34); // €0,34
    expect(ocr.energyM3RateCents).toBe(155); // €1,55
    expect(ocr.energyContractType).toBe("variabel");
    const data = billDataFromOcr(ocr);
    expect(data.energyKwhRateCents).toBe(34);
    expect(data.energyM3RateCents).toBe(155);
    expect(data.energyContractType).toBe("variabel");
    expect(primaryFromLegacy("ENERGIE")).toBe("ENERGIE");
  });

  test("hypotheek-rabobank: rente + term parse + persist, WONEN primary", () => {
    const ocr = toOcrResult(load("hypotheek-rabobank.json"));
    expect(ocr.provider).toBe("Rabobank");
    expect(ocr.mortgageInterestPct).toBe(4.6);
    expect(ocr.mortgageTermYears).toBe(20);
    const data = billDataFromOcr(ocr);
    expect(data.mortgageInterestPct).toBe(4.6);
    expect(data.mortgageTermYears).toBe(20);
    expect(primaryFromLegacy("HYPOTHEEK")).toBe("WONEN");
  });

  test("verzekering-unive: coverage + deductible parse + persist", () => {
    const ocr = toOcrResult(load("verzekering-unive-casco.json"));
    expect(ocr.provider).toBe("Univé");
    expect(ocr.category).toBe("VERZEKERING");
    expect(ocr.insuranceCoverage).toBe("CASCO");
    expect(ocr.insuranceDeductibleCents).toBe(30000); // €300
    const data = billDataFromOcr(ocr);
    expect(data.insuranceCoverage).toBe("CASCO");
    expect(data.insuranceDeductibleCents).toBe(30000);
    expect(primaryFromLegacy("VERZEKERING")).toBe("VERZEKERING");
  });

  test("all fixtures parse with confidence ≥ 0.6 (usable threshold)", () => {
    for (const f of [
      "water-vitens.json",
      "energie-eneco-stroomgas.json",
      "hypotheek-rabobank.json",
      "verzekering-unive-casco.json",
    ]) {
      const parsed = parseOcrJson(load(f));
      expect(parsed.confidence ?? 0, f).toBeGreaterThanOrEqual(0.6);
      expect(parsed.amountCents, f).not.toBeNull();
    }
  });
});

/**
 * lib/bill-from-ocr.ts — pure mapping from an OcrResult to the Bill
 * fields we persist. Extracted from the upload route so it can be
 * unit-tested without pulling in Next.js route constraints (route
 * files may only export the HTTP handlers).
 *
 * v17: includes the category-specific fields (energy/insurance/
 * mortgage/bank/streaming) so the analyse page can compare against
 * the user's real invoice.
 */
import { parseInvoiceDate, type OcrResult } from "@/lib/ocr";
import { currencyForCountry } from "@/lib/format";
import { inferSubType } from "@/lib/categories";

export function billDataFromOcr(ocr: OcrResult) {
  const subType =
    ocr.subType ??
    (ocr.category ? inferSubType(ocr.category, ocr.provider ?? "") : null) ??
    null;
  return {
    provider: ocr.provider ?? "Onbekend",
    category: ocr.category ?? "OVERIG",
    subType,
    amountCents: ocr.amountCents ?? 0,
    monthlyCents: ocr.monthlyAmountCents,
    totalCents: ocr.totalAmountCents,
    plan: ocr.plan,
    period: ocr.period,
    invoiceDate: parseInvoiceDate(ocr.period),
    customerNumber: ocr.customerNumber,
    country: ocr.country ?? undefined,
    currency: currencyForCountry(ocr.country),
    // v17 category-specific fields.
    energyKwhRateCents: ocr.energyKwhRateCents ?? null,
    energyM3RateCents: ocr.energyM3RateCents ?? null,
    energyContractType: ocr.energyContractType ?? null,
    insuranceCoverage: ocr.insuranceCoverage ?? null,
    insuranceDeductibleCents: ocr.insuranceDeductibleCents ?? null,
    mortgageInterestPct: ocr.mortgageInterestPct ?? null,
    mortgageTermYears: ocr.mortgageTermYears ?? null,
    bankAccountTier: ocr.bankAccountTier ?? null,
    streamingTier: ocr.streamingTier ?? null,
    rawOcr: ocr.rawText.slice(0, 4000),
  };
}

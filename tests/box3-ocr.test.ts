/**
 * tests/box3-ocr.test.ts — v34 ASSURANCE DEEL 3.
 *
 * Test de complete Box-3 OCR-keten met een synthetische, in-memory PDF:
 *   buildSyntheticBeschikkingPdf → extractPdfText → processProofUpload
 *
 * Doel: Box 3-OCR-zekerheid 30% → 80%. We hebben de parseBeschikkingAmount
 * regex-test al via lib-unit-tests; wat ontbrak was de PDF-extractie laag.
 * Deze test dekt dat gat — eind-tot-eind, in dezelfde procesruimte als de
 * route, zonder echte Belastingdienst-PDFs op te slaan.
 *
 * Bedragen sourced uit V29_DATA_2026.md (NCNP-gate € 500 cents = 50_000).
 */
import { describe, it, expect, vi } from "vitest";
import { extractPdfText } from "@/lib/pdf_extract";
import {
  processProofUpload,
  parseBeschikkingAmount,
  BOX3_NCNP_GATE_CENTS,
  type ChargeFn,
} from "@/lib/box3-claim";
import { buildSyntheticBeschikkingPdf } from "@/lib/test-fixtures/synth-beschikking";

// Mock Sentry om noise te vermijden zonder de echte module aan te raken.
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

const okCharge: ChargeFn = async () => ({ ok: true, paymentIntentId: "pi_synth_test" });
const failingCharge: ChargeFn = async () => ({ ok: false, reason: "stripe_offline" });

describe("Box 3 OCR — happy path: synth PDF → extract → processProofUpload → CHARGED", () => {
  it("genereert valide PDF die pdfjs kan lezen, met de verwachte beschikking-tekst", async () => {
    const pdf = buildSyntheticBeschikkingPdf({
      kind: "happy",
      jaar: 2024,
      toegekendCents: 123_456, // € 1.234,56
    });
    expect(pdf.length).toBeGreaterThan(500);
    expect(pdf.subarray(0, 8).toString("binary")).toContain("%PDF-1.4");

    const out = await extractPdfText(pdf);
    expect(out.ok).toBe(true);
    expect(out.empty).toBe(false);
    expect(out.text).toMatch(/Voorlopige aanslag inkomstenbelasting 2024/);
    expect(out.text).toMatch(/Toegekend bedrag/i);
    expect(out.text).toMatch(/1[.,]?234,56/);
  });

  it("parseBeschikkingAmount detecteert € 1.234,56 uit de pdfjs-output", async () => {
    const pdf = buildSyntheticBeschikkingPdf({
      kind: "happy",
      jaar: 2024,
      toegekendCents: 123_456,
    });
    const out = await extractPdfText(pdf);
    const parsed = parseBeschikkingAmount(out.text);
    expect(parsed).not.toBeNull();
    expect(parsed!.amountCents).toBe(123_456);
  });

  it("processProofUpload → 'charged' met fee 25% × werkelijk, gecapt op NCNP-cap", async () => {
    const pdf = buildSyntheticBeschikkingPdf({
      kind: "happy",
      jaar: 2024,
      toegekendCents: 200_000, // € 2.000,00 → 25% = € 500 → boven NCNP-gate
    });
    const out = await extractPdfText(pdf);
    const result = await processProofUpload({
      userId: "u_synth",
      claimId: "c_synth",
      pdfText: out.text,
      charge: okCharge,
    });
    expect(result.kind).toBe("charged");
    if (result.kind === "charged") {
      expect(result.werkelijkTeruggaveCents).toBe(200_000);
      // 25% × € 2.000 = € 500 = 50_000 cents = de gate, en ook de cap.
      expect(result.feeCents).toBe(50_000);
      expect(result.paymentIntentId).toBe("pi_synth_test");
    }
  });
});

describe("Box 3 OCR — negative case A: PDF zonder bedrag → FAILED (admin-mail-pad)", () => {
  it("no-amount-scenario → parseBeschikkingAmount=null → processProofUpload returns 'failed'", async () => {
    const pdf = buildSyntheticBeschikkingPdf({ kind: "no-amount", jaar: 2024 });
    const out = await extractPdfText(pdf);
    expect(out.ok).toBe(true);
    expect(out.text).toMatch(/Uw bezwaar is in behandeling genomen/);
    // Geen "Toegekend bedrag: EUR …" → parser kan niet matchen.
    expect(parseBeschikkingAmount(out.text)).toBeNull();

    const result = await processProofUpload({
      userId: "u_admin",
      claimId: "c_admin",
      pdfText: out.text,
      charge: okCharge,
    });
    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.reason).toMatch(/bedrag.*niet.*uitlezen|automatisch/i);
    }
  });

  it("totaal lege PDF-tekst → óók 'failed' (defensief)", async () => {
    const result = await processProofUpload({
      userId: "u_empty",
      claimId: "c_empty",
      pdfText: "",
      charge: okCharge,
    });
    expect(result.kind).toBe("failed");
  });
});

describe("Box 3 OCR — negative case B: bedrag onder € 500-gate → CHARGED met fee € 0", () => {
  it("toegekend € 250 → werkelijk < gate → 'no-fee' (geen Stripe-call)", async () => {
    const pdf = buildSyntheticBeschikkingPdf({
      kind: "below-gate",
      jaar: 2024,
      toegekendCents: 25_000, // € 250
    });
    expect(25_000).toBeLessThan(BOX3_NCNP_GATE_CENTS);

    const out = await extractPdfText(pdf);
    const parsed = parseBeschikkingAmount(out.text);
    expect(parsed?.amountCents).toBe(25_000);

    // Charge-fn MOET niet worden aangeroepen — we mocken hem om dat te detecteren.
    const chargeSpy = vi.fn().mockImplementation(okCharge);
    const result = await processProofUpload({
      userId: "u_below",
      claimId: "c_below",
      pdfText: out.text,
      charge: chargeSpy,
    });
    expect(chargeSpy).not.toHaveBeenCalled();
    expect(result.kind).toBe("no-fee");
    if (result.kind === "no-fee") {
      expect(result.werkelijkTeruggaveCents).toBe(25_000);
    }
  });

  it("toegekend exact € 500 → CHARGED met fee 25% × € 500 = € 125", async () => {
    const pdf = buildSyntheticBeschikkingPdf({
      kind: "happy",
      jaar: 2024,
      toegekendCents: 50_000, // exact € 500 = NCNP-gate
    });
    const out = await extractPdfText(pdf);
    const result = await processProofUpload({
      userId: "u_exact",
      claimId: "c_exact",
      pdfText: out.text,
      charge: okCharge,
    });
    expect(result.kind).toBe("charged");
    if (result.kind === "charged") {
      expect(result.feeCents).toBe(12_500); // € 125
    }
  });

  it("Stripe-charge faalt op happy-path → 'failed' bevat werkelijk + reden", async () => {
    const pdf = buildSyntheticBeschikkingPdf({
      kind: "happy",
      jaar: 2024,
      toegekendCents: 100_000, // € 1.000
    });
    const out = await extractPdfText(pdf);
    const result = await processProofUpload({
      userId: "u_stripe_fail",
      claimId: "c_stripe_fail",
      pdfText: out.text,
      charge: failingCharge,
    });
    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.reason).toMatch(/charge failed/i);
      expect(result.werkelijkTeruggaveCents).toBe(100_000);
    }
  });
});

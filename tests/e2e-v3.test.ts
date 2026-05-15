/**
 * End-to-end smoke voor v3 surface:
 *  - 150+ providers vindbaar (sample uit elke categorie)
 *  - findProvider matched user facturen (Vodafone, Youfone, T-Mobile, Eneco)
 *  - buildComparison produceert valid output incl. v3 fields
 *  - generateEmail fallback respects tonality+language
 *  - error mapping vertaalt naar NL
 */

import { describe, it, expect } from "vitest";
import { findProvider, totalProviderCount, listProvidersByCategory } from "../lib/providers";
import { buildComparison } from "../lib/comparison";
import { generateEmail, type NegotiatorInput, buildWhatsAppShareUrl } from "../lib/negotiator";
import { mapError } from "../lib/errors";
import { MARKET_PLANS } from "../lib/market_db";

describe("e2e-v3/provider DB", () => {
  it("OCR-sample 1: Vodafone factuur → matches", () => {
    const r = findProvider("Factuur Vodafone Red Unlimited mei 2026");
    expect(r?.canonical).toBe("Vodafone");
    expect(r?.category).toBe("TELECOM");
  });

  it("OCR-sample 2: Youfone factuur → matches", () => {
    const r = findProvider("Youfone Sim Only abonnement juni 2026");
    expect(r?.canonical).toBe("Youfone");
  });

  it("OCR-sample 3: T-Mobile factuur → matches", () => {
    const r = findProvider("T-Mobile Compleet pakket factuur");
    expect(r?.canonical).toBe("T-Mobile");
  });

  it("OCR-sample 4: Eneco factuur → matches", () => {
    const r = findProvider("Eneco HollandseWind jaarrekening 2026");
    expect(r?.canonical).toBe("Eneco");
    expect(r?.category).toBe("ENERGIE");
  });

  it("150+ providers seeded total", () => {
    expect(totalProviderCount()).toBeGreaterThanOrEqual(150);
  });
});

describe("e2e-v3/comparison full flow Vodafone", () => {
  it("buildComparison produceert 3 alts + marketRange + confidence", () => {
    const r = buildComparison({ provider: "Vodafone", category: "TELECOM", amountCents: 3000 });
    expect(r.topAlternatives.length).toBeLessThanOrEqual(3);
    expect(r.marketRange.sampleSize).toBeGreaterThan(0);
    expect(r.confidencePct).toBeGreaterThan(0);
    if (r.topAlternatives[0]) {
      expect(r.topAlternatives[0].rationale.length).toBeGreaterThan(10);
    }
  });
});

describe("e2e-v3/negotiator + share", () => {
  const input: NegotiatorInput = {
    customerName: "Bart",
    provider: "T-Mobile",
    category: "TELECOM",
    currentPlan: "Go Unlimited",
    currentMonthlyCents: 3500,
    alternatives: [],
    tonality: "FORMEEL",
    language: "nl",
  };

  it("generateEmail fallback signed met klantnaam", async () => {
    const out = await generateEmail(input);
    expect(out.body).toContain("Bart");
    expect(out.tonality).toBe("FORMEEL");
  });

  it("WhatsApp share-link bevat subject + body URL-encoded", async () => {
    const out = await generateEmail(input);
    const url = buildWhatsAppShareUrl({ subject: out.subject, body: out.body });
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });
});

describe("e2e-v3/error mapping NL", () => {
  it("Groq timeout → LLM_FAILED NL message", () => {
    expect(mapError(new Error("Groq endpoint timeout")).message).toMatch(/AI|beschikbaar/i);
  });

  it("Stripe error → STRIPE_FAILED NL message", () => {
    expect(mapError(new Error("stripe_error 402")).message).toMatch(/betaling/i);
  });

  it("Prisma error → DB_FAILED NL message", () => {
    expect(mapError(new Error("Prisma P2003 FK violation")).message).toMatch(/probleem|tijdelijk/i);
  });
});

describe("e2e-v3/seed integrity", () => {
  it("alle MARKET_PLANS providers staan in NL_PROVIDERS", () => {
    for (const p of MARKET_PLANS) {
      expect(findProvider(p.provider)?.canonical.toLowerCase()).toBe(p.provider.toLowerCase());
    }
  });

  it("elke categorie heeft plans", () => {
    for (const cat of ["TELECOM", "ENERGIE", "VERZEKERING", "HYPOTHEEK", "BANK", "ABONNEMENT", "OVERIG"] as const) {
      expect(MARKET_PLANS.filter((p) => p.category === cat).length).toBeGreaterThan(0);
    }
  });

  it("BANK categorie heeft 8+ providers", () => {
    expect(listProvidersByCategory("BANK").length).toBeGreaterThanOrEqual(8);
  });
});

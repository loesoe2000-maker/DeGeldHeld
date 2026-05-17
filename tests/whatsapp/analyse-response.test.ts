import { describe, it, expect, beforeEach } from "vitest";
import { analyseProviderResponse } from "../../lib/whatsapp";

beforeEach(() => {
  // Force the fallback path (no LLM) by ensuring no usable API key.
  process.env.GROQ_API_KEY = "gsk_test_dummy";
});

describe("analyseProviderResponse — fallback (no LLM)", () => {
  it("returns counter mentioning provider name", async () => {
    const r = await analyseProviderResponse({
      providerName: "KPN",
      providerMessage: "Wij kunnen geen korting bieden.",
      currentMonthlyEur: 29.95,
    });
    expect(r.counter).toMatch(/KPN/);
  });

  it("references the alternative when supplied", async () => {
    const r = await analyseProviderResponse({
      providerName: "Ziggo",
      providerMessage: "Bedankt voor je reactie.",
      currentMonthlyEur: 45,
      alternativeName: "DELTA",
      alternativeMonthlyEur: 33.95,
    });
    expect(r.counter).toMatch(/DELTA/);
    expect(r.counter).toMatch(/33/);
  });

  it("returns FORMEEL tone in fallback", async () => {
    const r = await analyseProviderResponse({
      providerName: "Vodafone",
      providerMessage: "Aanbod: €25/mnd voor 12 mnd.",
      currentMonthlyEur: 35,
    });
    expect(r.tone).toBe("FORMEEL");
  });
});

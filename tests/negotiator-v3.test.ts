import { describe, it, expect } from "vitest";
import {
  ALL_STRATEGIES,
  buildPrompt,
  buildWhatsAppShareUrl,
  chooseStrategy,
  generateEmail,
  type NegotiatorInput,
} from "../lib/negotiator";
import type { Alternative } from "../lib/comparison";

const sampleAlts: Alternative[] = [
  {
    plan: { provider: "Tele2", category: "TELECOM", name: "Onbeperkt 5G", priceCents: 2500, features: "" },
    monthlySavingsCents: 500,
    yearlySavingsCents: 6000,
    percentSaved: 0.166,
    rationale: "test",
  },
];

const baseInput: NegotiatorInput = {
  customerName: "Bart",
  provider: "KPN",
  category: "TELECOM",
  currentPlan: "Compleet Onbeperkt",
  currentMonthlyCents: 3000,
  alternatives: sampleAlts,
};

describe("negotiator-v3/strategies count", () => {
  it("ALL_STRATEGIES has exactly 5 entries", () => {
    expect(ALL_STRATEGIES).toHaveLength(5);
  });

  it("includes the 5 named strategies", () => {
    expect(ALL_STRATEGIES).toContain("RETENTIE_DREIG");
    expect(ALL_STRATEGIES).toContain("SWITCH_CLAIM");
    expect(ALL_STRATEGIES).toContain("LOYALTY");
    expect(ALL_STRATEGIES).toContain("NIEUWE_KLANT_VERGELIJK");
    expect(ALL_STRATEGIES).toContain("LANGETERMIJN_KORTING");
  });
});

describe("negotiator-v3/chooseStrategy", () => {
  it("explicit strategy is honored", () => {
    expect(chooseStrategy({ ...baseInput, strategy: "LOYALTY" })).toBe("LOYALTY");
  });

  it("≥20% saving picks SWITCH_CLAIM", () => {
    const big: Alternative = { ...sampleAlts[0], percentSaved: 0.25 };
    expect(chooseStrategy({ ...baseInput, alternatives: [big] })).toBe("SWITCH_CLAIM");
  });

  it("8-19% saving picks RETENTIE_DREIG", () => {
    const mid: Alternative = { ...sampleAlts[0], percentSaved: 0.12 };
    expect(chooseStrategy({ ...baseInput, alternatives: [mid] })).toBe("RETENTIE_DREIG");
  });

  it("long-term customer (>=5 yr) with sub-8% savings picks LANGETERMIJN_KORTING", () => {
    const small: Alternative = { ...sampleAlts[0], percentSaved: 0.05 };
    expect(
      chooseStrategy({ ...baseInput, alternatives: [small], customerYears: 6 }),
    ).toBe("LANGETERMIJN_KORTING");
  });

  it("3-7% saving + new customer picks NIEUWE_KLANT_VERGELIJK", () => {
    const small: Alternative = { ...sampleAlts[0], percentSaved: 0.05 };
    expect(
      chooseStrategy({ ...baseInput, alternatives: [small], customerYears: 1 }),
    ).toBe("NIEUWE_KLANT_VERGELIJK");
  });

  it("no alts → LOYALTY (backwards-compat)", () => {
    expect(
      chooseStrategy({ ...baseInput, alternatives: [], customerYears: 0 }),
    ).toBe("LOYALTY");
  });

  it("very small saving (<3%) falls through to LOYALTY", () => {
    const tiny: Alternative = { ...sampleAlts[0], percentSaved: 0.01 };
    expect(
      chooseStrategy({ ...baseInput, alternatives: [tiny], customerYears: 1 }),
    ).toBe("LOYALTY");
  });
});

describe("negotiator-v3/buildPrompt tonality + language", () => {
  it("FORMEEL NL → u-vorm in system prompt", () => {
    const { system } = buildPrompt({ ...baseInput, tonality: "FORMEEL", language: "nl" });
    expect(system.toLowerCase()).toMatch(/u-vorm|formeel|nederlandse/);
  });

  it("CASUAL NL → je-vorm in system prompt", () => {
    const { system } = buildPrompt({ ...baseInput, tonality: "CASUAL", language: "nl" });
    expect(system.toLowerCase()).toMatch(/je-vorm|casual|direct/);
  });

  it("language=en switches to English label", () => {
    const { system } = buildPrompt({ ...baseInput, language: "en" });
    expect(system).toMatch(/english|engelse/i);
  });

  it("provider hint for KPN is present", () => {
    const { user } = buildPrompt(baseInput);
    expect(user.toLowerCase()).toMatch(/kpn|klantbehoud|retentie/);
  });

  it("provider hint for Vodafone differs from KPN", () => {
    const k = buildPrompt(baseInput).user;
    const v = buildPrompt({ ...baseInput, provider: "Vodafone" }).user;
    expect(k).not.toBe(v);
  });

  it("strategy description appears in user prompt (NL)", () => {
    const { user } = buildPrompt({ ...baseInput, strategy: "LANGETERMIJN_KORTING", language: "nl" });
    expect(user.toLowerCase()).toMatch(/contract|korting|langer/);
  });

  it("customerYears renders in prompt when set", () => {
    const { user } = buildPrompt({ ...baseInput, customerYears: 7 });
    expect(user).toMatch(/7 jaar/);
  });
});

describe("negotiator-v3/buildWhatsAppShareUrl", () => {
  it("uses wa.me with text param", () => {
    const u = buildWhatsAppShareUrl({ subject: "Hoi", body: "Test" });
    expect(u.startsWith("https://wa.me/?text=")).toBe(true);
  });

  it("URL-encodes newlines", () => {
    const u = buildWhatsAppShareUrl({ subject: "Hoi", body: "Test\nbericht" });
    expect(u).toContain("%0A");
  });

  it("URL-encodes spaces in body", () => {
    const u = buildWhatsAppShareUrl({ subject: "Hoi", body: "Met spaties hier" });
    expect(u).toContain("%20");
  });

  it("includes both subject and body", () => {
    const u = buildWhatsAppShareUrl({ subject: "MySubject", body: "MyBody" });
    const decoded = decodeURIComponent(u.split("text=")[1]);
    expect(decoded).toContain("MySubject");
    expect(decoded).toContain("MyBody");
  });
});

describe("negotiator-v3/generateEmail fallback respects tonality+language", () => {
  it("FORMEEL NL fallback uses 'Geachte heer/mevrouw'", async () => {
    const out = await generateEmail({ ...baseInput, tonality: "FORMEEL", language: "nl" });
    expect(out.body).toMatch(/Geachte heer\/mevrouw/);
    expect(out.tonality).toBe("FORMEEL");
    expect(out.language).toBe("nl");
  });

  it("CASUAL NL fallback uses 'Hallo'", async () => {
    const out = await generateEmail({ ...baseInput, tonality: "CASUAL", language: "nl" });
    expect(out.body).toMatch(/Hallo/);
  });

  it("FORMEEL EN fallback uses 'Dear Sir/Madam'", async () => {
    const out = await generateEmail({ ...baseInput, tonality: "FORMEEL", language: "en" });
    expect(out.body).toMatch(/Dear Sir\/Madam/);
    expect(out.language).toBe("en");
  });

  it("CASUAL EN fallback uses 'Hi'", async () => {
    const out = await generateEmail({ ...baseInput, tonality: "CASUAL", language: "en" });
    expect(out.body).toMatch(/Hi,/);
  });

  it("returns the chosen strategy in result", async () => {
    const out = await generateEmail({ ...baseInput, strategy: "LANGETERMIJN_KORTING" });
    expect(out.strategy).toBe("LANGETERMIJN_KORTING");
  });

  it("default tonality is FORMEEL, language nl", async () => {
    const out = await generateEmail(baseInput);
    expect(out.tonality).toBe("FORMEEL");
    expect(out.language).toBe("nl");
  });
});

import { describe, it, expect } from "vitest";
import {
  chooseStrategy,
  buildPrompt,
  parseNegotiatorJson,
  generateEmail,
  type NegotiatorInput,
} from "../lib/negotiator";

const baseInput: NegotiatorInput = {
  customerName: "Jan Janssen",
  provider: "Ziggo",
  category: "TELECOM",
  currentPlan: "Mediabox 1Gbps",
  currentMonthlyCents: 6795,
  alternatives: [],
};

const altWith = (priceCents: number) => ({
  plan: { provider: "KPN", category: "TELECOM" as const, name: "Glas 100", priceCents, features: "100 Mbps" },
  monthlySavingsCents: 6795 - priceCents,
  yearlySavingsCents: (6795 - priceCents) * 12,
  percentSaved: (6795 - priceCents) / 6795,
});

describe("negotiator/chooseStrategy", () => {
  it("LOYALTY when no alternatives", () => {
    expect(chooseStrategy(baseInput)).toBe("LOYALTY");
  });

  it("NIEUWE_KLANT_VERGELIJK when savings 3-7% (v3 nieuwe tier)", () => {
    // altWith(6500) = €2.95/mnd savings = 4.3% — valt in v3's nieuwe 3-7% bucket
    expect(chooseStrategy({ ...baseInput, alternatives: [altWith(6500)] })).toBe(
      "NIEUWE_KLANT_VERGELIJK",
    );
  });

  it("RETENTIE_DREIG when savings 8-19%", () => {
    expect(chooseStrategy({ ...baseInput, alternatives: [altWith(6000)] })).toBe("RETENTIE_DREIG");
  });

  it("SWITCH_CLAIM when savings >=20%", () => {
    expect(chooseStrategy({ ...baseInput, alternatives: [altWith(4500)] })).toBe("SWITCH_CLAIM");
  });

  it("respects explicit strategy override", () => {
    expect(
      chooseStrategy({ ...baseInput, alternatives: [altWith(6500)], strategy: "SWITCH_CLAIM" }),
    ).toBe("SWITCH_CLAIM");
  });
});

describe("negotiator/buildPrompt", () => {
  it("includes provider name in user prompt", () => {
    const { user } = buildPrompt(baseInput);
    expect(user).toContain("Ziggo");
  });

  it("includes monthly amount in EUR", () => {
    const { user } = buildPrompt(baseInput);
    expect(user).toContain("67.95");
  });

  it("system prompt requires JSON output", () => {
    const { system } = buildPrompt(baseInput);
    expect(system).toMatch(/JSON/);
  });

  it("system prompt asks for Dutch", () => {
    const { system } = buildPrompt(baseInput);
    expect(system).toMatch(/Nederlands/);
  });

  it("includes alternatives in prompt", () => {
    const { user } = buildPrompt({ ...baseInput, alternatives: [altWith(4500)] });
    expect(user).toContain("KPN");
  });

  it("notes geen alternatives when empty", () => {
    const { user } = buildPrompt(baseInput);
    expect(user).toMatch(/geen/i);
  });
});

describe("negotiator/parseNegotiatorJson", () => {
  it("parses well-formed JSON", () => {
    const r = parseNegotiatorJson(
      `{"subject":"Voorstel","body":"Hallo","reasoning":"x","expected_savings_eur_yearly":216,"confidence":0.7}`,
    );
    expect(r.subject).toBe("Voorstel");
    expect(r.expectedSavingsCents).toBe(21600);
    expect(r.confidence).toBe(0.7);
  });

  it("strips markdown fence", () => {
    const r = parseNegotiatorJson(
      "```json\n{\"subject\":\"S\",\"body\":\"B\",\"reasoning\":\"R\",\"expected_savings_eur_yearly\":100,\"confidence\":0.5}\n```",
    );
    expect(r.subject).toBe("S");
  });

  it("clamps confidence to 0..1", () => {
    expect(parseNegotiatorJson(`{"confidence":2}`).confidence).toBe(1);
    expect(parseNegotiatorJson(`{"confidence":-1}`).confidence).toBe(0);
  });

  it("returns confidence=0 on garbage", () => {
    expect(parseNegotiatorJson("garbage").confidence).toBe(0);
  });

  it("converts EUR to cents correctly", () => {
    const r = parseNegotiatorJson(`{"subject":"S","body":"B","reasoning":"","expected_savings_eur_yearly":12.5,"confidence":0.5}`);
    expect(r.expectedSavingsCents).toBe(1250);
  });
});

describe("negotiator/generateEmail (no API key)", () => {
  it("returns fallback template when no key", async () => {
    const r = await generateEmail({ ...baseInput, alternatives: [altWith(5000)] });
    expect(r.subject).toMatch(/Ziggo/);
    expect(r.body).toMatch(/Jan Janssen/);
    expect(r.confidence).toBeLessThan(0.5);
    expect(r.reasoning).toMatch(/Fallback/i);
  });

  it("strategy still chosen even in fallback", async () => {
    const r = await generateEmail({ ...baseInput, alternatives: [altWith(4500)] });
    expect(r.strategy).toBe("SWITCH_CLAIM");
  });

  it("expectedSavings populated from alternatives in fallback", async () => {
    const alts = [altWith(4500)];
    const r = await generateEmail({ ...baseInput, alternatives: alts });
    expect(r.expectedSavingsCents).toBe(alts[0].yearlySavingsCents);
  });
});

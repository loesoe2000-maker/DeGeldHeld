import { describe, it, expect } from "vitest";
import { generateEmail } from "@/lib/negotiator";
import { providerTone } from "@/lib/providers";
import type { Alternative } from "@/lib/comparison";

function fakeAlt(provider = "Simyo", priceCents = 900): Alternative {
  return {
    plan: {
      provider,
      category: "TELECOM",
      name: "Sim Only 6 GB",
      priceCents,
      features: "test",
    },
    monthlySavingsCents: 600,
    yearlySavingsCents: 7200,
    percentSaved: 0.4,
    rationale: "test",
  };
}

describe("providerTone() — top-30 mapping (v12 DEEL 3a)", () => {
  it("KPN is formal", () => {
    expect(providerTone("KPN")).toBe("formal");
  });
  it("ABN AMRO is formal", () => {
    expect(providerTone("ABN AMRO")).toBe("formal");
  });
  it("Centraal Beheer is formal", () => {
    expect(providerTone("Centraal Beheer")).toBe("formal");
  });
  it("Vodafone is neutral", () => {
    expect(providerTone("Vodafone")).toBe("neutral");
  });
  it("Eneco is neutral", () => {
    expect(providerTone("Eneco")).toBe("neutral");
  });
  it("Bunq is casual", () => {
    expect(providerTone("Bunq")).toBe("casual");
  });
  it("T-Mobile is casual", () => {
    expect(providerTone("T-Mobile")).toBe("casual");
  });
  it("Netflix is casual", () => {
    expect(providerTone("Netflix")).toBe("casual");
  });
  it("unknown provider falls back via category — BANK = formal", () => {
    // No PROVIDER_TONE_MAP entry for "Random Bank" → BANK category default formal
    expect(providerTone("Knab")).toBe("casual"); // explicitly tagged
    expect(providerTone("ASN Bank")).toBe("formal"); // BANK default
  });
});

describe("KPN counter-mail uses formal voice (v12 DEEL 3 done-criteria)", () => {
  it("body contains 'Geachte heer/mevrouw' and u-vorm", async () => {
    const email = await generateEmail({
      customerName: "Bart de Boer",
      customerEmail: "bart@example.com",
      provider: "KPN",
      category: "TELECOM",
      currentPlan: "Compleet",
      currentMonthlyCents: 3500,
      alternatives: [fakeAlt()],
    });
    expect(email.body).toMatch(/Geachte heer\/mevrouw/);
    // u-vorm marker — body asks "u" not "je"
    expect(email.body).toMatch(/\bbij u\b/);
  });
});

describe("Bunq counter-mail uses casual voice (v12 DEEL 3 done-criteria)", () => {
  it("body starts with 'Hoi' and uses jij-vorm", async () => {
    const email = await generateEmail({
      customerName: "Bart",
      customerEmail: "bart@example.com",
      provider: "Bunq",
      category: "BANK",
      currentPlan: "Easy Bank",
      currentMonthlyCents: 299,
      alternatives: [{ ...fakeAlt("Knab"), plan: { ...fakeAlt("Knab").plan, category: "BANK" } }],
    });
    expect(email.body).toMatch(/^Hoi,/m);
    expect(email.body).not.toMatch(/Geachte heer\/mevrouw/);
  });
});

describe("Formal & casual respect provider-tone even when caller asks otherwise", () => {
  it("KPN with caller tonality='CASUAL' still produces formal mail", async () => {
    const email = await generateEmail({
      customerName: "Bart",
      customerEmail: "bart@example.com",
      provider: "KPN",
      category: "TELECOM",
      currentPlan: null,
      currentMonthlyCents: 3500,
      alternatives: [fakeAlt()],
      tonality: "CASUAL",
    });
    expect(email.tonality).toBe("FORMEEL");
    expect(email.body).toMatch(/Geachte heer\/mevrouw/);
  });

  it("Bunq with caller tonality='FORMEEL' still produces casual mail", async () => {
    const email = await generateEmail({
      customerName: "Bart",
      customerEmail: "bart@example.com",
      provider: "Bunq",
      category: "BANK",
      currentPlan: null,
      currentMonthlyCents: 299,
      alternatives: [{ ...fakeAlt("Knab"), plan: { ...fakeAlt("Knab").plan, category: "BANK" } }],
      tonality: "FORMEEL",
    });
    expect(email.tonality).toBe("CASUAL");
    expect(email.body).toMatch(/^Hoi,/m);
  });
});

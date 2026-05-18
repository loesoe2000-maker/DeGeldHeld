import { describe, it, expect } from "vitest";
import { vocabFor, NEGOTIATION_VOCAB } from "@/lib/categories";
import { generateEmail } from "@/lib/negotiator";
import type { Alternative } from "@/lib/comparison";

function fakeAlt(provider: string, category: Alternative["plan"]["category"]): Alternative {
  return {
    plan: { provider, category, name: "test", priceCents: 14500, features: "" },
    monthlySavingsCents: 500,
    yearlySavingsCents: 6000,
    percentSaved: 0.03,
    rationale: "test",
  };
}

describe("vocabFor() — category vocabulary lookup (v12 DEEL 3c)", () => {
  it("ENERGIE has kWh-tarief in its vocab", () => {
    expect(vocabFor("ENERGIE")).toContain("kWh-tarief");
    expect(vocabFor("ENERGIE")).toContain("voorschot");
    expect(vocabFor("ENERGIE")).toContain("jaarafrekening");
  });
  it("VERZEKERING has premie + dekking", () => {
    expect(vocabFor("VERZEKERING")).toContain("premie");
    expect(vocabFor("VERZEKERING")).toContain("dekking");
    expect(vocabFor("VERZEKERING")).toContain("eigen risico");
  });
  it("HYPOTHEEK has rente + oversluiten", () => {
    expect(vocabFor("HYPOTHEEK")).toContain("rente");
    expect(vocabFor("HYPOTHEEK")).toContain("oversluiten");
    expect(vocabFor("HYPOTHEEK")).toContain("rentevaste periode");
  });
  it("TELECOM has bundel + klantbehoud-team", () => {
    expect(vocabFor("TELECOM")).toContain("bundel");
    expect(vocabFor("TELECOM")).toContain("klantbehoud-team");
  });
  it("OVERIG has empty vocab (no false hints)", () => {
    expect(vocabFor("OVERIG")).toEqual([]);
  });

  it("every Category key has an entry (no missing vocab)", () => {
    const cats = Object.keys(NEGOTIATION_VOCAB);
    expect(cats.length).toBeGreaterThanOrEqual(13);
    for (const k of cats) {
      expect(NEGOTIATION_VOCAB[k as keyof typeof NEGOTIATION_VOCAB]).toBeDefined();
    }
  });
});

describe("Generated ENERGIE mail mentions kWh / voorschot (done-criteria)", () => {
  it("Eneco fallback body contains kWh or voorschot", async () => {
    const email = await generateEmail({
      customerName: "Bart",
      customerEmail: "bart@example.com",
      provider: "Eneco",
      category: "ENERGIE",
      currentPlan: "HollandseWind",
      currentMonthlyCents: 16000,
      alternatives: [fakeAlt("Greenchoice", "ENERGIE")],
    });
    expect(email.body).toMatch(/kWh|voorschot|jaarafrekening/);
  });
});

describe("Generated VERZEKERING mail mentions premie / dekking", () => {
  it("FBTO fallback body contains premie or dekking", async () => {
    const email = await generateEmail({
      customerName: "Bart",
      customerEmail: "bart@example.com",
      provider: "FBTO",
      category: "VERZEKERING",
      currentPlan: "Auto Allrisk",
      currentMonthlyCents: 2400,
      alternatives: [fakeAlt("InShared", "VERZEKERING")],
    });
    expect(email.body).toMatch(/premie|dekking|eigen risico/);
  });
});

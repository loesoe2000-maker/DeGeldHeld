import { describe, it, expect } from "vitest";
import { buildComparison } from "@/lib/comparison";
import { generateEmail } from "@/lib/negotiator";

describe("counter-mail country alternatives (bug-jacht DEEL 1d)", () => {
  it("BE Eneco-bill produces counter-mail that mentions a BE provider, NOT Iberdrola", async () => {
    // Real-world scenario: BE user with Eneco BE bill. We pass country="BE"
    // and verify the alternatives the LLM/fallback sees are BE only.
    const cmp = buildComparison({
      provider: "Eneco BE",
      category: "ENERGIE",
      amountCents: 17000,
      country: "BE",
    });
    expect(cmp.topAlternatives.length).toBeGreaterThan(0);
    const altProviders = cmp.topAlternatives.map((a) => a.plan.provider);
    expect(altProviders).not.toContain("Iberdrola");
    expect(altProviders).not.toContain("Endesa");
    expect(altProviders).not.toContain("EDF");

    const email = await generateEmail({
      customerName: "Test Klant",
      customerEmail: "test@example.be",
      provider: "Eneco BE",
      category: "ENERGIE",
      currentPlan: "VAST 1 jaar",
      currentMonthlyCents: 17000,
      alternatives: cmp.topAlternatives,
    });

    // The fallback template names the best alternative inline. We assert
    // that no ES/FR provider name ends up in the user-visible body.
    expect(email.body).not.toMatch(/\bIberdrola\b/);
    expect(email.body).not.toMatch(/\bEndesa\b/);
    expect(email.body).not.toMatch(/\bEDF\b/);
    // And it must mention at least one BE-energie provider so the user
    // has a credible switch-claim.
    const beProviders = ["Engie Electrabel", "Luminus", "TotalEnergies BE", "Mega", "Eneco BE"];
    const mentions = beProviders.filter((p) => email.body.includes(p));
    expect(mentions.length).toBeGreaterThanOrEqual(1);
  });

  it("DE Vodafone-bill produces counter-mail without NL/BE telecom names", async () => {
    const cmp = buildComparison({
      provider: "Vodafone DE",
      category: "TELECOM",
      amountCents: 4495,
      country: "DE",
    });
    const altProviders = cmp.topAlternatives.map((a) => a.plan.provider);
    expect(altProviders).not.toContain("KPN");
    expect(altProviders).not.toContain("Proximus");

    const email = await generateEmail({
      customerName: "Test Klant",
      customerEmail: "test@example.de",
      provider: "Vodafone DE",
      category: "TELECOM",
      currentPlan: "GigaMobil M",
      currentMonthlyCents: 4495,
      alternatives: cmp.topAlternatives,
    });
    expect(email.body).not.toMatch(/\bKPN\b/);
    expect(email.body).not.toMatch(/\bProximus\b/);
  });
});

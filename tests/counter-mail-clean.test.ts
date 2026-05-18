import { describe, it, expect } from "vitest";
import { generateEmail } from "@/lib/negotiator";
import type { Alternative } from "@/lib/comparison";

const fakeAlt: Alternative = {
  plan: {
    provider: "Greenchoice",
    category: "ENERGIE",
    name: "Vast 1 jaar 100% groen",
    priceCents: 15800,
    features: "1jr vast 100% groen",
  },
  monthlySavingsCents: 200,
  yearlySavingsCents: 2400,
  percentSaved: 0.012,
  rationale: "test",
};

describe("counter-mail body cleanliness (bug-jacht DEEL 1a)", () => {
  it("body never contains the round-context instruction string", async () => {
    const email = await generateEmail({
      customerName: "Bart",
      customerEmail: "bart@example.com",
      provider: "Eneco",
      category: "ENERGIE",
      currentPlan: "HollandseWind",
      currentMonthlyCents: 16000,
      alternatives: [fakeAlt],
      roundContext: {
        roundNumber: 2,
        previousOfferedCents: 14500,
        previousTone: "constructief",
      },
    });
    // The user-visible body must never start with or contain the
    // verbatim round-context prefix that v10 was leaking.
    expect(email.body).not.toMatch(/Dit is ronde \d+ van de onderhandeling/);
    expect(email.body).not.toMatch(/alleen voor jou ter info/i);
    expect(email.body).not.toMatch(/Heuristische analyse/);
  });

  it("body without roundContext is unchanged from the round-1 default", async () => {
    const email = await generateEmail({
      customerName: "Bart",
      customerEmail: "bart@example.com",
      provider: "Eneco",
      category: "ENERGIE",
      currentPlan: "HollandseWind",
      currentMonthlyCents: 16000,
      alternatives: [fakeAlt],
    });
    expect(email.body).not.toMatch(/Dit is ronde/);
  });
});

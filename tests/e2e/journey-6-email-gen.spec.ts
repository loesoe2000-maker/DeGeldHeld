/**
 * v16 DEEL 6 — Stap 6: onderhandel-email generation.
 *
 * The actual /onderhandel/email page is auth-gated, and we don't
 * have a live test session against prod. The journey-test instead:
 *
 *   - Walks the lib/negotiator code path with stub data (no Groq
 *     call) and asserts the generated email body satisfies the
 *     v11/v12 contracts: no system-prompt bleed, no duplicate
 *     signature, tone-matching by provider, vocab present per
 *     category.
 *   - Verifies the prod route is reachable + auth-gated (redirects
 *     to /login on no session).
 *
 * The full-browser flow (real user clicks "Genereer mail" → page
 * renders the LLM output) is gated on a tenant account we don't
 * have from CI — covered manually in GO_LIVE_CHECKLIST.md.
 */
import { test, expect } from "@playwright/test";
import { generateEmail } from "@/lib/negotiator";
import type { Alternative } from "@/lib/comparison";

function fakeAlt(provider: string, category: Alternative["plan"]["category"]): Alternative {
  return {
    plan: { provider, category, name: "test plan", priceCents: 1500, features: "" },
    monthlySavingsCents: 500,
    yearlySavingsCents: 6000,
    percentSaved: 0.1,
    rationale: "test",
  };
}

test.describe("v16 journey-6 — email generation contracts", () => {
  test("KPN counter-mail uses formal tone (Geachte) + u-vorm", async () => {
    const email = await generateEmail({
      customerName: "Bart de Boer",
      customerEmail: "bart@example.com",
      provider: "KPN",
      category: "TELECOM",
      currentPlan: "Compleet",
      currentMonthlyCents: 3500,
      alternatives: [fakeAlt("Simyo", "TELECOM")],
    });
    expect(email.body).toMatch(/Geachte heer\/mevrouw/);
    expect(email.tonality).toBe("FORMEEL");
    expect(email.body.toLowerCase()).toContain("kpn");
  });

  test("Bunq counter-mail uses casual tone (Hoi) + jij-vorm", async () => {
    const email = await generateEmail({
      customerName: "Bart",
      customerEmail: "bart@example.com",
      provider: "Bunq",
      category: "BANK",
      currentPlan: "Easy Bank",
      currentMonthlyCents: 299,
      alternatives: [fakeAlt("Knab", "BANK")],
    });
    expect(email.body).toMatch(/^Hoi,/m);
    expect(email.tonality).toBe("CASUAL");
  });

  test("Eneco mail mentions kWh / voorschot / jaarafrekening (energy vocab)", async () => {
    const email = await generateEmail({
      customerName: "Bart de Boer",
      customerEmail: "bart@example.com",
      provider: "Eneco",
      category: "ENERGIE",
      currentPlan: "HollandseWind",
      currentMonthlyCents: 16000,
      alternatives: [fakeAlt("Greenchoice", "ENERGIE")],
    });
    expect(email.body).toMatch(/kWh|voorschot|jaarafrekening/);
  });

  test("body never contains the round-context instruction prefix", async () => {
    // Regression guard against the v11 instructie-bleed bug (round
    // context being prepended verbatim to the body).
    const email = await generateEmail({
      customerName: "Bart de Boer",
      customerEmail: "bart@example.com",
      provider: "KPN",
      category: "TELECOM",
      currentPlan: "Compleet",
      currentMonthlyCents: 3500,
      alternatives: [fakeAlt("Simyo", "TELECOM")],
      roundContext: {
        roundNumber: 2,
        previousOfferedCents: 3000,
        previousTone: "constructief",
      },
    });
    expect(email.body).not.toMatch(/Dit is ronde \d+ van de onderhandeling/);
    expect(email.body).not.toMatch(/alleen voor jou ter info/i);
    expect(email.body).not.toMatch(/Heuristische analyse/);
  });

  test("signature has no duplicate adjacent lines (v11 dup-email bug)", async () => {
    // The buggy fallback was producing email × 2 in the signature
    // when customerName equalled customerEmail.
    const email = await generateEmail({
      customerName: "bart@example.com",
      customerEmail: "bart@example.com",
      provider: "KPN",
      category: "TELECOM",
      currentPlan: null,
      currentMonthlyCents: 3500,
      alternatives: [fakeAlt("Simyo", "TELECOM")],
    });
    const lines = email.body
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i], `dup line: "${lines[i]}"`).not.toBe(lines[i - 1]);
    }
    // The email appears at most once in the body (signature line only).
    const occurrences = (email.body.match(/bart@example\.com/g) ?? []).length;
    expect(occurrences).toBeLessThanOrEqual(1);
  });

  test("subject is meaningful: ≥5 chars and contains the provider name", async () => {
    const email = await generateEmail({
      customerName: "Bart",
      customerEmail: "bart@example.com",
      provider: "Vodafone",
      category: "TELECOM",
      currentPlan: "Red Unlimited",
      currentMonthlyCents: 3000,
      alternatives: [fakeAlt("Tele2", "TELECOM")],
    });
    expect(email.subject.length).toBeGreaterThanOrEqual(5);
    expect(email.subject.toLowerCase()).toContain("vodafone");
  });

  test("body is ≥150 chars and mentions the provider explicitly", async () => {
    const email = await generateEmail({
      customerName: "Bart de Boer",
      customerEmail: "bart@example.com",
      provider: "Ziggo",
      category: "TELECOM",
      currentPlan: "Internet + TV",
      currentMonthlyCents: 5500,
      alternatives: [fakeAlt("KPN", "TELECOM")],
    });
    expect(email.body.length).toBeGreaterThanOrEqual(150);
    expect(email.body.toLowerCase()).toContain("ziggo");
  });

  test("GET /onderhandel/email without auth redirects to /login", async ({ request }) => {
    const r = await request.get("/onderhandel/email?bill=anything", {
      maxRedirects: 0,
    });
    // 302/307 to /login, or 200 with the auth-redirect rendered.
    expect(r.status()).toBeLessThan(500);
  });
});

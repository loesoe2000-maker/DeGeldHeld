import { describe, it, expect } from "vitest";
import { generateEmail, signatureName } from "@/lib/negotiator";

describe("signatureName (bug-jacht DEEL 1c)", () => {
  it("returns the name when distinct from email", () => {
    expect(signatureName({ customerName: "Bart de Boer", customerEmail: "x@y.nl" })).toBe(
      "Bart de Boer",
    );
  });

  it("never returns the email itself as the display name", () => {
    const out = signatureName({
      customerName: "basheling@icloud.com",
      customerEmail: "basheling@icloud.com",
    });
    expect(out).not.toContain("@");
    // Email-prefix is capitalized; expect "Basheling"
    expect(out).toBe("Basheling");
  });

  it("derives capitalized prefix when name is empty", () => {
    expect(signatureName({ customerName: "", customerEmail: "foo.bar@example.com" })).toBe(
      "Foo Bar",
    );
  });

  it("falls back to Klant when nothing is available", () => {
    expect(signatureName({ customerName: null, customerEmail: null })).toBe("Klant");
  });

  it("falls back to Klant when email has no @ (defensive)", () => {
    expect(signatureName({ customerName: "", customerEmail: "broken-email" })).toBe("Klant");
  });
});

describe("counter-mail signature (bug-jacht DEEL 1c)", () => {
  it("body never has the email on two consecutive lines (no duplicate signature)", async () => {
    const email = await generateEmail({
      customerName: "basheling@icloud.com", // simulates the buggy fallback path
      customerEmail: "basheling@icloud.com",
      provider: "Eneco",
      category: "ENERGIE",
      currentPlan: "HollandseWind",
      currentMonthlyCents: 16000,
      alternatives: [],
    });
    // The bug: signature ended with email\nemail. Assert that the same
    // string never appears twice on adjacent lines anywhere in the body.
    const lines = email.body.split("\n").map((s) => s.trim()).filter(Boolean);
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] && lines[i] === lines[i - 1]) {
        throw new Error(`Duplicate adjacent lines: "${lines[i]}"`);
      }
    }
    // And specifically, the email address should appear at most once.
    const occurrences = (email.body.match(/basheling@icloud\.com/g) ?? []).length;
    expect(occurrences).toBeLessThanOrEqual(1);
  });
});

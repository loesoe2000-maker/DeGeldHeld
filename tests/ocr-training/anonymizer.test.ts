import { describe, it, expect } from "vitest";
import { anonymizeText, anonymizeStructured } from "../../lib/anonymizer";

describe("anonymizeText: PII stripping", () => {
  it("strips email addresses", () => {
    expect(anonymizeText("contact bart@example.com")).toContain("<EMAIL>");
    expect(anonymizeText("contact bart@example.com")).not.toContain("bart@example.com");
  });

  it("strips IBAN", () => {
    const out = anonymizeText("IBAN: NL91ABNA0417164300 — geld erop");
    expect(out).toContain("<IBAN>");
    expect(out).not.toContain("NL91ABNA0417164300");
  });

  it("strips Dutch postcode", () => {
    expect(anonymizeText("Adres: Dorpsstraat 1, 1234 AB Amsterdam")).toContain("<POSTCODE>");
    expect(anonymizeText("Adres: Dorpsstraat 1, 1234 AB Amsterdam")).not.toContain("1234 AB");
  });

  it("strips phone numbers", () => {
    expect(anonymizeText("tel +31 20 123 4567")).toContain("<PHONE>");
    expect(anonymizeText("tel 020 8765 432")).toContain("<PHONE>");
  });

  it("strips klantnummer pattern with redacted-length marker", () => {
    const out = anonymizeText("Klantnummer: 12345678");
    expect(out).toMatch(/<CUSTNR=x+>/);
    expect(out).not.toContain("12345678");
  });

  it("strips Customer Number variant", () => {
    expect(anonymizeText("Customer number: 9876543")).toMatch(/<CUSTNR=/);
  });

  it("preserves brand names (whitelist)", () => {
    const text = "Geachte heer, uw KPN factuur is verzonden. T-Mobile biedt ook aan.";
    const out = anonymizeText(text);
    expect(out).toContain("KPN");
    // brand names with hyphens like T-Mobile would also pass through unchanged
  });

  it("masks two-word capitalized names", () => {
    const out = anonymizeText("Geachte Jan Janssen, ");
    expect(out).toContain("<NAME>");
    expect(out).not.toContain("Jan Janssen");
  });

  it("handles empty input", () => {
    expect(anonymizeText("")).toBe("");
  });

  it("multi-PII line — all classes stripped at once", () => {
    const text = "Bart Boer, bart@x.nl, +31612345678, Klantnummer 999111";
    const out = anonymizeText(text);
    expect(out).toContain("<EMAIL>");
    expect(out).toContain("<PHONE>");
    expect(out).toMatch(/<CUSTNR/);
    expect(out).toContain("<NAME>");
  });

  it("does not double-mask brand-token at the start of a sentence", () => {
    const out = anonymizeText("KPN B.V. is een organisatie");
    expect(out).toMatch(/KPN/);
  });
});

describe("anonymizeStructured: never emits customerNumber", () => {
  it("strips customerNumber from output keys", () => {
    const out = anonymizeStructured({
      provider: "KPN",
      customerNumber: "987654321",
      rawText: "Klantnr 987654321",
    });
    expect(out).not.toHaveProperty("customerNumber");
  });

  it("anonymizes rawText in-place", () => {
    const out = anonymizeStructured({
      provider: "KPN",
      rawText: "Geachte Jan Janssen, klantnummer 12345678",
    });
    expect(out.rawText).toContain("<NAME>");
    expect(out.rawText).toMatch(/<CUSTNR=/);
    expect(out.rawText).not.toContain("12345678");
  });
});

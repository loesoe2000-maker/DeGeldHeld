import { describe, it, expect } from "vitest";
import {
  findProvider,
  findProviderByCountry,
  listProvidersByCountry,
  levenshtein,
  allCountries,
  totalProviderCount,
} from "@/lib/providers";

describe("providers — global registry", () => {
  it("has 150+ providers across 9 countries", () => {
    expect(totalProviderCount()).toBeGreaterThan(150);
    expect(allCountries()).toHaveLength(9);
  });

  it("each country bucket has a meaningful population", () => {
    const counts: Record<string, number> = {};
    for (const c of allCountries()) counts[c] = listProvidersByCountry(c).length;
    expect(counts.NL).toBeGreaterThanOrEqual(30);
    expect(counts.BE).toBeGreaterThanOrEqual(15);
    expect(counts.DE).toBeGreaterThanOrEqual(20);
    expect(counts.FR).toBeGreaterThanOrEqual(15);
    expect(counts.UK).toBeGreaterThanOrEqual(20);
    expect(counts.US).toBeGreaterThanOrEqual(20);
    expect(counts.ES).toBeGreaterThanOrEqual(10);
    expect(counts.IT).toBeGreaterThanOrEqual(10);
  });
});

describe("providers — fuzzy match (20 inputs)", () => {
  const cases: { input: string; expected: string }[] = [
    { input: "KPN", expected: "KPN" },
    { input: "kpn", expected: "KPN" },
    { input: "K.P.N.", expected: "KPN" },
    { input: "Vodafone", expected: "Vodafone" },
    { input: "Deutsche Telekom", expected: "Deutsche Telekom" },
    { input: "deutsche telekom AG", expected: "Deutsche Telekom" },
    { input: "Orange France", expected: "Orange" },
    { input: "T-Mobile US Wireless", expected: "T-Mobile US" },
    { input: "Verizon Wireless monthly bill", expected: "Verizon" },
    { input: "BT Broadband", expected: "BT" },
    { input: "Octopus Energy Ltd", expected: "Octopus Energy" },
    { input: "British Gas Services Ltd", expected: "British Gas" },
    { input: "Movistar Fusión", expected: "Movistar" },
    { input: "TIM Italia", expected: "TIM" },
    { input: "Iberdrola SA", expected: "Iberdrola" },
    { input: "MAIF Assurances", expected: "MAIF" },
    { input: "Eneco BV", expected: "Eneco" },
    { input: "Ziggo customer", expected: "Ziggo" },
    { input: "Sparkasse Köln-Bonn", expected: "Sparkasse" },
    { input: "Wells Fargo Bank", expected: "Wells Fargo" },
  ];

  for (const { input, expected } of cases) {
    it(`"${input}" → ${expected}`, () => {
      const p = findProvider(input);
      expect(p).not.toBeNull();
      expect(p!.canonical).toBe(expected);
    });
  }
});

describe("providers — fuzzy typo tolerance", () => {
  it("single-letter typo within Levenshtein 2", () => {
    expect(findProvider("Vodaffone")?.canonical).toBe("Vodafone");
    expect(findProvider("KPnn")?.canonical).toBe("KPN");
    expect(findProvider("Greenchoise")?.canonical).toBe("Greenchoice");
  });
});

describe("providers — disambiguation by country", () => {
  it("Allianz matches DE when country=DE", () => {
    const p = findProviderByCountry("Allianz", "DE");
    expect(p?.canonical).toBe("Allianz DE");
  });
  it("Allianz matches NL when country=NL", () => {
    const p = findProviderByCountry("Allianz", "NL");
    expect(p?.canonical).toBe("Allianz");
  });
  it("Vodafone DE returns the DE entry under country=DE", () => {
    const p = findProviderByCountry("Vodafone", "DE");
    expect(p?.canonical).toBe("Vodafone DE");
  });
  it("returns null when no provider in country", () => {
    // "Pacific Gas Company" is a US-only string — should not match any NL provider
    expect(findProviderByCountry("Pacific Gas Company", "NL")).toBeNull();
  });
});

describe("providers — Levenshtein helper", () => {
  it("equal strings → 0", () => {
    expect(levenshtein("kpn", "kpn")).toBe(0);
  });
  it("single insertion → 1", () => {
    expect(levenshtein("kpn", "kpnn")).toBe(1);
  });
  it("returns cap+1 when over cap", () => {
    expect(levenshtein("a", "bbbb", 2)).toBe(3);
  });
});

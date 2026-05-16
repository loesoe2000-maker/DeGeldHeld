import { describe, it, expect } from "vitest";
import {
  NL_PROVIDERS,
  findProvider,
  listProvidersByCategory,
  allCategories,
} from "../lib/providers";

describe("providers/registry", () => {
  it("contains 150+ providers (v3 expansion)", () => {
    expect(NL_PROVIDERS.length).toBeGreaterThanOrEqual(150);
  });

  it("has at least 7 telecom providers", () => {
    expect(listProvidersByCategory("TELECOM").length).toBeGreaterThanOrEqual(7);
  });

  it("has at least 4 energie providers", () => {
    expect(listProvidersByCategory("ENERGIE").length).toBeGreaterThanOrEqual(4);
  });

  it("has all canonical names unique", () => {
    const names = NL_PROVIDERS.map((p) => p.canonical.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("each provider has at least 1 alias", () => {
    for (const p of NL_PROVIDERS) {
      expect(p.aliases.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("providers/findProvider", () => {
  it("matches exact canonical name (case-insensitive)", () => {
    expect(findProvider("T-Mobile")?.canonical).toBe("T-Mobile");
    expect(findProvider("t-mobile")?.canonical).toBe("T-Mobile");
  });

  it("matches by alias", () => {
    expect(findProvider("tmobile")?.canonical).toBe("T-Mobile");
    expect(findProvider("nuon")?.canonical).toBe("Vattenfall");
  });

  it("matches embedded provider mention", () => {
    expect(findProvider("KPN factuur mei")?.canonical).toBe("KPN");
  });

  it("returns null for unknown", () => {
    expect(findProvider("unknown-provider")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(findProvider("")).toBeNull();
  });

  it("identifies category", () => {
    expect(findProvider("Eneco")?.category).toBe("ENERGIE");
    expect(findProvider("Aegon")?.category).toBe("VERZEKERING");
    // v3: bare "ING" without "hypotheek" → BANK; "ING Hypotheken" → HYPOTHEEK
    expect(findProvider("ING")?.category).toBe("BANK");
    expect(findProvider("ING Hypotheken")?.category).toBe("HYPOTHEEK");
  });
});

describe("providers/allCategories", () => {
  it("returns 14 categories (v5 expanded with WATER/GEMEENTE/STREAMING/GYM/OV/SOFTWARE/OPSLAG)", () => {
    expect(allCategories().length).toBe(14);
    expect(allCategories()).toContain("TELECOM");
    expect(allCategories()).toContain("ENERGIE");
    expect(allCategories()).toContain("BANK");
    expect(allCategories()).toContain("STREAMING");
    expect(allCategories()).toContain("WATER");
    expect(allCategories()).toContain("OVERIG");
  });
});

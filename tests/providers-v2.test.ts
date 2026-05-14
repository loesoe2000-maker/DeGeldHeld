import { describe, it, expect } from "vitest";
import { NL_PROVIDERS, findProvider, listProvidersByCategory } from "../lib/providers";

describe("providers/v2 additions", () => {
  it("includes Vandebron in ENERGIE", () => {
    const v = findProvider("Vandebron");
    expect(v?.canonical).toBe("Vandebron");
    expect(v?.category).toBe("ENERGIE");
  });

  it("matches 'van de bron' alias", () => {
    expect(findProvider("van de bron")?.canonical).toBe("Vandebron");
  });

  it("includes Budget Energie", () => {
    expect(findProvider("Budget Energie")?.canonical).toBe("Budget Energie");
    expect(findProvider("budgetenergie")?.canonical).toBe("Budget Energie");
  });

  it("energie now has 6 providers", () => {
    expect(listProvidersByCategory("ENERGIE").length).toBeGreaterThanOrEqual(6);
  });

  it("total providers reaches 19+", () => {
    expect(NL_PROVIDERS.length).toBeGreaterThanOrEqual(19);
  });
});

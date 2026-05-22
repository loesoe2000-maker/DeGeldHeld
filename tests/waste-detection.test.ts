import { describe, it, expect } from "vitest";
import {
  detectWaste,
  totalPotentialMonthlyCents,
  CANCEL_GUIDANCE,
  SUBSCRIPTION_CATEGORIES,
  type WasteBill,
} from "@/lib/waste-detection";

/**
 * v28 DEEL 5 — spookabonnement-detectie. Conservatieve regels: liever geen
 * "spook" roepen dan een false positive. Self-cancel-guidance per categorie
 * (geen betaalde opzegdienst).
 */
function bill(over: Partial<WasteBill> & { id: string; provider: string; category: string }): WasteBill {
  return { monthlyCents: 1000, amountCents: 1000, ...over };
}

describe("detectWaste — provider-duplicate (sterkste signaal)", () => {
  it("zelfde provider 2× met zelfde maandbedrag → finding", () => {
    const bills = [
      bill({ id: "a", provider: "Netflix", category: "STREAMING", monthlyCents: 1495 }),
      bill({ id: "b", provider: "netflix", category: "STREAMING", monthlyCents: 1495 }),
      bill({ id: "c", provider: "Spotify", category: "STREAMING", monthlyCents: 1099 }),
    ];
    const f = detectWaste(bills);
    expect(f).toHaveLength(1); // alleen de provider-dup; netflix bezet beide bills
    expect(f[0].kind).toBe("provider-duplicate");
    expect(f[0].billIds.sort()).toEqual(["a", "b"]);
    expect(f[0].monthlyTotalCents).toBe(1495); // bespaarbaar door 1 op te zeggen
    expect(f[0].cancelGuidance).toContain("Streaming");
  });

  it("zelfde provider met DIFFERENT maandbedragen → géén provider-dup (mogelijk wel category-overlap)", () => {
    const bills = [
      bill({ id: "a", provider: "Netflix", category: "STREAMING", monthlyCents: 1495 }),
      bill({ id: "b", provider: "Netflix", category: "STREAMING", monthlyCents: 999 }),
    ];
    const provDup = detectWaste(bills).filter((f) => f.kind === "provider-duplicate");
    expect(provDup).toEqual([]); // amounts differ → geen "duidelijk dubbel"-signaal
  });
});

describe("detectWaste — category-overlap (zwakker signaal)", () => {
  it("2 STREAMING-providers → category-duplicate finding met self-cancel-tekst", () => {
    const bills = [
      bill({ id: "a", provider: "Netflix", category: "STREAMING", monthlyCents: 1495 }),
      bill({ id: "b", provider: "Disney+", category: "STREAMING", monthlyCents: 999 }),
    ];
    const f = detectWaste(bills);
    expect(f).toHaveLength(1);
    expect(f[0].kind).toBe("category-duplicate");
    expect(f[0].billIds.sort()).toEqual(["a", "b"]);
    expect(f[0].monthlyTotalCents).toBe(1495 + 999); // som van beide
    expect(f[0].cancelGuidance).toContain("Streaming");
  });

  it("1 TELECOM + 1 STREAMING → géén overlap finding", () => {
    const bills = [
      bill({ id: "a", provider: "KPN", category: "TELECOM", monthlyCents: 4000 }),
      bill({ id: "b", provider: "Netflix", category: "STREAMING", monthlyCents: 1495 }),
    ];
    expect(detectWaste(bills)).toEqual([]);
  });

  it("alleen subscription-class categorieën worden geflagd voor overlap", () => {
    // 2 ENERGIE-bills → géén category-duplicate (energie hoort niet bij SUBSCRIPTION_CATEGORIES)
    expect(SUBSCRIPTION_CATEGORIES.has("ENERGIE")).toBe(false);
    const bills = [
      bill({ id: "a", provider: "Eneco", category: "ENERGIE", monthlyCents: 12000 }),
      bill({ id: "b", provider: "Vattenfall", category: "ENERGIE", monthlyCents: 11000 }),
    ];
    expect(detectWaste(bills)).toEqual([]);
  });
});

describe("detectWaste — provider-duplicate gaat vóór category-overlap", () => {
  it("provider-duplicate bills tellen NIET ook in category-overlap (geen dubbele meldingen)", () => {
    const bills = [
      bill({ id: "a", provider: "Netflix", category: "STREAMING", monthlyCents: 1495 }),
      bill({ id: "b", provider: "Netflix", category: "STREAMING", monthlyCents: 1495 }),
      bill({ id: "c", provider: "Disney+", category: "STREAMING", monthlyCents: 999 }),
    ];
    const f = detectWaste(bills);
    // 1 provider-dup (a+b). Géén category-dup (Disney+ staat alleen na exclude).
    expect(f).toHaveLength(1);
    expect(f[0].kind).toBe("provider-duplicate");
  });

  it("provider-dup eerst in de volgorde, daarna category-dup", () => {
    const bills = [
      bill({ id: "a", provider: "Netflix", category: "STREAMING", monthlyCents: 1495 }),
      bill({ id: "b", provider: "Netflix", category: "STREAMING", monthlyCents: 1495 }),
      bill({ id: "c", provider: "Adobe", category: "SOFTWARE", monthlyCents: 2400 }),
      bill({ id: "d", provider: "Figma", category: "SOFTWARE", monthlyCents: 1500 }),
    ];
    const f = detectWaste(bills);
    expect(f.map((x) => x.kind)).toEqual(["provider-duplicate", "category-duplicate"]);
  });
});

describe("detectWaste — randgevallen", () => {
  it("lege input → lege findings", () => {
    expect(detectWaste([])).toEqual([]);
  });
  it("monthlyCents null → valt terug op amountCents", () => {
    const bills = [
      bill({ id: "a", provider: "Netflix", category: "STREAMING", monthlyCents: null, amountCents: 1495 }),
      bill({ id: "b", provider: "Netflix", category: "STREAMING", monthlyCents: null, amountCents: 1495 }),
    ];
    const f = detectWaste(bills);
    expect(f).toHaveLength(1);
    expect(f[0].kind).toBe("provider-duplicate");
  });
  it("0 monthlyCents → niet als duplicaat (geen verspilling om over te roepen)", () => {
    const bills = [
      bill({ id: "a", provider: "Netflix", category: "STREAMING", monthlyCents: 0, amountCents: 0 }),
      bill({ id: "b", provider: "Netflix", category: "STREAMING", monthlyCents: 0, amountCents: 0 }),
    ];
    const provDup = detectWaste(bills).filter((f) => f.kind === "provider-duplicate");
    expect(provDup).toEqual([]);
  });
});

describe("self-cancel-begeleiding (ethiek: gratis zelf opzeggen, geen betaalde dienst)", () => {
  it("alle subscription-class categorieën hebben een NL-begeleiding", () => {
    for (const cat of SUBSCRIPTION_CATEGORIES) {
      expect(CANCEL_GUIDANCE[cat]).toBeTruthy();
      expect(CANCEL_GUIDANCE[cat].length).toBeGreaterThan(40);
    }
  });

  it("totaal-potential = som van findings", () => {
    const bills = [
      bill({ id: "a", provider: "Netflix", category: "STREAMING", monthlyCents: 1495 }),
      bill({ id: "b", provider: "Netflix", category: "STREAMING", monthlyCents: 1495 }),
      bill({ id: "c", provider: "Adobe", category: "SOFTWARE", monthlyCents: 2400 }),
      bill({ id: "d", provider: "Figma", category: "SOFTWARE", monthlyCents: 1500 }),
    ];
    const f = detectWaste(bills);
    expect(totalPotentialMonthlyCents(f)).toBe(1495 + (2400 + 1500));
  });
});

/**
 * tests/toeslagen.test.ts — geld-check engine.
 *
 * Asserts dat de gesourcete 2026-grenzen/bedragen kloppen, dat statussen
 * (likely/maybe/unlikely) correct vallen, en dat geen enkele aanname een
 * onbron-baar bedrag uitrekent (huurtoeslag = indicatie + verwijzing).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  estimateZorgtoeslag,
  estimateHuurtoeslag,
  estimateKindgebonden,
  estimateGemeente,
  estimateBenefits,
  TOESLAGEN_PEILDATUM,
  GELD_CHECK_DISCLAIMER,
  type GeldCheckInput,
} from "@/lib/toeslagen";

function input(overrides: Partial<GeldCheckInput> = {}): GeldCheckInput {
  return {
    huishouden: "alleenstaand",
    leeftijd: 30,
    brutoJaarinkomenCents: 2_500_000, // € 25.000
    vermogenCents: 0,
    kaleHuurPerMaandCents: null,
    kinderen: [],
    postcode: null,
    ...overrides,
  };
}

describe("zorgtoeslag", () => {
  it("alleenstaand laag inkomen → likely, max € 129/mnd", () => {
    const e = estimateZorgtoeslag(input());
    expect(e.status).toBe("likely");
    expect(e.indicatieMaandCents).toBe(12_900);
    expect(e.kop).toContain("€ 129");
  });

  it("partner laag gezamenlijk inkomen → likely, max € 246/mnd", () => {
    const e = estimateZorgtoeslag(input({ huishouden: "met_partner" }));
    expect(e.status).toBe("likely");
    expect(e.indicatieMaandCents).toBe(24_600);
  });

  it("inkomen boven grens alleenstaand → unlikely", () => {
    const e = estimateZorgtoeslag(input({ brutoJaarinkomenCents: 4_500_000 })); // > € 40.857
    expect(e.status).toBe("unlikely");
    expect(e.kop).toMatch(/inkomen/i);
  });

  it("inkomen tussen grens-alleenstaand en grens-partner met partner → likely", () => {
    const e = estimateZorgtoeslag(
      input({ huishouden: "met_partner", brutoJaarinkomenCents: 4_500_000 }),
    );
    expect(e.status).toBe("likely");
  });

  it("vermogen boven grens → unlikely (vermogen te hoog)", () => {
    const e = estimateZorgtoeslag(input({ vermogenCents: 15_000_000 })); // > € 146.011
    expect(e.status).toBe("unlikely");
    expect(e.kop).toMatch(/vermogen/i);
  });

  it("jonger dan 18 → unlikely", () => {
    const e = estimateZorgtoeslag(input({ leeftijd: 17 }));
    expect(e.status).toBe("unlikely");
  });
});

describe("huurtoeslag — INDICATIE-ONLY (geen eigen bedrag)", () => {
  it("huurder + vermogen ok → maybe, geen bedrag", () => {
    const e = estimateHuurtoeslag(input({ kaleHuurPerMaandCents: 70_000 }));
    expect(e.status).toBe("maybe");
    expect(e.indicatieMaandCents).toBeNull(); // GEEN exact bedrag
    expect(e.kop).toMatch(/mogelijk/i);
  });

  it("⚠️ 2026: HOGE huur (boven € 932,93) maakt NIET ineligible (max-huurgrens vervallen als drempel)", () => {
    const e = estimateHuurtoeslag(input({ kaleHuurPerMaandCents: 110_000 })); // € 1.100/mnd
    expect(e.status).toBe("maybe"); // nog steeds mogelijk recht
  });

  it("geen huur (koopwoning) → unlikely", () => {
    const e = estimateHuurtoeslag(input({ kaleHuurPerMaandCents: null }));
    expect(e.status).toBe("unlikely");
  });

  it("vermogen boven € 38.479 (alleenstaand) → unlikely", () => {
    const e = estimateHuurtoeslag(
      input({ kaleHuurPerMaandCents: 70_000, vermogenCents: 4_000_000 }),
    );
    expect(e.status).toBe("unlikely");
  });

  it("partner: vermogensgrens ≈ 2× per persoon", () => {
    // € 70.000 (< 2× 38.479) → maybe
    const ok = estimateHuurtoeslag(
      input({
        huishouden: "met_partner",
        kaleHuurPerMaandCents: 70_000,
        vermogenCents: 7_000_000,
      }),
    );
    expect(ok.status).toBe("maybe");
    // € 80.000 (> 2× 38.479) → unlikely
    const tooHigh = estimateHuurtoeslag(
      input({
        huishouden: "met_partner",
        kaleHuurPerMaandCents: 70_000,
        vermogenCents: 8_000_000,
      }),
    );
    expect(tooHigh.status).toBe("unlikely");
  });
});

describe("kindgebonden budget", () => {
  it("geen kinderen → unlikely", () => {
    const e = estimateKindgebonden(input({ kinderen: [] }));
    expect(e.status).toBe("unlikely");
  });

  it("kind onder 12 + laag inkomen alleenstaand → likely, € 2.580 + ALO-kop", () => {
    const e = estimateKindgebonden(
      input({
        kinderen: [{ leeftijd: 8 }],
        brutoJaarinkomenCents: 2_500_000,
      }),
    );
    expect(e.status).toBe("likely");
    // € 2.580 + € 3.320 (ALO-kop) = € 5.900
    expect(e.indicatieJaarCents).toBe(258_000 + 332_000);
  });

  it("kind 12-16 met partner + laag inkomen → likely, geen ALO-kop", () => {
    const e = estimateKindgebonden(
      input({
        huishouden: "met_partner",
        kinderen: [{ leeftijd: 14 }],
        brutoJaarinkomenCents: 3_500_000,
      }),
    );
    expect(e.status).toBe("likely");
    expect(e.indicatieJaarCents).toBe(328_300); // geen ALO-kop bij partner
  });

  it("kind 16-17 telt voor € 3.516, 18+ telt niet", () => {
    const e = estimateKindgebonden(
      input({
        huishouden: "met_partner",
        kinderen: [{ leeftijd: 16 }, { leeftijd: 18 }],
        brutoJaarinkomenCents: 3_500_000,
      }),
    );
    expect(e.indicatieJaarCents).toBe(351_600);
  });

  it("inkomen boven volbedrag-grens → maybe (bouwt af), bovengrens nog getoond", () => {
    const e = estimateKindgebonden(
      input({
        kinderen: [{ leeftijd: 8 }],
        brutoJaarinkomenCents: 3_500_000, // > € 29.736 (alleenstaand)
      }),
    );
    expect(e.status).toBe("maybe");
    expect(e.kop).toMatch(/bouwt af/i);
    expect(e.indicatieJaarCents).not.toBeNull();
  });

  it("vermogen boven grens → unlikely", () => {
    const e = estimateKindgebonden(
      input({ kinderen: [{ leeftijd: 8 }], vermogenCents: 15_000_000 }),
    );
    expect(e.status).toBe("unlikely");
  });
});

describe("gemeente-regelingen", () => {
  it("laag inkomen → likely (pointer, geen bedrag)", () => {
    const e = estimateGemeente(input({ brutoJaarinkomenCents: 2_000_000 }));
    expect(e.status).toBe("likely");
    expect(e.indicatieMaandCents).toBeNull();
    expect(e.aanvraagUrl).toContain("nibud");
  });

  it("hoger inkomen → maybe (geen verzonnen drempel)", () => {
    const e = estimateGemeente(input({ brutoJaarinkomenCents: 4_500_000 }));
    expect(e.status).toBe("maybe");
  });
});

describe("estimateBenefits — totaal", () => {
  it("totaal som = zorgtoeslag/mnd + kindgebonden/12 (geen huurtoeslag-bedrag)", () => {
    const r = estimateBenefits(
      input({
        kinderen: [{ leeftijd: 8 }],
        kaleHuurPerMaandCents: 70_000,
      }),
    );
    // zorgtoeslag € 129/mnd + kindgebonden (€ 5.900/jr → €491,67/mnd, geheel)
    const verwacht = 12_900 + Math.round((258_000 + 332_000) / 12);
    expect(r.totaalIndicatieMaandCents).toBe(verwacht);
    expect(r.estimates).toHaveLength(4);
    expect(r.peildatum).toBe(TOESLAGEN_PEILDATUM);
    expect(r.disclaimer).toBe(GELD_CHECK_DISCLAIMER);
  });

  it("unlikely items tellen NIET mee in het totaal", () => {
    // Hoog inkomen → zorgtoeslag unlikely; geen kinderen, geen huur
    const r = estimateBenefits(input({ brutoJaarinkomenCents: 10_000_000 }));
    expect(r.totaalIndicatieMaandCents).toBe(0);
  });
});

describe("data-integriteit — élke regel sourced", () => {
  const src = readFileSync(resolve(__dirname, "../lib/toeslagen.ts"), "utf8");

  it("élke toeslagen-sectie heeft een // bron:-comment", () => {
    expect(src).toMatch(/ZORGTOESLAG[\s\S]*?\/\/ bron:/);
    expect(src).toMatch(/HUURTOESLAG[\s\S]*?\/\/ bron:/);
    expect(src).toMatch(/KINDGEBONDEN[\s\S]*?\/\/ bron:/);
  });

  it("expliciete peildatum + verified-at constants", () => {
    expect(src).toMatch(/TOESLAGEN_PEILDATUM\s*=\s*"2026-01-01"/);
    expect(src).toMatch(/TOESLAGEN_VERIFIED_AT\s*=\s*"2026-\d{2}-\d{2}"/);
  });

  it("verwijst naar docs/BENEFITS_DATA_2026.md (bron-van-waarheid)", () => {
    expect(src).toMatch(/BENEFITS_DATA_2026\.md/);
  });

  it("disclaimer waarschuwt expliciet dat het indicatie is + privacy-claim", () => {
    expect(GELD_CHECK_DISCLAIMER).toMatch(/indicatie/i);
    expect(GELD_CHECK_DISCLAIMER).toMatch(/slaat .* niet op/i);
  });
});

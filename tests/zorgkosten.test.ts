import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  estimateZorgkostenAftrek,
  zorgkostenDrempel,
  CHECKLIST_VEELVERGETEN,
  DREMPEL,
  ZORGKOSTEN_PEILDATUM,
  ZORGKOSTEN_VERIFIED_AT,
  type ZorgkostenInput,
} from "@/lib/zorgkosten";

/**
 * v29 DEEL 3 — Zorgkostenaftrek. Drempel-formule + AOW-113%-verhoging +
 * categorieën-lijst EXACT uit docs/V29_DATA_2026.md (Belastingdienst).
 */
function input(over: Partial<ZorgkostenInput> = {}): ZorgkostenInput {
  return {
    drempelinkomenCents: 3_500_000,
    partner: false,
    aowGerechtigd: false,
    kostenPerCategorie: {},
    ...over,
  };
}

describe("zorgkostenDrempel — formule max(min, 1,65% × inkomen)", () => {
  it("laag inkomen → minimum € 166 (alleen)", () => {
    expect(zorgkostenDrempel({ drempelinkomenCents: 500_000, partner: false })).toBe(16_600);
  });
  it("laag inkomen + partner → 2× € 166 = € 332", () => {
    expect(zorgkostenDrempel({ drempelinkomenCents: 500_000, partner: true })).toBe(33_200);
  });
  it("modaal inkomen → 1,65% (alleen)", () => {
    // € 50.000 → 1,65% = € 825
    expect(zorgkostenDrempel({ drempelinkomenCents: 5_000_000, partner: false })).toBe(82_500);
  });
  it("modaal inkomen + partner → 1,65% × 2", () => {
    expect(zorgkostenDrempel({ drempelinkomenCents: 5_000_000, partner: true })).toBe(165_000);
  });

  it("nul/negatief inkomen → minimum (geen NaN)", () => {
    expect(zorgkostenDrempel({ drempelinkomenCents: -10, partner: false })).toBe(16_600);
    expect(zorgkostenDrempel({ drempelinkomenCents: 0, partner: false })).toBe(16_600);
  });
});

describe("estimateZorgkostenAftrek — boven / onder drempel", () => {
  it("totaal kosten onder drempel → indicatieJa=false", () => {
    const r = estimateZorgkostenAftrek(
      input({
        drempelinkomenCents: 5_000_000, // drempel = € 825
        kostenPerCategorie: { medicijnen: 50_000 }, // € 500
      }),
    );
    expect(r.aftrekbaarCents).toBe(0);
    expect(r.indicatieJa).toBe(false);
    expect(r.uitleg).toMatch(/onder de drempel/i);
  });

  it("totaal kosten boven drempel → aftrekbaar = totaal − drempel", () => {
    const r = estimateZorgkostenAftrek(
      input({
        drempelinkomenCents: 5_000_000, // drempel = € 825
        kostenPerCategorie: { medicijnen: 100_000, hulpmiddelen: 50_000 }, // € 1.500
      }),
    );
    expect(r.aftrekbaarCents).toBe(150_000 - 82_500);
    expect(r.indicatieJa).toBe(true);
  });
});

describe("estimateZorgkostenAftrek — AOW-113% verhoging", () => {
  it("AOW-gerechtigd + onder inkomensgrens → verhoogbare posten × 2,13", () => {
    const withVerh = estimateZorgkostenAftrek(
      input({
        drempelinkomenCents: 2_500_000, // onder € 41.123 → verhoging in scope
        aowGerechtigd: true,
        kostenPerCategorie: { dieet: 100_000, vervoerZiekte: 100_000 }, // beide verhoogbaar
      }),
    );
    const zonderVerh = estimateZorgkostenAftrek(
      input({
        drempelinkomenCents: 2_500_000,
        aowGerechtigd: false,
        kostenPerCategorie: { dieet: 100_000, vervoerZiekte: 100_000 },
      }),
    );
    expect(withVerh.totaalKostenCents).toBeGreaterThan(zonderVerh.totaalKostenCents);
    expect(withVerh.totaalKostenCents).toBe(Math.round(200_000 * DREMPEL.aowVerhogingFactor));
  });

  it("AOW-gerechtigd + BOVEN grens → géén verhoging (totaal = som)", () => {
    const r = estimateZorgkostenAftrek(
      input({
        drempelinkomenCents: 5_000_000, // boven € 41.123
        aowGerechtigd: true,
        kostenPerCategorie: { dieet: 100_000, vervoerZiekte: 100_000 },
      }),
    );
    expect(r.bovenAowVerhogingGrens).toBe(true);
    expect(r.totaalKostenCents).toBe(200_000);
  });

  it("Verhogingsfactor wordt alléén toegepast op de aangewezen posten", () => {
    // medicijnen niet in de verhoog-lijst; vervoer wel.
    const r = estimateZorgkostenAftrek(
      input({
        drempelinkomenCents: 2_500_000,
        aowGerechtigd: true,
        kostenPerCategorie: { medicijnen: 100_000, vervoerZiekte: 100_000 },
      }),
    );
    // verwacht: 100.000 (medicijn, niet verhoogd) + 100.000 × 2,13 = 100.000 + 213.000 = 313.000
    expect(r.totaalKostenCents).toBe(100_000 + Math.round(100_000 * DREMPEL.aowVerhogingFactor));
  });
});

describe("CHECKLIST_VEELVERGETEN — sourced uit V29_DATA_2026.md", () => {
  it("bevat de wel-aftrekbare hoofdcategorieën", () => {
    const ids = CHECKLIST_VEELVERGETEN.map((c) => c.id);
    for (const expected of [
      "fysio_buiten_basis",
      "alternatieve_geneeswijzen",
      "hulpmiddelen",
      "vervoer_doktersbezoek",
      "ziekenbezoek_familie",
      "dieet_op_recept",
      "extra_gezinshulp",
      "extra_kleding_beddengoed",
      "ivf",
    ]) {
      expect(ids).toContain(expected);
    }
  });

  it("bevat de niet-aftrekbare 'val'-posten (premie / eigen risico / brillen)", () => {
    const items = new Map(CHECKLIST_VEELVERGETEN.map((c) => [c.id, c.mogelijkAftrekbaar] as const));
    expect(items.get("premie")).toBe(false);
    expect(items.get("eigen_risico")).toBe(false);
    expect(items.get("bril_lens")).toBe(false);
  });
});

describe("constants + peildatum", () => {
  it("peildatum + verifiedAt op 2026-stempels", () => {
    expect(ZORGKOSTEN_PEILDATUM).toBe("2026-01-01");
    expect(ZORGKOSTEN_VERIFIED_AT).toBe("2026-05-24");
  });

  it("drempel-formule constants matchen V29_DATA_2026.md", () => {
    expect(DREMPEL.pct).toBe(1.65);
    expect(DREMPEL.minAlleenCents).toBe(16_600); // € 166
    expect(DREMPEL.minPartnerCents).toBe(33_200); // 2× € 166
    expect(DREMPEL.aowVerhogingGrensCents).toBe(4_112_300); // € 41.123
  });
});

describe("anti-hallucinatie — élke constante is gesourcet", () => {
  const src = readFileSync(resolve(__dirname, "..", "lib/zorgkosten.ts"), "utf8");
  it("bevat tenminste twee Belastingdienst-bronnen", () => {
    const matches = src.match(/belastingdienst\.nl/gi) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(src).toMatch(/bron:/);
  });
});

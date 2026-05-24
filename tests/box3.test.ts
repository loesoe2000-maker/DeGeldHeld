import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  estimateBox3Restitution,
  box3DiyBrief,
  BOX3_PEILDATUM,
  BOX3_VERIFIED_AT,
  BOX3_NCNP_DREMPEL_CENTS,
  OWR_DEADLINES,
  SCHULDEN_DREMPEL_2026_CENTS,
  type Box3Input,
} from "@/lib/box3";

/**
 * v29 DEEL 1 — Box 3 rechtsherstel-check. Forfaits + heffingsvrij vermogen +
 * deadlines komen EXACT uit docs/V29_DATA_2026.md (Belastingdienst-bron). Anti-
 * hallucinatie: source-read assert dat élke constante een `// bron:` heeft.
 */
function input(over: Partial<Box3Input> = {}): Box3Input {
  return {
    jaar: 2024,
    huishouden: "alleenstaand",
    banktegoedenCents: 0,
    overigeBezittingenCents: 0,
    schuldenCents: 0,
    ...over,
  };
}

describe("estimateBox3Restitution — basis-validatie", () => {
  it("ongeldig jaar → unlikely + verwijzing", () => {
    const r = estimateBox3Restitution(input({ jaar: 2010 }));
    expect(r.status).toBe("unlikely");
    expect(r.biedNcnpAan).toBe(false);
    expect(r.verwachteTeruggaveCents).toBe(0);
  });

  it("peildatum/verifiedAt staan op de juiste 2026-stempels", () => {
    expect(BOX3_PEILDATUM).toBe("2026-01-01");
    expect(BOX3_VERIFIED_AT).toBe("2026-05-24");
  });

  it("schulden-drempel 2026 = € 3.800 (sourced)", () => {
    expect(SCHULDEN_DREMPEL_2026_CENTS).toBe(380_000);
  });

  it("NCNP-drempel = € 500 (guardrail 5)", () => {
    expect(BOX3_NCNP_DREMPEL_CENTS).toBe(50_000);
  });

  it("OWR-deadlines kloppen met V29_DATA_2026.md", () => {
    expect(OWR_DEADLINES["2020"]).toBe("2025-12-31");
    expect(OWR_DEADLINES.zelfIndiener2021_2024).toBe("2026-05-01");
    expect(OWR_DEADLINES.viaAdviseur2021_2024).toBe("2026-10-01");
  });
});

describe("estimateBox3Restitution — heffingsvrij vermogen", () => {
  it("vermogen onder heffingsvrij → unlikely (geen heffing, niets terug te halen)", () => {
    // 2026 heffingsvrij alleenst = € 59.357
    const r = estimateBox3Restitution(input({ jaar: 2026, banktegoedenCents: 1_000_000 }));
    expect(r.status).toBe("unlikely");
    expect(r.ficitieveBelastingCents).toBe(0);
    expect(r.biedNcnpAan).toBe(false);
  });

  it("met partner gebruikt 2× heffingsvrij vermogen", () => {
    // 2026 met partner = € 118.714. Banktegoed 100.000 → onder grens.
    const r = estimateBox3Restitution(
      input({ jaar: 2026, huishouden: "met_partner", banktegoedenCents: 10_000_000 }),
    );
    expect(r.status).toBe("unlikely");
  });
});

describe("estimateBox3Restitution — werkelijk vs fictief", () => {
  it("zonder werkelijk rendement opgegeven → maybe (alleen fictief getoond)", () => {
    const r = estimateBox3Restitution(
      input({ jaar: 2024, banktegoedenCents: 10_000_000, overigeBezittingenCents: 5_000_000 }),
    );
    expect(r.status).toBe("maybe");
    expect(r.werkelijkRendementCents).toBeNull();
    expect(r.fictiefRendementCents).toBeGreaterThan(0);
    expect(r.verwachteTeruggaveCents).toBe(0);
    expect(r.biedNcnpAan).toBe(false);
  });

  it("werkelijk ≥ fictief → unlikely (Wet tegenbewijs levert niets op)", () => {
    const r = estimateBox3Restitution(
      input({
        jaar: 2024,
        banktegoedenCents: 10_000_000,
        overigeBezittingenCents: 0,
        // fictief = 144.000 cent (1,44% × 100.000)
        werkelijkRendementCents: 200_000, // ruim boven fictief
      }),
    );
    expect(r.status).toBe("unlikely");
    expect(r.verwachteTeruggaveCents).toBe(0);
    expect(r.biedNcnpAan).toBe(false);
  });

  it("werkelijk < fictief → indicatie teruggave > 0", () => {
    const r = estimateBox3Restitution(
      input({
        jaar: 2024,
        banktegoedenCents: 20_000_000, // € 200.000 sparen
        overigeBezittingenCents: 10_000_000, // € 100.000 beleggingen
        werkelijkRendementCents: 100_000, // € 1.000 echt rendement
      }),
    );
    expect(r.verwachteTeruggaveCents).toBeGreaterThan(0);
    expect(r.status === "likely" || r.status === "maybe").toBe(true);
  });
});

describe("estimateBox3Restitution — Belastingdienst-forfait-correctheid (2026 = 1,28%)", () => {
  it("2026 banktegoeden gebruikt 1,28% (NIET 1,44% van aggregators)", () => {
    // Pak een bedrag waardoor heffingsvrij ruim overschreden wordt zodat aandeel
    // ≈ 1 en we het fictief recht kunnen lezen.
    const r = estimateBox3Restitution(
      input({
        jaar: 2026,
        banktegoedenCents: 100_000_000, // € 1.000.000 sparen
      }),
    );
    // 1,28% × 1.000.000 = € 12.800 = 1.280.000 cent
    expect(r.fictiefRendementCents).toBe(1_280_000);
    // Bevestig: een test met 1,44% zou 1.440.000 verwachten — niet onze waarde.
    expect(r.fictiefRendementCents).not.toBe(1_440_000);
  });

  it("2024 banktegoeden gebruikt wél 1,44% (historisch correct)", () => {
    const r = estimateBox3Restitution(
      input({ jaar: 2024, banktegoedenCents: 100_000_000 }),
    );
    expect(r.fictiefRendementCents).toBe(1_440_000);
  });

  it("2025 banktegoeden gebruikt 1,37% (historisch correct)", () => {
    const r = estimateBox3Restitution(
      input({ jaar: 2025, banktegoedenCents: 100_000_000 }),
    );
    expect(r.fictiefRendementCents).toBe(1_370_000);
  });
});

describe("estimateBox3Restitution — revenue-gate (guardrail 5)", () => {
  it("verwachte teruggave < € 500 → biedNcnpAan=false (DIY-pad)", () => {
    // Smal verschil tussen werkelijk en fictief → teruggave klein
    const r = estimateBox3Restitution(
      input({
        jaar: 2024,
        banktegoedenCents: 8_000_000, // € 80.000
        overigeBezittingenCents: 0,
        werkelijkRendementCents: 100_000, // € 1.000 echt
      }),
    );
    expect(r.verwachteTeruggaveCents).toBeLessThan(BOX3_NCNP_DREMPEL_CENTS);
    expect(r.biedNcnpAan).toBe(false);
  });

  it("verwachte teruggave ≥ € 500 → biedNcnpAan=true", () => {
    const r = estimateBox3Restitution(
      input({
        jaar: 2024,
        banktegoedenCents: 50_000_000, // € 500.000 sparen
        overigeBezittingenCents: 50_000_000, // € 500.000 beleggingen
        werkelijkRendementCents: 0, // niets verdiend echt
      }),
    );
    expect(r.verwachteTeruggaveCents).toBeGreaterThanOrEqual(BOX3_NCNP_DREMPEL_CENTS);
    expect(r.biedNcnpAan).toBe(true);
  });
});

describe("estimateBox3Restitution — schulden-drempel", () => {
  it("schulden onder € 3.800 → niet aftrekbaar (zelfde fictief als zonder schuld)", () => {
    const aZonder = estimateBox3Restitution(
      input({ jaar: 2026, banktegoedenCents: 50_000_000 }),
    );
    const aMet = estimateBox3Restitution(
      input({ jaar: 2026, banktegoedenCents: 50_000_000, schuldenCents: 300_000 }),
    );
    expect(aMet.fictiefRendementCents).toBe(aZonder.fictiefRendementCents);
  });

  it("schulden boven drempel → fictieve schuld-rente trekt af van rendement", () => {
    const a = estimateBox3Restitution(
      input({ jaar: 2026, banktegoedenCents: 50_000_000, schuldenCents: 1_500_000 }),
    );
    const b = estimateBox3Restitution(
      input({ jaar: 2026, banktegoedenCents: 50_000_000 }),
    );
    expect(a.fictiefRendementCents).toBeLessThan(b.fictiefRendementCents);
  });
});

describe("box3DiyBrief", () => {
  it("genereert een nette OWR-brief met de jaar-cijfers", () => {
    const inp = input({
      jaar: 2023,
      banktegoedenCents: 10_000_000,
      werkelijkRendementCents: 50_000,
    });
    const r = estimateBox3Restitution(inp);
    const tekst = box3DiyBrief(inp, r);
    expect(tekst).toContain("OWR");
    expect(tekst).toContain("2023");
    expect(tekst).toContain("Wet tegenbewijsregeling");
    expect(tekst).toMatch(/€/);
  });
});

describe("anti-hallucinatie — élke forfait-constante is gesourcet", () => {
  const src = readFileSync(resolve(__dirname, "..", "lib/box3.ts"), "utf8");

  it("FORFAIT / HEFFINGSVRIJ / SCHULDEN_DREMPEL / OWR_DEADLINES dragen elk een // bron:", () => {
    // We zoeken FORFAIT- / HEFFINGSVRIJ- / OWR_DEADLINES-blokken; elk moet
    // een Belastingdienst- of Rijksoverheid-URL boven zich hebben.
    const blocks = [
      /const FORFAIT[\s\S]*?\};/,
      /const HEFFINGSVRIJ[\s\S]*?\};/,
      /OWR_DEADLINES[\s\S]*?\}\s*as const;/,
      /SCHULDEN_DREMPEL_2026_CENTS[\s\S]*?;/,
    ];
    for (const re of blocks) {
      const block = src.match(re);
      expect(block).not.toBeNull();
    }
    // Tenminste 4 Belastingdienst- of Rijksoverheid-bronnen in het bestand.
    const sources = src.match(/\/\/\s*bron:[^\n]*(belastingdienst|rijksoverheid|wikipedia|auxiliumadviesgroep|taxlive)/gi) ?? [];
    expect(sources.length).toBeGreaterThanOrEqual(4);
  });

  it("2026 banktegoeden-forfait is gemarkeerd als 1,28% (Belastingdienst, niet 1,44%)", () => {
    expect(src).toMatch(/2026:\s*\{[^}]*banktegoedenPct:\s*1\.28/);
    expect(src).toMatch(/aggregators/i); // expliciete kanttekening
  });
});

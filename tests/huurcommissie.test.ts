/**
 * tests/huurcommissie.test.ts — V35 DEEL 1 — engine-tests voor de
 * Huurcommissie-bezwaar-check.
 *
 * Alle bedragen/deadlines sourced uit docs/V35_DATA_2026.md.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  estimateHuurServicekostenRestitutie,
  huurBezwaarBrief,
  validateHuurClaimIntent,
  computeHuurFee,
  shouldOfferHuurNcnp,
  HUUR_NCNP_DREMPEL_CENTS,
  HUURCOMMISSIE_LEGES_CENTS,
  HUURCOMMISSIE_VERHUURDER_REACTIE_DAGEN,
  HUURCOMMISSIE_BEHANDELING_MAANDEN,
  HUUR_MIN_BOEKJAAR,
  HUUR_MAX_BOEKJAAR,
  HUUR_NCNP_FEE_PCT,
  type HuurRodeVlaggen,
  type HuurServicekostenInput,
} from "@/lib/huurcommissie";

const NO_FLAGS: HuurRodeVlaggen = {
  geenSpecificatie: false,
  geenFacturen: false,
  postenNietInContract: false,
  eigenaarslastenVerrekend: false,
  verhuurderGeenAfrekening: false,
  voorschotVeelGroterDanWerkelijk: false,
};

function input(
  partial: Partial<HuurServicekostenInput> & Pick<HuurServicekostenInput, "boekjaar">,
): HuurServicekostenInput {
  return {
    voorschotTotaalCents: 0,
    werkelijkeKostenTotaalCents: 0,
    rodeVlaggen: NO_FLAGS,
    ...partial,
  };
}

describe("Huurcommissie — constanten sourced uit V35_DATA_2026.md", () => {
  it("leges + reactietijd + behandelingstijd + drempel matchen V35-doc", () => {
    expect(HUURCOMMISSIE_LEGES_CENTS).toBe(2_500); // € 25
    expect(HUURCOMMISSIE_VERHUURDER_REACTIE_DAGEN).toBe(21); // 3 weken
    expect(HUURCOMMISSIE_BEHANDELING_MAANDEN).toBe(5); // gem. 4-6 → 5
    expect(HUUR_NCNP_DREMPEL_CENTS).toBe(5_000); // € 50
    expect(HUUR_NCNP_FEE_PCT).toBe(0.2); // 20% (lager dan Box 3's 25%)
  });

  it("min/max-boekjaar dekken 2020-2025 (afrekening 2026 komt pas in 2027 binnen)", () => {
    expect(HUUR_MIN_BOEKJAAR).toBe(2020);
    expect(HUUR_MAX_BOEKJAAR).toBe(2025);
  });

  it("bron-comments wijzen naar huurcommissie.nl + Beleidsboek 2026", () => {
    const src = readFileSync(resolve(__dirname, "..", "lib/huurcommissie.ts"), "utf8");
    expect(src).toMatch(/huurcommissie\.nl/);
    expect(src).toMatch(/beleidsboek-servicekosten-januari-2026/);
    expect(src).toMatch(/art\.\s*7:259\s*BW/i);
    expect(src).toMatch(/art\.\s*7:260\s*lid\s*2\s*BW/i);
  });
});

describe("Huurcommissie — engine: rode-vlaggen-som + status-logica", () => {
  it("0 vlaggen + voorschot ≤ werkelijke kosten → status unlikely", () => {
    const r = estimateHuurServicekostenRestitutie(
      input({
        boekjaar: 2024,
        voorschotTotaalCents: 100_000,
        werkelijkeKostenTotaalCents: 120_000,
      }),
    );
    expect(r.status).toBe("unlikely");
    expect(r.biedNcnpAan).toBe(false);
    expect(r.verwachteRestitutieCents).toBe(0);
    expect(r.rodeVlaggenAantal).toBe(0);
  });

  it("verhuurder-geen-afrekening → álle voorschotten als restitutie + biedNcnpAan boven € 50", () => {
    const r = estimateHuurServicekostenRestitutie(
      input({
        boekjaar: 2024,
        voorschotTotaalCents: 120_000, // € 1.200 voorschot — ruim > € 50
        werkelijkeKostenTotaalCents: 0,
        rodeVlaggen: { ...NO_FLAGS, verhuurderGeenAfrekening: true },
      }),
    );
    expect(r.verwachteRestitutieCents).toBe(120_000);
    expect(r.status).toBe("likely");
    expect(r.biedNcnpAan).toBe(true);
    expect(r.rodeVlaggenAantal).toBe(1);
    expect(r.uitleg).toMatch(/wettelijk uiterlijk 30 juni 2025|geen eindafrekening/i);
  });

  it("verhuurder-geen-afrekening + voorschot € 30 → maybe (onder gate, géén NCNP)", () => {
    const r = estimateHuurServicekostenRestitutie(
      input({
        boekjaar: 2024,
        voorschotTotaalCents: 3_000,
        rodeVlaggen: { ...NO_FLAGS, verhuurderGeenAfrekening: true },
      }),
    );
    expect(r.verwachteRestitutieCents).toBe(3_000);
    expect(r.status).toBe("maybe");
    expect(r.biedNcnpAan).toBe(false);
  });

  it("voorschot € 1.200, werkelijk € 800 + 1 vlag → overschot + 10% verdacht", () => {
    const r = estimateHuurServicekostenRestitutie(
      input({
        boekjaar: 2024,
        voorschotTotaalCents: 120_000,
        werkelijkeKostenTotaalCents: 80_000,
        rodeVlaggen: { ...NO_FLAGS, geenSpecificatie: true },
      }),
    );
    // Overschot = € 400 = 40_000 cents. Verdacht = 10% × € 800 = 8_000 cents.
    // Totaal verwacht = 48_000 cents.
    expect(r.verwachteRestitutieCents).toBe(48_000);
    expect(r.status).toBe("likely"); // ≥ € 50 + ≥ 1 vlag
    expect(r.biedNcnpAan).toBe(true);
  });

  it("max andere-vlaggen-bonus cap = 40% (= 4 vlaggen × 10%)", () => {
    const r = estimateHuurServicekostenRestitutie(
      input({
        boekjaar: 2024,
        voorschotTotaalCents: 100_000,
        werkelijkeKostenTotaalCents: 100_000, // geen overschot
        rodeVlaggen: {
          geenSpecificatie: true,
          geenFacturen: true,
          postenNietInContract: true,
          eigenaarslastenVerrekend: true,
          verhuurderGeenAfrekening: false,
          voorschotVeelGroterDanWerkelijk: false,
        },
      }),
    );
    // 4 × 10% × € 1.000 = € 400 = 40_000 cents (cap bereikt).
    expect(r.verwachteRestitutieCents).toBe(40_000);
    expect(r.rodeVlaggenAantal).toBe(4);
  });

  it("HARD € 50-gate: net-onder is géén NCNP, net-erboven is wél NCNP", () => {
    const onder = estimateHuurServicekostenRestitutie(
      input({
        boekjaar: 2024,
        voorschotTotaalCents: 4_900,
        werkelijkeKostenTotaalCents: 0,
        rodeVlaggen: { ...NO_FLAGS, voorschotVeelGroterDanWerkelijk: true },
      }),
    );
    expect(onder.biedNcnpAan).toBe(false);
    expect(onder.status).toBe("maybe");

    const boven = estimateHuurServicekostenRestitutie(
      input({
        boekjaar: 2024,
        voorschotTotaalCents: 5_000,
        werkelijkeKostenTotaalCents: 0,
        rodeVlaggen: { ...NO_FLAGS, voorschotVeelGroterDanWerkelijk: true },
      }),
    );
    expect(boven.biedNcnpAan).toBe(true);
    expect(boven.status).toBe("likely");
  });

  it("deadlinesContext: boekjaar+1 = 30 juni, boekjaar+3 = 30 juni-bezwaartermijn", () => {
    const r = estimateHuurServicekostenRestitutie(
      input({ boekjaar: 2024, voorschotTotaalCents: 0 }),
    );
    expect(r.deadlinesContext.wettelijkeAfrekeningDeadline).toBe("30 juni 2025");
    expect(r.deadlinesContext.bezwaarDeadlineHuurcommissie).toBe("30 juni 2027");
  });

  it("shouldOfferHuurNcnp matcht biedNcnpAan-veld", () => {
    const r = estimateHuurServicekostenRestitutie(
      input({
        boekjaar: 2024,
        voorschotTotaalCents: 6_000,
        rodeVlaggen: { ...NO_FLAGS, verhuurderGeenAfrekening: true },
      }),
    );
    expect(shouldOfferHuurNcnp(r)).toBe(true);
  });
});

describe("Huurcommissie — validateHuurClaimIntent (HARD € 50-gate)", () => {
  it("v41 GRATIS: ook 4_999 cents wordt geaccepteerd (drempel vervallen)", () => {
    const r = validateHuurClaimIntent({ boekjaar: 2024, verwachteRestitutieCents: 4_999 });
    expect(r.ok).toBe(true);
  });

  it("exact € 50 = 5_000 cents → ok", () => {
    const v = validateHuurClaimIntent({ boekjaar: 2024, verwachteRestitutieCents: 5_000 });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.boekjaar).toBe(2024);
      expect(v.verwachteRestitutieCents).toBe(5_000);
      expect(v.verhuurderNaam).toBeNull();
    }
  });

  it("invalid-boekjaar buiten 2020-2025 range", () => {
    expect(validateHuurClaimIntent({ boekjaar: 2019, verwachteRestitutieCents: 10_000 }).ok).toBe(false);
    expect(validateHuurClaimIntent({ boekjaar: 2026, verwachteRestitutieCents: 10_000 }).ok).toBe(false);
    expect(validateHuurClaimIntent({ boekjaar: "abc", verwachteRestitutieCents: 10_000 }).ok).toBe(false);
  });

  it("invalid-amount: negatief of niet-integer", () => {
    expect(validateHuurClaimIntent({ boekjaar: 2024, verwachteRestitutieCents: 0 }).ok).toBe(false);
    expect(validateHuurClaimIntent({ boekjaar: 2024, verwachteRestitutieCents: -100 }).ok).toBe(false);
    expect(validateHuurClaimIntent({ boekjaar: 2024, verwachteRestitutieCents: 50.5 }).ok).toBe(false);
  });

  it("verhuurderNaam getrimmed + gecapt op 200 chars", () => {
    const v = validateHuurClaimIntent({
      boekjaar: 2024,
      verwachteRestitutieCents: 10_000,
      verhuurderNaam: "  Vesteda  ",
    });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.verhuurderNaam).toBe("Vesteda");

    const long = "x".repeat(500);
    const v2 = validateHuurClaimIntent({
      boekjaar: 2024,
      verwachteRestitutieCents: 10_000,
      verhuurderNaam: long,
    });
    if (v2.ok) expect(v2.verhuurderNaam!.length).toBe(200);
  });
});

describe("Huurcommissie — computeHuurFee (handmatige proof-back)", () => {
  it("werkelijk < € 50 → fee 0 (geen fee onder drempel)", () => {
    expect(computeHuurFee(4_999)).toBe(0);
    expect(computeHuurFee(0)).toBe(0);
    expect(computeHuurFee(-100)).toBe(0);
  });

  it("v41 GRATIS: werkelijk € 200 → fee € 0", () => {
    expect(computeHuurFee(20_000)).toBe(0);
  });

  it("v41 GRATIS: ook € 5.000 restitutie levert geen fee op", () => {
    expect(computeHuurFee(500_000)).toBe(0);
  });
});

describe("Huurcommissie — DIY-brief-generator", () => {
  it("brief bevat aanhef met verhuurdernaam + boekjaar + 3-weken-deadline", () => {
    const inp = input({
      boekjaar: 2024,
      voorschotTotaalCents: 120_000,
      werkelijkeKostenTotaalCents: 80_000,
      rodeVlaggen: { ...NO_FLAGS, geenSpecificatie: true, geenFacturen: true },
      verhuurderNaam: "Vesteda",
    });
    const r = estimateHuurServicekostenRestitutie(inp);
    const brief = huurBezwaarBrief(inp, r);
    expect(brief).toMatch(/Aan Vesteda/);
    expect(brief).toMatch(/2024/);
    expect(brief).toMatch(/3 weken|21\s*dagen/i);
    expect(brief).toMatch(/Beleidsboek Servicekosten|specificatie/i);
    expect(brief).toMatch(/Met vriendelijke groet/i);
  });

  it("zonder verhuurdernaam → generieke aanhef", () => {
    const inp = input({
      boekjaar: 2024,
      voorschotTotaalCents: 100_000,
      rodeVlaggen: { ...NO_FLAGS, verhuurderGeenAfrekening: true },
    });
    const r = estimateHuurServicekostenRestitutie(inp);
    const brief = huurBezwaarBrief(inp, r);
    expect(brief).toMatch(/Geachte verhuurder/);
    expect(brief).toMatch(/30 juni 2025/);
  });

  it("brief lijst ALLE actieve vlaggen + uitleg per vlag", () => {
    const inp = input({
      boekjaar: 2024,
      voorschotTotaalCents: 150_000,
      werkelijkeKostenTotaalCents: 100_000,
      rodeVlaggen: {
        geenSpecificatie: true,
        geenFacturen: true,
        postenNietInContract: true,
        eigenaarslastenVerrekend: true,
        verhuurderGeenAfrekening: false,
        voorschotVeelGroterDanWerkelijk: true,
      },
    });
    const r = estimateHuurServicekostenRestitutie(inp);
    const brief = huurBezwaarBrief(inp, r);
    expect(brief).toMatch(/specificatie per post/i);
    expect(brief).toMatch(/onderliggende facturen/i);
    expect(brief).toMatch(/huurovereenkomst|servicekosten-overzicht/i);
    expect(brief).toMatch(/eigenaarslasten|OZB|opstal/i);
    expect(brief).toMatch(/voorschot/i);
  });
});

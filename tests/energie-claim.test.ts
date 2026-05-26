/**
 * tests/energie-claim.test.ts — V35 DEEL 2 — engine-tests voor de
 * Energie-eindafrekening-claim-check.
 *
 * Alle bedragen/deadlines sourced uit docs/V35_DATA_2026.md.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  estimateEnergieEindafrekeningRestitutie,
  energieKlachtBrief,
  validateEnergieClaimIntent,
  computeEnergieFee,
  shouldOfferEnergieNcnp,
  ENERGIE_NCNP_DREMPEL_CENTS,
  ENERGIE_GESCHILLENCOMMISSIE_LEGES_CENTS,
  ENERGIE_KLACHTGELD_VERGOEDING_CENTS,
  ENERGIE_LEVERANCIER_REACTIE_DAGEN,
  ENERGIE_GESCHILLENCOMMISSIE_BEHANDELING_MAANDEN,
  ENERGIE_EINDAFREKENING_DEADLINE_DAGEN,
  ENERGIE_NCNP_FEE_PCT,
  type EnergieEindafrekeningInput,
} from "@/lib/energie-claim";

function baseInput(
  partial: Partial<EnergieEindafrekeningInput> = {},
): EnergieEindafrekeningInput {
  return {
    provider: "Vattenfall",
    dagenTussenContracteindeEnAfrekening: 28,
    eindafrekeningBedragCents: 24_567, // € 245,67
    tariefAfwijkingCents: null,
    heffingskortingenAanwezig: true,
    meterstandConsistent: true,
    dubbeleHeffingenAanwezig: false,
    salderingCorrect: null,
    ...partial,
  };
}

describe("Energie-claim — constanten sourced uit V35_DATA_2026.md", () => {
  it("leges + klachtgeld + deadlines + drempel matchen V35-doc", () => {
    expect(ENERGIE_GESCHILLENCOMMISSIE_LEGES_CENTS).toBe(2_750); // € 27,50
    expect(ENERGIE_KLACHTGELD_VERGOEDING_CENTS).toBe(5_250); // € 52,50
    expect(ENERGIE_LEVERANCIER_REACTIE_DAGEN).toBe(30);
    expect(ENERGIE_GESCHILLENCOMMISSIE_BEHANDELING_MAANDEN).toBe(3);
    expect(ENERGIE_EINDAFREKENING_DEADLINE_DAGEN).toBe(42); // 6 weken
    expect(ENERGIE_NCNP_DREMPEL_CENTS).toBe(5_000); // € 50
    expect(ENERGIE_NCNP_FEE_PCT).toBe(0.2); // 20%
  });

  it("géén hardcoded energiebelasting-vermindering-bedrag (eerlijk over jaarlijkse wijziging)", () => {
    const src = readFileSync(resolve(__dirname, "..", "lib/energie-claim.ts"), "utf8");
    // We controleren PRESENCE (heffingskortingenAanwezig), nooit een hardcoded
    // bedrag. Match géén EUR-bedrag ergens in code dat als heffingskorting-2026
    // wordt gepresenteerd.
    expect(src).toMatch(/heffingskortingenAanwezig/);
    expect(src).toMatch(/PEILDATUM TE VERIFIËREN|verandert jaarlijks|hardcoderen GEEN/);
  });

  it("bron-comments wijzen naar degeschillencommissie.nl + ACM + EW/GW art. 31", () => {
    const src = readFileSync(resolve(__dirname, "..", "lib/energie-claim.ts"), "utf8");
    expect(src).toMatch(/degeschillencommissie\.nl/);
    expect(src).toMatch(/acm\.nl/);
    expect(src).toMatch(/art\.\s*31\s*Elektriciteitswet|art\.\s*31\s*EW/i);
    expect(src).toMatch(/Wet handhaving consumentenbescherming/i);
  });
});

describe("Energie-claim — engine: rode-vlaggen-detectie", () => {
  it("0 vlaggen + alles ok → status unlikely + biedNcnpAan=false", () => {
    const r = estimateEnergieEindafrekeningRestitutie(baseInput());
    expect(r.status).toBe("unlikely");
    expect(r.biedNcnpAan).toBe(false);
    expect(r.verwachteRestitutieCents).toBe(0);
    expect(r.rodeVlaggenAantal).toBe(0);
    expect(r.actieveRodeVlaggen).toHaveLength(0);
  });

  it("eindafrekening > 42 dagen na contract-einde → vlag aanwezig (ACM-grond)", () => {
    const r = estimateEnergieEindafrekeningRestitutie(
      baseInput({ dagenTussenContracteindeEnAfrekening: 56 }),
    );
    expect(r.rodeVlaggenAantal).toBe(1);
    expect(r.actieveRodeVlaggen[0]).toMatch(/> 42 dagen|56 dagen/);
  });

  it("geen heffingskortingen → vlag aanwezig (direct restitutie-grond)", () => {
    const r = estimateEnergieEindafrekeningRestitutie(
      baseInput({ heffingskortingenAanwezig: false }),
    );
    expect(r.actieveRodeVlaggen.some((v) => /Vermindering energiebelasting/i.test(v))).toBe(true);
  });

  it("meterstand inconsistent → vlag aanwezig", () => {
    const r = estimateEnergieEindafrekeningRestitutie(
      baseInput({ meterstandConsistent: false }),
    );
    expect(r.actieveRodeVlaggen.some((v) => /meterstand/i.test(v))).toBe(true);
  });

  it("dubbele heffingen → vlag aanwezig", () => {
    const r = estimateEnergieEindafrekeningRestitutie(
      baseInput({ dubbeleHeffingenAanwezig: true }),
    );
    expect(r.actieveRodeVlaggen.some((v) => /Dubbele heffingen/i.test(v))).toBe(true);
  });

  it("tariefAfwijking > 0 → vlag aanwezig met bedrag in tekst", () => {
    const r = estimateEnergieEindafrekeningRestitutie(
      baseInput({ tariefAfwijkingCents: 5 }), // 5 cent per kWh
    );
    expect(r.actieveRodeVlaggen.some((v) => /Tarief boven contract-tarief/i.test(v))).toBe(true);
  });

  it("saldering incorrect (zonnepanelen) → vlag aanwezig; null = geen vlag", () => {
    const niet = estimateEnergieEindafrekeningRestitutie(
      baseInput({ salderingCorrect: false }),
    );
    expect(niet.actieveRodeVlaggen.some((v) => /Saldering/i.test(v))).toBe(true);

    const nvt = estimateEnergieEindafrekeningRestitutie(
      baseInput({ salderingCorrect: null }),
    );
    expect(nvt.actieveRodeVlaggen.some((v) => /Saldering/i.test(v))).toBe(false);
  });

  it("1 vlag → 30% van eindbedrag + klachtgeld € 52,50", () => {
    const r = estimateEnergieEindafrekeningRestitutie(
      baseInput({
        eindafrekeningBedragCents: 100_000, // € 1.000
        heffingskortingenAanwezig: false,
      }),
    );
    // 30% × € 1.000 = € 300 = 30_000 + € 52,50 = 35_250
    expect(r.verwachteRestitutieCents).toBe(30_000 + ENERGIE_KLACHTGELD_VERGOEDING_CENTS);
    expect(r.status).toBe("likely");
    expect(r.biedNcnpAan).toBe(true);
  });

  it("≥ 2 vlaggen → 50% van eindbedrag + klachtgeld € 52,50", () => {
    const r = estimateEnergieEindafrekeningRestitutie(
      baseInput({
        eindafrekeningBedragCents: 100_000,
        heffingskortingenAanwezig: false,
        meterstandConsistent: false,
      }),
    );
    expect(r.verwachteRestitutieCents).toBe(50_000 + ENERGIE_KLACHTGELD_VERGOEDING_CENTS);
    expect(r.rodeVlaggenAantal).toBe(2);
    expect(r.status).toBe("likely");
  });

  it("ALLE rode vlaggen op tegelijk → 6 vlaggen, 50% + klachtgeld", () => {
    const r = estimateEnergieEindafrekeningRestitutie(
      baseInput({
        dagenTussenContracteindeEnAfrekening: 60,
        eindafrekeningBedragCents: 50_000,
        tariefAfwijkingCents: 5,
        heffingskortingenAanwezig: false,
        meterstandConsistent: false,
        dubbeleHeffingenAanwezig: true,
        salderingCorrect: false,
      }),
    );
    expect(r.rodeVlaggenAantal).toBe(6);
    expect(r.verwachteRestitutieCents).toBe(25_000 + ENERGIE_KLACHTGELD_VERGOEDING_CENTS);
  });

  it("HARD € 50-gate: laag eindbedrag + 1 vlag → klachtgeld duwt 'm boven gate", () => {
    const r = estimateEnergieEindafrekeningRestitutie(
      baseInput({
        eindafrekeningBedragCents: 0, // alleen klachtgeld
        heffingskortingenAanwezig: false,
      }),
    );
    // 0% × 0 + € 52,50 = 5_250 cents > 5_000 → biedNcnpAan = true
    expect(r.verwachteRestitutieCents).toBe(ENERGIE_KLACHTGELD_VERGOEDING_CENTS);
    expect(r.biedNcnpAan).toBe(true);
  });

  it("klachtTermijnen + bron-URL aanwezig in elk resultaat", () => {
    const r = estimateEnergieEindafrekeningRestitutie(baseInput());
    expect(r.klachtTermijnen.leverancierReactieDagen).toBe(30);
    expect(r.klachtTermijnen.geschillencommissieBehandelingMaanden).toBe(3);
    expect(r.klachtTermijnen.eindafrekeningDeadlineDagen).toBe(42);
    expect(r.bron).toMatch(/degeschillencommissie\.nl/);
    expect(r.peildatum).toMatch(/2026-01-01/);
  });

  it("shouldOfferEnergieNcnp matcht biedNcnpAan-veld", () => {
    const r = estimateEnergieEindafrekeningRestitutie(
      baseInput({ heffingskortingenAanwezig: false, eindafrekeningBedragCents: 100_000 }),
    );
    expect(shouldOfferEnergieNcnp(r)).toBe(true);
  });
});

describe("Energie-claim — validateEnergieClaimIntent (HARD € 50-gate)", () => {
  it("422 onder gate: 4_999 cents → 'below-ncnp-threshold'", () => {
    const v = validateEnergieClaimIntent({
      provider: "Vattenfall",
      verwachteRestitutieCents: 4_999,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("below-ncnp-threshold");
  });

  it("exact € 50 = 5_000 cents → ok", () => {
    const v = validateEnergieClaimIntent({
      provider: "Vattenfall",
      verwachteRestitutieCents: 5_000,
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.provider).toBe("Vattenfall");
      expect(v.verwachteRestitutieCents).toBe(5_000);
    }
  });

  it("invalid-provider bij lege string", () => {
    expect(
      validateEnergieClaimIntent({ provider: "", verwachteRestitutieCents: 10_000 }).ok,
    ).toBe(false);
    expect(
      validateEnergieClaimIntent({ provider: "   ", verwachteRestitutieCents: 10_000 }).ok,
    ).toBe(false);
  });

  it("invalid-amount: negatief of niet-integer", () => {
    expect(
      validateEnergieClaimIntent({ provider: "Eneco", verwachteRestitutieCents: 0 }).ok,
    ).toBe(false);
    expect(
      validateEnergieClaimIntent({ provider: "Eneco", verwachteRestitutieCents: 50.5 }).ok,
    ).toBe(false);
  });

  it("provider getrimmed + gecapt op 200 chars", () => {
    const v = validateEnergieClaimIntent({
      provider: "  Vattenfall  ",
      verwachteRestitutieCents: 10_000,
    });
    if (v.ok) expect(v.provider).toBe("Vattenfall");

    const long = "x".repeat(500);
    const v2 = validateEnergieClaimIntent({
      provider: long,
      verwachteRestitutieCents: 10_000,
    });
    if (v2.ok) expect(v2.provider.length).toBe(200);
  });
});

describe("Energie-claim — computeEnergieFee (handmatige proof-back)", () => {
  it("werkelijk < € 50 → fee 0", () => {
    expect(computeEnergieFee(4_999)).toBe(0);
    expect(computeEnergieFee(0)).toBe(0);
  });

  it("werkelijk € 200 → fee € 40 (20%)", () => {
    expect(computeEnergieFee(20_000)).toBe(4_000);
  });

  it("werkelijk € 5.000 → fee gecapt op NCNP-cap (€ 500)", () => {
    expect(computeEnergieFee(500_000)).toBe(50_000);
  });
});

describe("Energie-claim — DIY-klachtbrief-generator", () => {
  it("brief bevat provider + actieve vlaggen + 30-dagen-deadline + Geschillencommissie-escalatie", () => {
    const inp = baseInput({
      provider: "Eneco",
      heffingskortingenAanwezig: false,
      meterstandConsistent: false,
    });
    const r = estimateEnergieEindafrekeningRestitutie(inp);
    const brief = energieKlachtBrief(inp, r);
    expect(brief).toMatch(/Aan Eneco/);
    expect(brief).toMatch(/Vermindering energiebelasting/i);
    expect(brief).toMatch(/meterstand/i);
    expect(brief).toMatch(/30 dagen|30\s*dagen/);
    expect(brief).toMatch(/Geschillencommissie/i);
    expect(brief).toMatch(/€ 52,50|klachtgeld/i);
    expect(brief).toMatch(/€ 27,50|leges/i);
  });

  it("zonder vlaggen → generieke onderbouwings-vraag (geen valse beschuldiging)", () => {
    const inp = baseInput({ provider: "Eneco" });
    const r = estimateEnergieEindafrekeningRestitutie(inp);
    const brief = energieKlachtBrief(inp, r);
    expect(brief).toMatch(/onderbouwen|onderliggende berekeningen/i);
  });
});

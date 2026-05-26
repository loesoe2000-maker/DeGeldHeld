/**
 * scripts/v31-validate-paths.ts — V31 engine validation harness.
 *
 * Runt ALLE pure rule-engines (geld-check, box 3, NS, zorgkosten, EU261,
 * waste-detection) met realistische user-paden + bekende verwachte uitkomsten.
 * Print een mensleesbaar PASS/FAIL-rapport.
 *
 * **Geen webserver nodig.** Pure functies in, pure waarden uit.
 *
 * Run: `npx tsx scripts/v31-validate-paths.ts` of `npm run validate:v31`.
 * Exit code 0 = alle pass · 1 = een of meer fail.
 */
import { estimateBenefits } from "@/lib/toeslagen";
import { estimateBox3Restitution } from "@/lib/box3";
import { nsCompensation } from "@/lib/ns";
import { estimateZorgkostenAftrek } from "@/lib/zorgkosten";
import { eu261Compensation } from "@/lib/eu261";
import { detectWaste, type WasteBill } from "@/lib/waste-detection";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const eurFmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function fmtCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return eurFmt.format(cents / 100);
}

type CaseResult = {
  name: string;
  pass: boolean;
  expected: string;
  actual: string;
};

type Section = { check: string; cases: CaseResult[] };

const SECTIONS: Section[] = [];

function section(check: string): Section {
  const s: Section = { check, cases: [] };
  SECTIONS.push(s);
  return s;
}

function assert(s: Section, name: string, expected: string, actual: string, ok: boolean): void {
  s.cases.push({ name, pass: ok, expected, actual });
}

// ─── 1. Geld-check (toeslagen + gemeente) ────────────────────────────────────

function testGeldCheck() {
  const s = section("Geld-check (toeslagen + gemeente)");

  // Case 1: Max zorgtoeslag alleenstaand
  {
    const r = estimateBenefits({
      huishouden: "alleenstaand",
      leeftijd: 30,
      brutoJaarinkomenCents: 2_500_000, // € 25.000
      vermogenCents: 0,
      kaleHuurPerMaandCents: null,
      kinderen: [],
      postcode: null,
    });
    const z = r.estimates.find((e) => e.id === "zorgtoeslag")!;
    assert(
      s,
      "Alleenstaand 30j · € 25k · geen vermogen/huur/kinderen",
      "zorgtoeslag: likely · € 1,29/mnd (max)",
      `zorgtoeslag: ${z.status} · ${fmtCents(z.indicatieMaandCents)}/mnd`,
      z.status === "likely" && z.indicatieMaandCents === 12_900,
    );
  }

  // Case 2: Inkomen te hoog → zorg unlikely
  {
    const r = estimateBenefits({
      huishouden: "alleenstaand",
      leeftijd: 30,
      brutoJaarinkomenCents: 5_000_000, // > € 40.857
      vermogenCents: 0,
      kaleHuurPerMaandCents: null,
      kinderen: [],
      postcode: null,
    });
    const z = r.estimates.find((e) => e.id === "zorgtoeslag")!;
    assert(
      s,
      "Inkomen € 50k → zorgtoeslag unlikely",
      "zorgtoeslag: unlikely (inkomen te hoog)",
      `zorgtoeslag: ${z.status} · ${z.kop}`,
      z.status === "unlikely",
    );
  }

  // Case 3: Vermogen te hoog → zorg unlikely
  {
    const r = estimateBenefits({
      huishouden: "alleenstaand",
      leeftijd: 30,
      brutoJaarinkomenCents: 2_000_000,
      vermogenCents: 20_000_000, // > € 146.011
      kaleHuurPerMaandCents: null,
      kinderen: [],
      postcode: null,
    });
    const z = r.estimates.find((e) => e.id === "zorgtoeslag")!;
    assert(
      s,
      "Vermogen € 200k → zorgtoeslag unlikely",
      "zorgtoeslag: unlikely (vermogen te hoog)",
      `zorgtoeslag: ${z.status} · ${z.kop}`,
      z.status === "unlikely",
    );
  }

  // Case 4: Huurder + ok vermogen → huurtoeslag maybe (indicatie, geen bedrag)
  {
    const r = estimateBenefits({
      huishouden: "alleenstaand",
      leeftijd: 25,
      brutoJaarinkomenCents: 2_200_000,
      vermogenCents: 100_000, // € 1k
      kaleHuurPerMaandCents: 65_000, // € 650
      kinderen: [],
      postcode: null,
    });
    const h = r.estimates.find((e) => e.id === "huurtoeslag")!;
    assert(
      s,
      "Huurder 25j · € 22k · huur € 650 → huurtoeslag maybe",
      "huurtoeslag: maybe · indicatieMaandCents=null",
      `huurtoeslag: ${h.status} · indicatie=${fmtCents(h.indicatieMaandCents)}`,
      h.status === "maybe" && h.indicatieMaandCents === null,
    );
  }

  // Case 5: ⚠️ 2026-regressie-guard: HOGE huur > € 932,93 → NIET unlikely
  {
    const r = estimateBenefits({
      huishouden: "alleenstaand",
      leeftijd: 30,
      brutoJaarinkomenCents: 2_500_000,
      vermogenCents: 0,
      kaleHuurPerMaandCents: 110_000, // € 1.100/mnd > rekengrens
      kinderen: [],
      postcode: null,
    });
    const h = r.estimates.find((e) => e.id === "huurtoeslag")!;
    assert(
      s,
      "⚠️ Huur € 1.100/mnd (boven rekengrens 2026) → STEEDS maybe",
      "huurtoeslag: maybe (max-huurgrens is in 2026 GEEN drempel meer)",
      `huurtoeslag: ${h.status}`,
      h.status === "maybe",
    );
  }

  // Case 6: Alleenstaande ouder + 2 kinderen → kindgebonden likely incl. ALO-kop
  {
    const r = estimateBenefits({
      huishouden: "alleenstaand",
      leeftijd: 35,
      brutoJaarinkomenCents: 2_500_000,
      vermogenCents: 0,
      kaleHuurPerMaandCents: null,
      kinderen: [{ leeftijd: 8 }, { leeftijd: 14 }],
      postcode: null,
    });
    const k = r.estimates.find((e) => e.id === "kindgebonden_budget")!;
    // € 2.580 (jong) + € 3.283 (12-16) + € 3.320 (ALO-kop) = € 9.183/jr
    assert(
      s,
      "Alleenst. ouder · 2 kinderen (8 + 14) → kindgebonden likely + ALO-kop",
      "kindgebonden: likely · € 9.183/jr",
      `kindgebonden: ${k.status} · ${fmtCents(k.indicatieJaarCents)}/jr`,
      k.status === "likely" && k.indicatieJaarCents === 258_000 + 328_300 + 332_000,
    );
  }
}

// ─── 2. Box 3-rechtsherstel ──────────────────────────────────────────────────

function testBox3() {
  const s = section("Box 3-rechtsherstel");

  // Case 1: Banktegoeden boven heffingsvrij, jaar met POSITIEF forfait, werkelijk € 0 → teruggave > 0
  // (2022 had banktegoeden-forfait 0,00% door extreem lage spaarrentes — geen verschil = geen
  // teruggave. We testen 2024 waar forfait 1,44% is = veelvoorkomende real-world case.)
  {
    const r = estimateBox3Restitution({
      jaar: 2024,
      huishouden: "alleenstaand",
      banktegoedenCents: 20_000_000, // € 200k spaargeld
      overigeBezittingenCents: 0,
      schuldenCents: 0,
      werkelijkRendementCents: 0,
    });
    assert(
      s,
      "Spaarder € 200k · 2024 (forfait 1,44%) · werkelijk € 0 → teruggave > € 0",
      "verwachteTeruggaveCents > 0 (fictief > werkelijk)",
      `status=${r.status} · verwachteTeruggave=${fmtCents(r.verwachteTeruggaveCents)}`,
      r.verwachteTeruggaveCents > 0,
    );
  }

  // Case 1b (eerlijke regressie-guard): 2022 had banktegoeden-forfait 0,00% →
  // OOK met groot spaargeld géén teruggave. Engine moet dit goed afhandelen.
  {
    const r = estimateBox3Restitution({
      jaar: 2022,
      huishouden: "alleenstaand",
      banktegoedenCents: 20_000_000,
      overigeBezittingenCents: 0,
      schuldenCents: 0,
      werkelijkRendementCents: 0,
    });
    assert(
      s,
      "⚠️ Spaarder € 200k · 2022 (forfait 0,00%) → géén teruggave (engine moet dit klopt afhandelen)",
      "teruggave: € 0 (fictief == werkelijk == € 0)",
      `teruggave=${fmtCents(r.verwachteTeruggaveCents)}`,
      r.verwachteTeruggaveCents === 0,
    );
  }

  // Case 2: Vermogen onder heffingsvrij → geen rechtsherstel zinvol
  {
    const r = estimateBox3Restitution({
      jaar: 2023,
      huishouden: "alleenstaand",
      banktegoedenCents: 1_000_000, // € 10k onder heffingsvrij € 57.000
      overigeBezittingenCents: 0,
      schuldenCents: 0,
      werkelijkRendementCents: 0,
    });
    assert(
      s,
      "Vermogen € 10k (onder heffingsvrij) → unlikely",
      "status: unlikely · teruggave: € 0",
      `status=${r.status} · teruggave=${fmtCents(r.verwachteTeruggaveCents)}`,
      r.status === "unlikely",
    );
  }

  // Case 3: ≥ € 500 verwachte teruggave → NCNP-aanbod
  {
    const r = estimateBox3Restitution({
      jaar: 2023,
      huishouden: "alleenstaand",
      banktegoedenCents: 50_000_000, // € 500k spaargeld
      overigeBezittingenCents: 0,
      schuldenCents: 0,
      werkelijkRendementCents: 0,
    });
    const aboveDrempel = r.verwachteTeruggaveCents >= 50_000;
    assert(
      s,
      "Spaarder € 500k · 2023 · teruggave ≥ € 500 → NCNP-aanbod",
      "verwachteTeruggave ≥ € 500 (NCNP-drempel triggert)",
      `teruggave=${fmtCents(r.verwachteTeruggaveCents)} · drempel-bereikt=${aboveDrempel}`,
      aboveDrempel,
    );
  }

  // Case 4: Werkelijk rendement > fictief → géén teruggave
  {
    const r = estimateBox3Restitution({
      jaar: 2023,
      huishouden: "alleenstaand",
      banktegoedenCents: 0,
      overigeBezittingenCents: 20_000_000, // € 200k beleggingen
      schuldenCents: 0,
      werkelijkRendementCents: 3_000_000, // € 30k werkelijk rendement (>> fictief)
    });
    assert(
      s,
      "Beleggingen € 200k · werkelijk € 30k > fictief → geen teruggave",
      "teruggave: € 0 of negatief",
      `teruggave=${fmtCents(r.verwachteTeruggaveCents)}`,
      r.verwachteTeruggaveCents <= 0,
    );
  }
}

// ─── 3. NS Geld-Terug ────────────────────────────────────────────────────────

function testNs() {
  const s = section("NS Geld-Terug bij Vertraging");

  // Case 1: 35 min vertraging op € 15 ticket → 50% = € 7,50
  {
    const r = nsCompensation({ ticketCents: 1500, delayMinutes: 35 });
    assert(
      s,
      "Ticket € 15 · vertraging 35 min → 50% (€ 7,50)",
      "compensation=€ 7,50 · eligible=true",
      `compensation=${fmtCents(r.compensationCents)} · eligible=${r.eligible}`,
      r.eligible && r.compensationCents === 750,
    );
  }

  // Case 2: 65 min op € 15 → 100% = € 15
  {
    const r = nsCompensation({ ticketCents: 1500, delayMinutes: 65 });
    assert(
      s,
      "Ticket € 15 · vertraging 65 min → 100% (€ 15)",
      "compensation=€ 15 · eligible=true",
      `compensation=${fmtCents(r.compensationCents)} · eligible=${r.eligible}`,
      r.eligible && r.compensationCents === 1500,
    );
  }

  // Case 3: 25 min → onder drempel
  {
    const r = nsCompensation({ ticketCents: 1500, delayMinutes: 25 });
    assert(
      s,
      "Ticket € 15 · vertraging 25 min → géén recht (< 30 min)",
      "eligible=false",
      `eligible=${r.eligible} · compensation=${fmtCents(r.compensationCents)}`,
      !r.eligible,
    );
  }

  // Case 4: 50% van € 4 = € 2 → onder min-claim € 2,30
  {
    const r = nsCompensation({ ticketCents: 400, delayMinutes: 35 });
    assert(
      s,
      "Ticket € 4 · 35 min → 50% = € 2 (onder min-claim € 2,30)",
      "eligible=false (claim < € 2,30)",
      `eligible=${r.eligible} · compensation=${fmtCents(r.compensationCents)}`,
      !r.eligible,
    );
  }

  // Case 5: Vrij/Flex → verwijzing
  {
    const r = nsCompensation({ ticketCents: 1500, delayMinutes: 65, isVrijOfFlex: true });
    assert(
      s,
      "Vrij/Flex-abonnement → ABONNEMENT_VERWIJS regime",
      "regime=ABONNEMENT_VERWIJS · compensation=0 (verwijzing naar Mijn NS)",
      `regime=${r.regime} · compensation=${fmtCents(r.compensationCents)}`,
      r.regime === "ABONNEMENT_VERWIJS",
    );
  }
}

// ─── 4. Zorgkostenaftrek ─────────────────────────────────────────────────────

function testZorgkosten() {
  const s = section("Zorgkostenaftrek");

  // Case 1: Laag inkomen + € 1.500 kosten → aftrek boven drempel
  {
    const r = estimateZorgkostenAftrek({
      drempelinkomenCents: 2_000_000, // € 20k → drempel max(166, 1.65% × 20k) = € 330
      partner: false,
      aowGerechtigd: false,
      kostenPerCategorie: {
        geneeskundigeHulp: 100_000, // € 1.000
        medicijnen: 50_000, // € 500
      },
    });
    // Drempel ~ € 330; totaal € 1.500 → aftrek ~ € 1.170 (geen verhoging)
    assert(
      s,
      "Drempelinkomen € 20k · zorgkosten € 1.500 → aftrek boven drempel",
      "aftrekbaar > 0 · indicatieJa=true",
      `aftrek=${fmtCents(r.aftrekbaarCents)} · drempel=${fmtCents(r.drempelCents)} · indicatieJa=${r.indicatieJa}`,
      r.aftrekbaarCents > 0 && r.indicatieJa,
    );
  }

  // Case 2: Hoog inkomen + lage kosten → onder drempel, geen aftrek
  {
    const r = estimateZorgkostenAftrek({
      drempelinkomenCents: 10_000_000, // € 100k → drempel = € 1.650
      partner: false,
      aowGerechtigd: false,
      kostenPerCategorie: {
        medicijnen: 30_000, // € 300
      },
    });
    assert(
      s,
      "Drempelinkomen € 100k · kosten € 300 → onder drempel, geen aftrek",
      "aftrekbaar=0 · indicatieJa=false",
      `aftrek=${fmtCents(r.aftrekbaarCents)} · drempel=${fmtCents(r.drempelCents)}`,
      r.aftrekbaarCents === 0 && !r.indicatieJa,
    );
  }

  // Case 3: Géén zorgkosten → geen aftrek
  {
    const r = estimateZorgkostenAftrek({
      drempelinkomenCents: 3_000_000,
      partner: false,
      aowGerechtigd: false,
      kostenPerCategorie: {},
    });
    assert(
      s,
      "Geen zorgkosten opgegeven → 0 aftrek",
      "aftrekbaar=0",
      `aftrek=${fmtCents(r.aftrekbaarCents)}`,
      r.aftrekbaarCents === 0,
    );
  }
}

// ─── 5. EU261 vluchtcompensatie ──────────────────────────────────────────────

function testEu261() {
  const s = section("EU261 vluchtcompensatie");

  const cases: Array<{ label: string; input: Parameters<typeof eu261Compensation>[0]; expectCents: number; expectEligible: boolean }> = [
    { label: "800 km · 200 min EU → € 250", input: { distanceKm: 800, delayMinutes: 200, withinEU: true }, expectCents: 25_000, expectEligible: true },
    { label: "2500 km · 200 min EU → € 400", input: { distanceKm: 2500, delayMinutes: 200, withinEU: true }, expectCents: 40_000, expectEligible: true },
    { label: "6000 km · 260 min → € 600", input: { distanceKm: 6000, delayMinutes: 260, withinEU: false }, expectCents: 60_000, expectEligible: true },
    { label: "800 km · 175 min → géén recht", input: { distanceKm: 800, delayMinutes: 175, withinEU: true }, expectCents: 0, expectEligible: false },
    { label: "6000 km · 200 min (long < 4u) → géén vol recht", input: { distanceKm: 6000, delayMinutes: 200, withinEU: false }, expectCents: 0, expectEligible: false },
  ];

  for (const c of cases) {
    const r = eu261Compensation(c.input);
    const pass = r.eligible === c.expectEligible && r.amountCents === c.expectCents;
    assert(
      s,
      c.label,
      `amount=${fmtCents(c.expectCents)} · eligible=${c.expectEligible}`,
      `amount=${fmtCents(r.amountCents)} · eligible=${r.eligible} · band=${r.band}`,
      pass,
    );
  }
}

// ─── 6. Waste detection ──────────────────────────────────────────────────────

function testWasteDetection() {
  const s = section("Spookabonnement-detectie");

  // Case 1: Lege lijst → 0 findings
  {
    const findings = detectWaste([]);
    assert(s, "Lege bills-lijst → 0 findings", "0 findings", `${findings.length} findings`, findings.length === 0);
  }

  // Case 2: Twee STREAMING-abonnementen → category-duplicate
  {
    const bills: WasteBill[] = [
      { id: "b1", provider: "Netflix", category: "STREAMING", monthlyCents: 1599, amountCents: 1599 },
      { id: "b2", provider: "Disney+", category: "STREAMING", monthlyCents: 1099, amountCents: 1099 },
    ];
    const findings = detectWaste(bills);
    const hasDup = findings.some((f) => f.kind === "category-duplicate");
    assert(
      s,
      "Netflix + Disney+ → category-duplicate finding",
      "≥ 1 category-duplicate finding",
      `${findings.length} findings · types=${findings.map((f) => f.kind).join(", ")}`,
      hasDup,
    );
  }

  // Case 3: Twee Spotify-rekeningen → provider-duplicate
  {
    const bills: WasteBill[] = [
      { id: "b1", provider: "Spotify", category: "STREAMING", monthlyCents: 1299, amountCents: 1299 },
      { id: "b2", provider: "Spotify", category: "STREAMING", monthlyCents: 1299, amountCents: 1299 },
    ];
    const findings = detectWaste(bills);
    const hasDup = findings.some((f) => f.kind === "provider-duplicate");
    assert(
      s,
      "2× Spotify → provider-duplicate finding",
      "≥ 1 provider-duplicate finding",
      `types=${findings.map((f) => f.kind).join(", ")}`,
      hasDup,
    );
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

function printReport() {
  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  console.log("\n" + "═".repeat(78));
  console.log("V31 VALIDATION REPORT — pure engines (geen webserver)");
  console.log(`Datum: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`);
  console.log("═".repeat(78));

  for (const sec of SECTIONS) {
    console.log(`\n▸ ${sec.check}\n`);
    for (const c of sec.cases) {
      const icon = c.pass ? "✓" : "✗";
      console.log(`  ${icon} ${c.name}`);
      console.log(`      verwacht:  ${c.expected}`);
      console.log(`      werkelijk: ${c.actual}`);
      if (c.pass) {
        pass++;
      } else {
        fail++;
        failures.push(`[${sec.check}] ${c.name}`);
      }
    }
  }

  console.log("\n" + "═".repeat(78));
  console.log(`TOTAAL: ${pass} pass · ${fail} fail`);
  if (fail > 0) {
    console.log("\nFAILED CASES:");
    for (const f of failures) console.log(`  ✗ ${f}`);
  }
  console.log("═".repeat(78) + "\n");

  process.exit(fail > 0 ? 1 : 0);
}

// ─── Main ────────────────────────────────────────────────────────────────────

testGeldCheck();
testBox3();
testNs();
testZorgkosten();
testEu261();
testWasteDetection();
printReport();

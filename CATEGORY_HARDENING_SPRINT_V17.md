# DeGeldHeld v17 — Category Hardening Sprint

**Doel:** élke vaste-lasten categorie (water, gas/energie, hypotheek,
verzekering) berekent een besparing op de **échte factuur van de
gebruiker**, niet op hardcoded marktgetallen. Plus: providers compleet
maken en élk categorie-pad testen + bugs fixen.

## Kernprobleem dat deze sprint oplost

De OCR (`lib/ocr.ts`) extraheert al category-specifieke velden:
`energyKwhRateCents`, `energyM3RateCents`, `insuranceCoverage`,
`insuranceDeductibleCents`, `mortgageInterestPct`, `mortgageTermYears`,
`bankAccountTier`, `streamingTier`.

MAAR:
1. Het `Bill` model in `prisma/schema.prisma` slaat ze NIET op.
2. `billDataFromOcr()` in `app/api/bills/upload/route.ts` persisteert ze NIET.
3. `app/onderhandel/analyse/page.tsx` geeft hardcoded/null-waarden door
   aan `compareEnergy/compareMortgage/compareInsurance`.

Gevolg: de analyse toont generieke marktcijfers, niet gepersonaliseerd.
Deze sprint wired de hele keten: **OCR → DB → analyse → vergelijking**.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/CATEGORY_HARDENING_SPRINT_V17.md en voer alle deeltaken uit in volgorde. Per deeltaak: implementeer, run de relevante tests (npm test + npx tsc --noEmit), bij fail fix de code tot groen, commit + push. Migraties: maak ze met een datum-prefix en draai `npx prisma migrate deploy` tegen productie + `npx prisma generate`. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 25 min: TODO-commit en door. Eindig met V17_REPORT.md.
```

---

## DEEL 1 — Bill schema: persisteer category-velden

a. Voeg aan `model Bill` in `prisma/schema.prisma` nullable kolommen toe:
   ```
   energyKwhRateCents       Int?
   energyM3RateCents        Int?
   energyContractType       String?   // vast/variabel/dynamisch/unknown
   insuranceCoverage        String?   // WA/WA+/CASCO/UNKNOWN
   insuranceDeductibleCents Int?
   mortgageInterestPct      Float?
   mortgageTermYears        Int?
   bankAccountTier          String?
   streamingTier            String?
   ```

b. Maak migratie `prisma/migrations/<datum>_bill_category_fields/migration.sql`
   met de `ALTER TABLE "Bill" ADD COLUMN ...` statements. Draai
   `npx prisma migrate deploy` + `npx prisma generate`.

c. Wire `billDataFromOcr()` in `app/api/bills/upload/route.ts` zodat
   deze velden uit het `OcrResult` worden meegeschreven. Let op:
   `energyContractType` komt nog niet uit OCR — voeg `contractType`
   detectie toe aan de OCR-prompt + `parseOcrJson` (vast/variabel/
   dynamisch), of zet `null` als niet gevonden.

d. Test: `tests/bill-category-persist.test.ts` — gegeven een mock
   OcrResult met alle velden gevuld, verifieer dat `billDataFromOcr`
   ze 1-op-1 doorgeeft.

e. Commit: `feat(schema): persist category-specific OCR fields on Bill`.

---

## DEEL 2 — Analyse-pagina: échte waarden i.p.v. hardcoded

Dit is de kern. In `app/onderhandel/analyse/page.tsx`:

a. ENERGIE-blok: vervang
   `compareEnergy({ kwhPriceCents: null, ... contractType: "variabel" })`
   door de echte bill-velden:
   ```ts
   compareEnergy({
     kwhPriceCents: bill.energyKwhRateCents,
     m3PriceCents: bill.energyM3RateCents,
     vastrechtCents: null,
     contractType: (bill.energyContractType as EnergyContractType) ?? "unknown",
   })
   ```

b. HYPOTHEEK-blok: vervang de hardcoded `restschuldCents: 25_000_000,
   rentePercentage: 4.8` door `bill.mortgageInterestPct` +
   `bill.mortgageTermYears`. Restschuld is zelden op een maandfactuur
   zichtbaar → gebruik een nette schatting uit `maandlast × looptijd`
   OF toon een "vul je restschuld in" micro-form. Voor deze sprint:
   schat conservatief uit maandlast en LABEL het duidelijk als schatting.

c. VERZEKERING-blok: vervang `type: "UNKNOWN"` door
   `bill.insuranceCoverage` (gemapt naar `InsuranceCoverageType`) +
   `deductibleCents: bill.insuranceDeductibleCents`.

d. Belangrijk: als een veld `null` is, moet de UI een nette
   "niet gedetecteerd — schatting" badge tonen, NOOIT crashen of
   €0,00 als besparing presenteren alsof het echt is.

e. Test: `tests/e2e/journey-analyse-categories.spec.ts` (Playwright,
   source-level contract): assert dat de page de bill-velden doorgeeft
   (geen hardcoded literals meer in de compare-calls).

f. Commit: `fix(analyse): feed real OCR category fields into comparisons`.

---

## DEEL 3 — WATER categorie-module (monopolie-bewust)

Water is een regionaal monopolie — je kunt NIET overstappen. Besparing
komt uit verbruik-reductie, lek-detectie en kwijtschelding.

a. Maak `lib/categories/water.ts`:
   ```ts
   export type WaterBill = {
     m3PriceCents?: number | null;
     vastrechtCents?: number | null;
     jaarverbruikM3?: number | null;
     householdSize?: number | null;
   };
   export function compareWater(bill: WaterBill): {
     marketM3Cents: number;          // ~€1,40/m³ incl. belasting NL 2026
     yourM3Cents: number | null;
     avgHouseholdM3: number;          // ~45 m³/persoon/jaar
     estimatedAnnualCents: number;
     reductionTips: string[];         // douche-timer, perlator, lekcheck
     kwijtscheldingEligible: boolean; // hint op laag inkomen
     notes: string[];
   }
   ```
   Realistische NL-medianen: drinkwater ~€1,00-1,40/m³ (regio-afhankelijk),
   verbruik ~45 m³/persoon/jaar.

b. Wire een WATER-blok in `app/onderhandel/analyse/page.tsx` (analoog aan
   ENERGIE), met monopolie-disclaimer: "overstappen kan niet, dit bespaar
   je via verbruik".

c. Test: `tests/category-water.test.ts` — verbruik-schatting, tips altijd
   aanwezig, geen valse "stap over en bespaar".

d. Commit: `feat(water): monopoly-aware water comparison + analyse block`.

---

## DEEL 4 — ENERGIE deep test (gas + stroom)

a. `tests/category-energie-deep.test.ts` — breid bestaande test uit:
   - contractType vast → kwhVastCents/m3VastCents medianen
   - variabel → variabel medianen
   - dynamisch → behandel als variabel + note over spotprijzen
   - alleen-stroom factuur (m3 null) → savings alleen op kWh
   - alleen-gas factuur (kwh null) → savings alleen op m³
   - beide null → schatting op gemiddeld verbruik + duidelijke note
   - negatieve overpay (goedkoper dan markt) → savings=0, geen negatief

b. Verifieer de jaarbesparing-rekensom met handberekende waarden
   (bv kWh €0,05 boven markt × 2800 kWh = €140/jaar).

c. Bij bug in `lib/categories/energie.ts`: fix + hertest.

d. Commit: `test(energie): deep coverage vast/variabel/dynamisch + edge cases`.

---

## DEEL 5 — HYPOTHEEK deep test

a. `tests/category-hypotheek-deep.test.ts`:
   - rente ruim boven markt (4,8% vs 3,8%) → oversluitWorthIt=true,
     payback <60 mnd
   - rente dicht bij markt (3,9% vs 3,8%) → worthIt=false
   - rentevasteJaren rondt naar dichtstbijzijnde markt-bucket (12→10, 17→15)
   - payback exact op grens 60 mnd
   - yearlySavingsGross negatief (je rente onder markt) → payback=-1,
     worthIt=false, nette note
   - restschuld=0 edge → geen division-by-zero / NaN

b. Verifieer rekensom: €250k restschuld × (4,8%−3,8%) = €2.500/jaar bruto.

c. Bij bug in `lib/categories/hypotheek.ts`: fix + hertest.

d. Commit: `test(hypotheek): deep coverage oversluit-scenarios + edge cases`.

---

## DEEL 6 — VERZEKERING deep test

a. `tests/category-verzekering-deep.test.ts`:
   - WA / WA+ / CASCO / UNKNOWN percentile-bucketing
   - premie in top-25% → percentile=high + "sterke overstap-case" note
   - premie onder markt → percentile=low, geen alternatieven die duurder zijn
   - alternatieven gesorteerd goedkoop→duur, max 3
   - eigen risico <€150 → note over verhogen
   - potentialAnnualSavings = (premie − goedkoopste alt) × 12

b. Bij bug in `lib/categories/verzekering.ts`: fix + hertest.

c. Commit: `test(verzekering): deep coverage coverage-types + percentiles`.

---

## DEEL 7 — Provider-registry compleet maken

a. Voeg ontbrekende NL WATER-bedrijven toe (nu 6, moeten alle ~10 zijn):
   WML (Limburg), Oasen, Waterbedrijf Groningen, WMD Drenthe. Check
   tegen de officiële lijst van NL drinkwaterbedrijven.

b. Breid ondervertegenwoordigde NL-categorieën uit:
   - GYM (nu 4): voeg toe TrainMore, Fit20, Health City, Sportschool-ketens
   - OV (nu 4): NS, GVB, RET, HTM, Arriva, Connexxion, Qbuzz, OV-chipkaart
   - ENERGIE NL: check of grote namen ontbreken (Vandebron, Frank Energie,
     Tibber, Greenchoice, Vattenfall, Essent, Eneco, Budget Energie...)
   - VERZEKERING NL: zorg dat top-15 zorgverzekeraars + autoverzekeraars er zijn

c. Integriteit-test `tests/provider-registry.test.ts`:
   - Geen dubbele `id`'s
   - Elke provider heeft geldige category + country + locale
   - `findProvider()` matcht élke `names[]` alias (case-insensitive)
   - Geen provider met lege `names[]`
   - Elke `Category` enum-waarde heeft ≥1 provider OF staat op een
     bewuste leeg-lijst (documenteer waarom, bv GEMEENTE = monopolie)

d. Commit: `feat(providers): complete NL water + broaden gym/ov/energie/verzekering`.

---

## DEEL 8 — End-to-end fixtures per categorie

a. Maak realistische test-fixtures in `tests/fixtures/bills/`:
   - `water-vitens.txt` (of PNG) — Vitens-factuur, €1,30/m³, 110 m³/jaar
   - `energie-eneco-stroomgas.txt` — kWh €0,34, m³ €1,55, variabel
   - `hypotheek-rabobank.txt` — 4,6% rente, 20 jaar vast, €1.250 maandlast
   - `verzekering-univé-casco.txt` — CASCO €58/mnd, €300 eigen risico

b. `tests/e2e/category-roundtrip.spec.ts`: voor elke fixture, verifieer
   dat `parseOcrJson` op een representatieve LLM-respons de juiste
   category-velden teruggeeft (mock de Groq-respons, test de parser +
   mapping, niet de echte LLM).

c. Verifieer dat `primaryFromLegacy` + `inferSubType` de juiste primary
   category + sub-type afleiden per fixture.

d. Commit: `test(e2e): per-category OCR→parse→map roundtrip fixtures`.

---

## DEEL 9 — Aggregate + rapport

a. Run alles:
   ```bash
   npm test -- --run
   npx tsc --noEmit
   npx playwright test tests/e2e/category-*.spec.ts tests/e2e/journey-analyse-categories.spec.ts
   ```
   Alles groen.

b. Genereer `V17_REPORT.md`:
   - Per categorie: werkt de keten OCR→DB→analyse→vergelijking nu echt?
   - Provider-tellingen voor/na per categorie
   - Gevonden bugs + commit-hash van fix
   - Welke velden nog NIET uit OCR komen (bv hypotheek-restschuld) +
     voorstel hoe die later op te halen

c. Update `OVERVIEW.md`: categorie-dekking status.

d. Commit: `docs(v17): category hardening verified, X bugs fixed`.

---

## Done-criteria

- [ ] Bill slaat alle category-velden op (migratie live op prod)
- [ ] Analyse-pagina gebruikt ECHTE bill-waarden, geen hardcoded literals
- [ ] WATER heeft een eigen monopolie-bewuste module + analyse-blok
- [ ] Energie/hypotheek/verzekering deep-getest incl. edge cases
- [ ] Provider-registry: NL water compleet, gym/ov/energie/verzekering breder
- [ ] Provider-integriteit test groen (geen dupes, alle aliassen matchen)
- [ ] `npm test` + `npx tsc --noEmit` + category e2e groen
- [ ] V17_REPORT.md met per-categorie status + restpunten

## Eindrapportage

```
CATEGORY_HARDENING_V17 — Final report

DEEL 1  ✓ <hash> — Bill persisteert category-velden + migratie live
DEEL 2  ✓ <hash> — analyse gebruikt echte OCR-waarden
DEEL 3  ✓ <hash> — WATER monopolie-module + blok
DEEL 4  ✓ <hash> — energie deep test
DEEL 5  ✓ <hash> — hypotheek deep test
DEEL 6  ✓ <hash> — verzekering deep test
DEEL 7  ✓ <hash> — providers compleet + integriteit
DEEL 8  ✓ <hash> — per-categorie roundtrip fixtures
DEEL 9  ✓ <hash> — rapport + X bugs gefixt
```

**Na deze sprint: élke vaste-lasten categorie berekent besparing op de
échte factuur, niet op een hardcoded marktgemiddelde.**

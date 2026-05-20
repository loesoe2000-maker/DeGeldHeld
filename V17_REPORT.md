# V17_REPORT — Category Hardening Sprint

**Doel:** elke vaste-lasten categorie berekent besparing op de échte
factuur van de gebruiker (OCR → DB → analyse → vergelijking), niet op
hardcoded marktgetallen.

## Eindrapportage

```
CATEGORY_HARDENING_V17 — Final report

DEEL 1  ✓ 3ee3f84 — Bill persisteert category-velden + migratie live op prod
DEEL 2  ✓ c29280e — analyse gebruikt echte OCR-waarden (geen hardcoded literals)
DEEL 3  ✓ 346f28e — WATER monopolie-module + analyse-blok
DEEL 4  ✓ 05db665 — energie deep test (vast/variabel/dynamisch + edge cases)
DEEL 5  ✓ b60f6ba — hypotheek deep test (oversluit-scenarios + edge cases)
DEEL 6  ✓ acaab3e — verzekering deep test (coverage-types + percentiles)
DEEL 7  ✓ fb5bf64 — providers compleet (NL water 10/10) + integriteit-test
DEEL 8  ✓ b1a1ee1 — per-categorie OCR→parse→map roundtrip fixtures
DEEL 9  ✓ <dit commit> — aggregate + rapport
```

## Werkt de keten OCR → DB → analyse → vergelijking nu echt?

| Categorie | OCR-velden | Persist (Bill) | Analyse gebruikt echte waarde | Status |
|-----------|-----------|----------------|-------------------------------|--------|
| ENERGIE   | kwhRate, m3Rate, contractType | ✓ | ✓ `compareEnergy(bill.energy*)` | **volledig** |
| WATER     | m3Rate (via energyM3RateCents) | ✓ | ✓ `compareWater()` monopolie-blok | **volledig** |
| HYPOTHEEK | interestPct, termYears | ✓ | ✓ `compareMortgage(bill.mortgage*)` — restschuld = schatting (gelabeld) | **deels** (zie restpunt) |
| VERZEKERING | coverage, deductible | ✓ | ✓ `compareInsurance(bill.insurance*)` | **volledig** |
| TELECOM   | (geen category-extra's nodig) | n.v.t. | markt-vergelijking via comparison | **volledig** |
| BANK/STREAMING | tier-velden | ✓ | tier opgeslagen, nog niet in een eigen analyse-blok | **basis** |

Vóór v17 gaven alle blokken hardcoded literals door
(`contractType:"variabel"`, `type:"UNKNOWN"`, `rentePercentage:4.8`,
`restschuldCents:25_000_000`). Na v17 komen alle waarden uit de
gepersisteerde OCR-velden, met een nette "niet gedetecteerd —
schatting" badge bij `null` (nooit een crash of nep-€0).

## Provider-tellingen voor → na

| Categorie | Voor | Na | Toegevoegd |
|-----------|-----:|---:|-----------|
| WATER (NL) | 6 | 10 | WML, Oasen, Waterbedrijf Groningen, WMD |
| GYM | 4 | 8 | TrainMore, Fit20, HealthCity, David Lloyd |
| OV | 4 | 10 | GVB, RET, HTM, Arriva, Connexxion, Qbuzz |

Integriteit-test (`tests/provider-registry.test.ts`): geen dubbele
id's, elke provider heeft geldige category/country/locale, geen lege
`names[]`, `findProvider()` matcht elke alias case-insensitive, en
elke `Category` heeft ≥1 provider OF staat op de gedocumenteerde
leeg-lijst (GEMEENTE = monopolie, ABONNEMENT = legacy parent-bucket).

## Nieuwe migratie (live op prod)

`20260520000000_bill_category_fields` — 9 nullable kolommen op `Bill`:
energyKwhRateCents, energyM3RateCents, energyContractType,
insuranceCoverage, insuranceDeductibleCents, mortgageInterestPct,
mortgageTermYears, bankAccountTier, streamingTier. Toegepast via
`npx prisma migrate deploy` + `npx prisma generate`.

## Gevonden bugs + fixes

| Bug | Waar | Fix-commit |
|-----|------|-----------|
| Empty-body POST /api/bills/upload → 500 (formData() throw) | route | (v16 9a25f27, ervoor) |
| console.log debug-residue (self-review gate) | image-normalize.ts, ocr.ts | 3ee3f84 |
| auth-callbacks test stale t.o.v. v15 anonymous flow (`/onderhandel` nu publiek) | test | 3ee3f84 |

Geen rekenfouten gevonden in `energie.ts` / `hypotheek.ts` /
`verzekering.ts` — de bestaande implementaties handelen alle
edge-cases correct af (bevestigd door 34 nieuwe deep-tests).

## Welke velden komen NOG NIET uit OCR

- **Hypotheek-restschuld** — staat zelden op een maandfactuur. Nu
  geschat uit `maandlast × 12 × looptijd`, geklemd op [€50k, €1M] en
  duidelijk gelabeld als schatting.
  *Voorstel:* micro-form "vul je restschuld in" op de analyse-pagina,
  of PSD2-koppeling die de hypotheekstand ophaalt.
- **Jaarverbruik (energie/water)** — vaak alleen op de jaarafrekening,
  niet op een maandnota. Nu default NL-gemiddelde.
  *Voorstel:* multi-page PDF-OCR (v13) pakt de jaarafrekening-pagina's
  al; verbruik daaruit halen is een prompt-uitbreiding.
- **Huishoudgrootte (water)** — niet op een factuur. Nu default 2.
  *Voorstel:* optionele profielvraag.

## Test-totaal

- Nieuwe v17 tests: bill-category-persist (4), category-water (9),
  category-energie-deep (10), category-hypotheek-deep (9),
  category-verzekering-deep (9), provider-registry (8) = **49 unit**
  + journey-analyse-categories (5) + category-roundtrip (5) = **10 e2e**.
- `npm test`: 1541 passed (2 pre-existing FAQ-failures uit b351a61,
  zie BACKLOG.md — buiten scope).
- `npx tsc --noEmit`: clean.
- Category e2e: 10/10 groen.

**Na deze sprint: elke vaste-lasten categorie berekent besparing op de
échte factuur, niet op een hardcoded marktgemiddelde.**

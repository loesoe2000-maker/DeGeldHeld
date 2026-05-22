# V28_REPORT — Moneyfinder uitbreiding ("vind al je geld", model B)

**Datum:** 2026-05-23
**Branch:** main
**Sprint:** `MONEYFINDER_EXPANSION_SPRINT_V28.md`
**Commits in deze sprint:** `97ecca0` (DEEL 2) · `765a5f5` (DEEL 3) · `a3b91bb` (DEEL 4) · `e04a58a` (DEEL 5) · `<dit report>` (DEEL 6)
**DEEL 1 + EU261-calc + flags + Hero/dashboard entry-points:** al gedaan in `e23d4ff` op `main` (peildatum 2026-05-23 voor de geld-check) — **bewust niet opnieuw gebouwd**.
**Co-author trailer:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` op elke commit.

> **Status flags (na deze sprint):**
> - `FEATURE_GELD_CHECK_ENABLED` = **off** (wacht op privacy-/disclaimer-review eigenaar)
> - `FEATURE_CLAIMS` = **off** (wacht op flight-data-API-key + juridische check)
> - Plus = waitlist-mailto (wacht op KvK/KYC — zie CLAUDE.md)

---

## QA-gate (per commit gedraaid — allemaal EXIT 0)

| Gate | Resultaat |
|------|-----------|
| `npm test` (vitest) | **1917 passed** / 207 files |
| `npx tsc --noEmit` | **EXIT 0** |
| `npm run build` | **EXIT 0** |
| `npx playwright test` | **55 passed / 2 failed / 1 skipped** — zie noot |

> Geen `--no-verify`, geen `--force`. Pre-commit hook draaide op elke commit.

### Noot — 2 pre-existing e2e-failures (NIET V28)
`tests/e2e/multi-round.spec.ts:80` en `:111` falen al sinds V24. V25/V26 hebben
de root-causes (auth-secret + DB-URL mismatch tussen runner en webServer)
grotendeels uitgelijnd via `playwright.config.ts` (loadt nu `.env.local` +
pint deterministische secrets in beide processen). Huidige falen:

- `:80` — `Test timeout` op `getByRole('button', { name: /Analyseer/i })`-click
  (UI rendert, click hangt; trage Groq / inbound-mock-flow). Niet door V28.
- `:111` — nog steeds `/login` redirect bij token-link toegang tot `/uitkomst`.

`git diff e23d4ff..HEAD` bevestigt dat V28 **niets** raakt in `uitkomst`/
`outcome_token`/`multi-round`. Beide failures staan in CLAUDE.md genoteerd voor
follow-up (paid Groq + outcome-token route-review).

---

## Wat DEEL 1 al deed (e23d4ff — gerefereerd, niet opnieuw gebouwd)

- `lib/toeslagen.ts` — pure engine; alle 2026-grenzen/bedragen geannoteerd met
  `// bron:` + `TOESLAGEN_PEILDATUM = "2026-01-01"`, geverifieerd
  `TOESLAGEN_VERIFIED_AT = "2026-05-23"`. Zorgtoeslag/kindgebonden:
  bovengrens-indicatie. Huurtoeslag: alleen "mogelijk recht" (complexe
  formule; **max-huurgrens is GEEN drempel** in 2026 — alleen aftopping).
- `lib/eu261.ts` — pure compensatie-calc, EXACTE bedragen/drempels.
- `app/geld-check/` — wizard, client-side privacy (inkomen/vermogen verlaten
  de browser niet), `.ph-no-capture` voor analytics.
- Feature-flags `GELD_CHECK_ENABLED` + `CLAIMS` (default off) en Hero/dashboard
  entry-points. 42 tests pass.

## DEEL 2 — "Vind al je geld" framing + funnel (`97ecca0`)

**Hero (`components/Hero.tsx`)** — sub-copy schakelt naar de "vind al je geld"
framing zodra `GELD_CHECK_ENABLED` of `CLAIMS` aan staat (anders ongewijzigd
t.o.v. pre-v28). Nieuwe branches-sectie onder de primaire CTAs:
- 💸 Toeslagen + gemeente-regelingen → `/geld-check` (alleen bij flag).
- ✈️ Vluchtclaim (EU261) → `/vluchtclaim` (alleen bij `CLAIMS`).

**Geld-check (`app/geld-check/GeldCheckClient.tsx`)** — cross-CTA "Check ook
mijn rekeningen →" naar `/onderhandel` onder de resultaten; nieuw event
`geld_check_to_onderhandel { found: boolean }` (geen PII).

Bestaande Hero-tests (Upload/Inloggen/demo) ongewijzigd groen.

## DEEL 3 — DeGeldHeld Plus als cashflow-motor (`765a5f5`)

**`lib/plus.ts`** (pure):
- 3 waarde-pijlers (`PLUS_PILLARS`): maandelijkse her-scan vaste lasten,
  periodieke her-check toeslagen/regelingen, alerts (contract-einde + prijs).
- `PLUS_PRICE = { lowEur: 2.99, highEur: 4.99 }` — indicatief, geen live
  Stripe-prijs (live billing wacht op KYC; CLAUDE.md).
- Her-check-cadence: `shouldRecheckBenefits(lastISO, now)` →
  - nooit gecheckt → due
  - ≥ 90 dagen geleden (kwartaal) → due
  - vorig kalenderjaar → due (Belastingdienst publiceert nieuwe bedragen
    per 1 januari)
- `nextRecheckDue()` pakt de vroegste van cadence-grens en jaargrens.

**`app/plus/page.tsx`** — 3 pijlers + prijsband + wachtlijst-mailto. Expliciet:
de toeslagen/gemeente-check blijft **gratis** via `/geld-check`.

## DEEL 4 — Vluchtclaim EU261 (achter `FEATURE_CLAIMS`) (`a3b91bb`)

**`lib/flightdata.ts`** (pure):
- `FlightLookupProvider`-interface + `createFlightLookup(env)` factory die op
  basis van `AVIATION_EDGE_KEY` of `AVIATIONSTACK_KEY` een provider kiest, of
  de **noop-fallback** retourneert ("no-data: no-provider" — geen verzonnen
  vluchtdata).
- Adapter-stubs voor Aviation Edge + AviationStack: de HTTP-fetch + IATA-
  afstandstabel komen in de **eigenaar-stap** (API-key + jurist-check). Tot
  die tijd → `no-data: needs-implementation` → eerlijke "binnenkort"-staat.
- Validatie: `isValidFlightNumber` accepteert IATA + alfanumerieke airline-
  codes (KL1234, U2 8505, 4U123, EZY8505); `isValidFlightDateISO` weigert
  toekomst + > 2-jaar-oude vluchten (EU261-verjaring NL).

**`app/api/vluchtclaim/check/route.ts`** — flag-gated POST → input-validatie
→ `getActiveFlightLookup()` → `eu261Compensation` → response (`found` /
`no-data` / `error`). 404 als flag uit; **geen opslag** van vluchtnummer/datum.

**`app/vluchtclaim/page.tsx`** + `VluchtclaimClient.tsx` — flag-gated UI;
"binnenkort"-staat bij no-data met waitlist-mailto; resultaat met
"Start claim — no cure, no pay" mailto-CTA (tot jurist-check rond is).
Geen PII naar analytics (alleen `kind` + `eligible`).

## DEEL 5 — Spookabonnement-detectie (`e04a58a`)

**`lib/waste-detection.ts`** (pure): conservatief — liever niets melden dan
false positives.
- **Provider-duplicate**: zelfde canonieke provider 2× met zelfde maandbedrag
  (sterkste signaal voor dubbel abonnement / dubbele afschrijving).
- **Category-duplicate**: ≥ 2 bills in subscription-class categorie
  (STREAMING / SOFTWARE / OPSLAG / GYM). Provider-dups bezetten hun bills
  eerst → geen dubbele meldingen.
- Per-categorie generic-veilige NL self-cancel-begeleiding (geen provider-
  specifieke links die zouden verouderen).
- Footer-disclaimer: "Wij doen GEEN betaalde opzegdienst — opzeggen kun je
  gratis zelf." (Consumentenbond bekritiseert betaalde opzegdiensten.)

**`app/spookabonnementen/page.tsx`** — owner-scoped server-page; toont totaal
+ findings + per-categorie self-cancel-uitleg, of "niets opvallends"-staat.

---

## Bronnen + peildatums (eindtabel)

### Toeslagen 2026 (bron `docs/BENEFITS_DATA_2026.md` — peildatum **2026-01-01**, geverifieerd **2026-05-23**)

| Toeslag | Bron |
|---|---|
| Zorgtoeslag — max. inkomen | [Belastingdienst](https://www.belastingdienst.nl/wps/wcm/connect/nl/zorgtoeslag/content/maximaal-inkomen-voor-zorgtoeslag) |
| Zorgtoeslag — max. vermogen | [Belastingdienst](https://www.belastingdienst.nl/wps/wcm/connect/nl/zorgtoeslag/content/maximaal-vermogen-zorgtoeslag) |
| Zorgtoeslag — bedragen 2026 | [Zorgwijzer](https://www.zorgwijzer.nl/zorgverzekering-2026/zorgtoeslag-omlaag-in-2026-bereken-hier-hoeveel-je-per-maand-krijgt) |
| Huurtoeslag — parameters 2026 (incl. afschaffing max-huurgrens als drempel) | [Rijksoverheid 2025-11-25](https://www.rijksoverheid.nl/actueel/nieuws/2025/11/25/indexering-inkomensgrenzen-woningcorporaties-maximale-huurprijsgrenzen-en-huurtoeslagparameters-2026) · [Woonbond](https://www.woonbond.nl/thema/huren-en-geld/normen-en-grenzen-huurtoeslag/) · [Belastingdienst vermogen](https://www.belastingdienst.nl/wps/wcm/connect/nl/huurtoeslag/content/maximaal-vermogen-huurtoeslag) |
| Kindgebonden budget — bedragen 2026 | [Consumentenbond](https://www.consumentenbond.nl/toeslagen/kindgebonden-budget) |
| Kindgebonden budget — max. inkomen | [Belastingdienst](https://www.belastingdienst.nl/wps/wcm/connect/nl/kindgebonden-budget/content/maximaal-inkomen-kindgebonden-budget) |
| Gemeente-regelingen | [Nibud "Bereken je Recht"](https://berekenuwrecht.nibud.nl/) — verwijzing, geen eigen bedragen |

### EU261 — vluchtcompensatie (stabiel, 2026 ongewijzigd)

| Bron | Inhoud |
|---|---|
| [Europa.eu — rechten vliegtuigpassagiers](https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_nl.htm) | EU-verordening 261/2004: € 250 / € 400 / € 600 + drempels (3 u / 4 u) |
| [EUclaim — verordening 261/2004](https://www.euclaim.nl/vlucht-problemen/rechten-van-vliegtuigpassagiers/verordening-261-2004) | Bevestiging bedragen + verjaring NL 2 jaar |

### Marktbevindingen (`docs/EXPANSION_PROPOSALS.md`)

- [CPB — onbenut recht toeslagen](https://www.cpb.nl/onbenut-recht-het-niet-gebruik-van-huur-en-zorgtoeslag-en-het-kindgebonden-budget)
- [NOS — €1 mld toeslagen blijft liggen](https://nos.nl/l/2558354)
- [MAX Meldpunt — €1 mld toeslagen](https://www.maxmeldpunt.nl/geld/1-miljard-euro-aan-toeslagen-blijft-liggen-zo-berekent-u-zelf-waar-u-recht-op-heeft-en-hoeveel/)
- [LCR — bijzondere bijstand onbenut](https://www.landelijkeclientenraad.nl/actueel/bijzondere-bijstand-vaak-onbenut)
- [Vastelastenbond](https://www.vastelastenbond.nl/blog/overstappen-loont-en-toch-doen-we-het-niet/) — huishoudens besparen €350-€800/jr door over te stappen (4% doet het)

---

## Done-criteria

- [x] **Geld-check wizard** — DEEL 1 gedaan in `e23d4ff` (sourced, indicatie +
      verwijzing, géén DigiD/opslag); huurtoeslag = "mogelijk recht" +
      proefberekening (geen max-huurgrens als drempel).
- [x] **Vluchtclaim** — EU261-check via provider-adapter + no-cure-no-pay
      claim-intent; alle UI achter `FEATURE_CLAIMS` (default off).
- [x] **Privacy** — geld-check rekent client-side; vluchtcheck slaat
      vluchtnummer/datum niet op; alle gevoelige inhoud heeft
      `.ph-no-capture`; events bevatten alleen booleans/counts.
- [x] **Herframing** — Hero-branches achter flags; cross-CTA naar
      `/onderhandel`; **DeGeldHeld Plus** als cashflow-motor met 3 pijlers
      + pure her-check-cadence; **waste-detectie** met zelf-opzeg-begeleiding.
- [x] **Géén providergeld**, géén hyp/verz (AFM-gate intact); géén
      gehallucineerde cijfers.
- [x] `npm test` (1917) + `npx tsc --noEmit` + `npm run build` **EXIT 0**;
      e2e: 55 pass / 2 pre-existing (niet V28).
- [x] **V28_REPORT.md** met bronnen + peildatums + eigenaar-stappen.

---

## EIGENAAR-stappen (om dit live aan te zetten)

### 1. Geld-check live (gratis, hoogste prioriteit)
- Privacy-tekst + indicatie-disclaimer reviewen (`GELD_CHECK_DISCLAIMER` in
  `lib/toeslagen.ts` + footer van `/geld-check`).
- Voorwaarden updaten met "geld-check is informatieve indicatie, geen
  advies".
- `FEATURE_GELD_CHECK_ENABLED=true` in Vercel → redeploy.
- Check daarna: Hero toont de toeslagen-branch; cross-CTA werkt.

### 2. Vluchtclaim live (no-cure-no-pay)
- **Flight-data**: kies een API (Aviation Edge of AviationStack), maak een
  account, configureer `AVIATION_EDGE_KEY` (of `AVIATIONSTACK_KEY`) in
  Vercel. Implementeer dan in `lib/flightdata.ts` de daadwerkelijke
  HTTP-fetch + IATA-afstandstabel (de stubs staan klaar).
- **Jurist**: laat de volmacht + claim-brief + voorwaarden EU261 toetsen
  (vader Bas — jurist; al ervaring met de relay-volmacht).
- `FEATURE_CLAIMS=true` in Vercel → redeploy.

### 3. Plus live (abonnement)
- KvK/KYC afronden (zie CLAUDE.md) → Stripe-flip naar live.
- Stripe Subscription-product aanmaken (€2,99-€4,99/mnd).
- Echte sign-up flow op `/plus` wirelen i.p.v. mailto-waitlist.

### 4. Periodieke her-check
- `lib/plus.ts:shouldRecheckBenefits` is klaar. Cron-job (in
  `app/api/cron/`) toevoegen die per gebruiker `lastCheckedISO` evalueert
  → mail-nudge "Tijd voor je her-check". Stripe-flow gate (Plus-only).

### 5. Spookabonnementen
- Page is owner-scoped en werkt op alle reeds geüploade bills. Vergt
  geen eigenaar-actie; verschijnt automatisch bij elke ingelogde
  gebruiker met ≥ 2 abonnementen in een subscription-class categorie.

### 6. Pre-existing e2e-debt (NIET V28)
- `tests/e2e/multi-round.spec.ts:80` — Groq-rate-limit / inbound-mock-pad
  fixen (paid Groq + mock-deterministisme).
- `tests/e2e/multi-round.spec.ts:111` — onderzoek waarom de outcome-token
  page nog steeds redirect naar `/login` ondanks de v26 secret-uitlijning.

---

## Eindrapportage

```
MONEYFINDER_EXPANSION_V28 — Final report
DEEL 1 ✓ e23d4ff — geld-check (toeslagen + gemeente, sourced) [pre-existing]
DEEL 2 ✓ 97ecca0 — "vind al je geld" framing + funnel
DEEL 3 ✓ 765a5f5 — DeGeldHeld Plus als cashflow-motor (3 pijlers + cadence)
DEEL 4 ✓ a3b91bb — vluchtclaim EU261-check + claim (achter FEATURE_CLAIMS)
DEEL 5 ✓ e04a58a — spookabonnement-detectie + self-cancel-begeleiding
DEEL 6 ✓ <this commit> — V28_REPORT.md (bronnen + peildatums + eigenaar-stappen)
```

**Per klant checken = één vragenlijst (toeslagen/gemeente, client-side, gratis)
+ een vluchtnummer-lookup (EU261, no-cure-no-pay) + waste-detectie op
geüploade bills. Alles indicatie + sourced. Model B: omzet komt van de klant
of van teruggehaald geld — nooit van providers.**

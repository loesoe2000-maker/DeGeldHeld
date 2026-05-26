# DeGeldHeld v35 — Claim-Hub uitbreiding: Huurcommissie + Energie-claim

> **🟢 Status (2026-05-26) — DEEL 0 is AL GEDAAN:** `docs/V35_DATA_2026.md` ligt
> klaar als bron-van-waarheid (Huurcommissie + Geschillencommissie Energie +
> ACM, peildatum 2026, geverifieerd 2026-05-26). **Sla DEEL 0 over.**
> Hergebruik die data EXACT in `lib/huurcommissie.ts` en `lib/energie-claim.ts`
> — geen procedures gokken, geen leges verzinnen.
>
> **Strategische context**: owner koos V35 = Claim-Hub uitbreiding (V35-doc
> `docs/V35_STRATEGY_PROPOSALS.md`, Voorstel C). Marketing blijft **globaal**
> — geen Gen-Z-zoom, geen ZZP-zoom. Positionering blijft "vind al je geld".
>
> **Cruciale onafhankelijkheid**: V35 raakt **niet** de relay-mail-onderhandeling
> (KPN-test verdict pending). Beide nieuwe claims gaan naar **officiële
> instanties** (Huurcommissie / Geschillencommissie Energie), niet via
> provider-mail. Als KPN-verdict 🔴 is, blijven V35-claims werken.

**Lees eerst:**
- `docs/V35_DATA_2026.md` — **bron-van-waarheid** (deadlines/leges/procedures/rode vlaggen)
- `docs/V35_STRATEGY_PROPOSALS.md` — strategische context + waarom C
- `docs/V31_FUNCTIE_ANALYSE.md` — bestaande stack-status
- `V34_REPORT.md` — laatste tech-baseline (86,3% composite)
- `lib/box3.ts` + `lib/box3-claim.ts` + `app/box3-check/` — **template-patroon** voor V35 (kopieer-pattern, géén refactor)
- `lib/eu261.ts` + `lib/ns.ts` — bestaande pure claim-engines (consistent type-pattern)
- `prisma/schema.prisma` — bestaand `Box3Claim`-model is template

## Doel — bundeling als onderscheid

V28-V30 bracht **checks** (toeslagen, box3, NS, zorgkosten, vluchtclaim).
V35 breidt naar **claims tegen officiële instanties**. Niemand bundelt deze
in NL — EUclaim doet alleen vluchten, Bezwaarmaker alleen WOZ, Huurteam
Nederland geeft alleen advies (geen NCNP). **Onderscheid komt uit bundeling +
gefaseerd NCNP-model + transparantie**, niet uit nieuwe technologie.

**Model B intact** (nooit providergeld). Alles **achter feature-flags** (default off).

## ⚠️ GUARDRAILS (sprint-specifiek)

1. **`npm run build` (EXIT 0) + `npx tsc --noEmit` + `npm test` groen vóór élke commit.**
2. **ALLE deadlines/leges/procedures EXACT uit `docs/V35_DATA_2026.md`**. Géén
   procedures gokken, géén verzonnen wettelijke termijnen.
3. **Indicatie ≠ advies.** Onze tool wijst rode vlaggen + brief-template; de
   Huurcommissie / Geschillencommissie bepaalt het exacte bedrag. Sterke
   disclaimers + verwijzing naar officiële kanalen op élke pagina.
4. **Privacy / AVG**: huurcontract-/factuur-data **client-side** verwerken
   waar mogelijk; opslag alleen bij claim-creatie (zelfde AVG-grondslag als
   `Box3Claim` — art. 6 lid 1b, uitvoering overeenkomst). Géén PII naar
   analytics — alleen booleans/counts.
5. **Revenue-model (KRITISCH)**:
   - **Huurcommissie-bezwaar**: GRATIS indicatie + DIY-brief altijd. **NCNP 20%**
     alléén aangeboden als verwachte restitutie ≥ **€ 50**. Onder die drempel
     → DIY-only (servicekosten-restituties zijn doorgaans kleiner dan Box 3, dus
     lagere drempel dan € 500).
   - **Energie-eindafrekening-claim**: identiek — gratis indicatie + DIY-brief
     altijd; NCNP 20% alléén bij verwachte restitutie ≥ **€ 50**.
   - Géén fee onder de drempel — ethisch + slechte CAC anders.
6. **Géén OCR voor V35**. Huurcommissie- en Geschillencommissie-uitspraken komen
   doorgaans per post / e-mail (niet als standaardformaat-PDF). Proof-back-flow
   = klant rapporteert uitkomst handmatig + uploadt uitspraak-PDF voor archief.
   Fee-charge handmatig getriggerd door owner via admin-panel (V36 mogelijk
   automation).
7. **Géén relay-mail-dependency**. Beide claims gaan via officiële instanties,
   niet via provider-mail. Bij KPN-test 🔴-verdict blijft V35 werken.
8. **Géén providergeld** (model B). **Géén hyp/verz / AFM-grenzen**
   (huurcommissie + energie-Geschillencommissie zijn buiten Wft/AFM-zone).
9. **Flags blijven default UIT**:
   - `HUURCOMMISSIE_CHECK_ENABLED` (default false)
   - `ENERGIE_CLAIM_CHECK_ENABLED` (default false)
10. Géén `--no-verify`/`--force`. Co-author trailer:
    `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## Architectuur-keuze (BELANGRIJK)

**Kopieer-pattern, géén refactor.** `Box3Claim`-model + Box3-engine + Box3-routes
zijn al productie. V35 introduceert TWEE NIEUWE modellen (`HuurServicekostenClaim` +
`EnergieEindafrekeningClaim`) parallel aan `Box3Claim`. Een generieke
`Claim`-abstractie komt in V36 of later — eerst de twee nieuwe types productie-
proof maken, dan unificeren. Vermijdt migratie-risico op werkende Box 3-flow.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/MONEYFINDER_EXPANSION_SPRINT_V35.md, docs/V35_DATA_2026.md, docs/V35_STRATEGY_PROPOSALS.md, docs/V31_FUNCTIE_ANALYSE.md, V34_REPORT.md, lib/box3.ts, lib/box3-claim.ts, app/box3-check/Box3CheckClient.tsx, prisma/schema.prisma (Box3Claim als template). DEEL 0 is AL GEDAAN — docs/V35_DATA_2026.md ligt klaar. SLA DEEL 0 OVER. Bouw V35 = TWEE nieuwe officiële-instantie-claim-flows volgens Box3-template (KOPIEER, géén refactor van Box3Claim): (1) Huurcommissie-bezwaar servicekosten, (2) Energie-eindafrekening-claim via Geschillencommissie Energie. Drempel NCNP-aanbod = €50 verwachte restitutie (lager dan Box 3's €500 want servicekosten/energie-restituties zijn doorgaans kleiner). Géén OCR voor V35 — proof-back is handmatig (owner-triggerd fee-charge via admin-panel; klant uploadt uitspraak-PDF voor archief). Géén relay-mail-dependency — beide claims gaan via officiële instanties direct. Per deel: npm test + npx tsc --noEmit + npm run build (EXIT 0) groen vóór de commit. Alle deadlines/leges EXACT uit docs/V35_DATA_2026.md — niets gokken. Privacy: client-side check waar mogelijk, opslag alleen bij claim-creatie (AVG art. 6 lid 1b). Flags default UIT (HUURCOMMISSIE_CHECK_ENABLED, ENERGIE_CLAIM_CHECK_ENABLED). Géén providergeld, géén AFM/Wft. Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>. Geen --no-verify/--force. Eindig met V35_REPORT.md incl. bronnen + peildatums + eigenaar-stappen.
```

---

## DEEL 0 — `docs/V35_DATA_2026.md` ✅ AL GEDAAN

**SKIP.** Gebruik die data EXACT in DEEL 1-2. Bij verschil aggregator vs.
Huurcommissie/Geschillencommissie: **officieel wint** — geen "ronde getallen"
uit blogs.

---

## DEEL 1 — Huurcommissie-bezwaar (servicekosten)

a. **Engine** `lib/huurcommissie.ts` (pure, client-side):
   - Types: `HuurServicekostenInput` (boekjaar, opgegeven voorschot-totaal,
     opgegeven werkelijke kosten-totaal, rode-vlaggen-checklist:
     {geenSpecificatie, geenFacturen, postenNietInContract, eigenaarslastenVerrekend,
     verhuurderGeenAfrekening, voorschotVeelGroterDanWerkelijk: boolean}[]),
     `HuurServicekostenResult` (verwachteRestitutieCents,
     rodeVlaggenAantal: number, status: "likely" | "maybe" | "unlikely",
     uitleg, deadlinesContext: {wettelijkeAfrekeningDeadline, bezwaarDeadline},
     bron).
   - `estimateHuurServicekostenRestitutie(input)` — pure. Berekent
     bovengrens-restitutie = max(0, voorschot - werkelijke kosten) +
     verdachte posten op basis van rode vlaggen. Indicatie alleen.
   - `shouldOfferHuurNcnp(result)` — pure: `verwachteRestitutieCents >= 5_000`
     (€ 50-drempel uit guardrail 5). HARD in code.
   - Constants uit `docs/V35_DATA_2026.md` met `// bron:`-comments:
     `HUURCOMMISSIE_LEGES_CENTS = 2_500` (€ 25)
     `HUURCOMMISSIE_VERHUURDER_REACTIE_DAGEN = 21`
     `HUURCOMMISSIE_BEHANDELING_MAANDEN = 5` (gemiddelde 4-6)
     `HUUR_NCNP_DREMPEL_CENTS = 5_000` (€ 50)
   - DIY-brief-generator `huurServicekostenBezwaarBrief(input, result)` →
     pre-gefilde tekst voor schriftelijk bezwaar bij verhuurder (3-weken
     reactietijd + verwijzing naar Huurcommissie als geen reactie).

b. **Prisma**: voeg `HuurServicekostenClaim`-model toe (PARALLEL aan `Box3Claim`,
   niet refactoren):
   ```
   model HuurServicekostenClaim {
     id                       String   @id @default(cuid())
     userId                   String
     boekjaar                 Int
     verhuurderNaam           String?
     verwachteRestitutieCents Int
     status                   String   // INTENT | BEZWAAR_GESTUURD | HUURCOMMISSIE_INGEDIEND | UITSPRAAK | CHARGED | FAILED
     werkelijkeRestitutieCents Int?
     uitspraakUploadedAt      DateTime?
     chargedAt                DateTime?
     stripePaymentIntentId    String?
     createdAt                DateTime @default(now())
     updatedAt                DateTime @updatedAt
     user                     User     @relation(fields: [userId], references: [id])
     @@index([userId, status])
   }
   ```
   Migrate (`npm run prisma:migrate -- --name v35_huur_servicekosten_claim`).

c. **UI** `/huurcommissie-check`:
   - Server `app/huurcommissie-check/page.tsx` (flag-gated op
     `HUURCOMMISSIE_CHECK_ENABLED`).
   - `HuurcommissieCheckClient.tsx`: wizard (boekjaar → voorschot-totaal →
     werkelijke kosten-totaal → rode-vlaggen-checklist met JA/NEE per item) →
     resultaat-kaart. Onder € 50-drempel: DIY-brief + checklist (gratis).
     Boven drempel: "wij regelen 'm (NCNP 20%)" + DIY blijft beschikbaar.
   - Privacy-callout zoals geld-check (client-side rekenen, alleen claim-record
     opslaan bij NCNP-keuze).
   - Toon expliciet de **deadlines** (wettelijk + bezwaar) en de Huurcommissie-
     leges (€ 25 te betalen door klant, terug bij winst).

d. **NCNP-pad**:
   - **Route** `POST /api/huurcommissie/claim` (auth-gated): bij NCNP-keuze →
     valideer drempel ≥ € 50 in code (422 onder) → maak `HuurServicekostenClaim`
     met state `INTENT` → stuur herinneringsmail "houd ons op de hoogte van
     Huurcommissie-uitspraak".
   - **Route** `POST /api/huurcommissie/uitspraak` (auth-gated): klant uploadt
     uitspraak-PDF + opgeeft `werkelijkeRestitutieCents` → status `UITSPRAAK`.
     **GEEN auto-charge in V35** — owner reviewt + charge'd via admin (V36 mogelijk
     automation). Sla uitspraak-PDF op (S3/Vercel Blob — hergebruik bestaande
     proof-upload-route pattern).
   - **UI** `/huurcommissie-check/proof/[claimId]`: upload-pagina voor de
     uitspraak (PDF) + werkelijke-restitutie-input.

e. **Feature-flag**: `HUURCOMMISSIE_CHECK_ENABLED` (default false) in
   `lib/feature-flags.ts`.

f. **Analytics**: extend `AnalyticsEvent`-union:
   - `huurcommissie_check_started`
   - `huurcommissie_results_viewed`
   - `huurcommissie_ncnp_chosen`
   - `huurcommissie_diy_chosen`
   - `huurcommissie_uitspraak_uploaded`

g. **Tests** `tests/huurcommissie.test.ts` + `tests/huurcommissie-claim.test.ts`:
   - Engine: rode-vlaggen-som correct; € 50-drempel triggert NCNP-aanbod;
     bron-comments aanwezig.
   - Edge cases: 0 rode vlaggen + voorschot ≤ werkelijke kosten → unlikely;
     verhuurder-geen-afrekening-vlag → automatisch alle voorschot als restitutie.
   - Claim-flow: INTENT → BEZWAAR_GESTUURD → UITSPRAAK happy path; werkelijke
     restitutie < € 50 in uitspraak → CHARGED met fee € 0 (eerlijk).
   - Auth: zonder sessie → 401.

h. **Commit**: `feat(huurcommissie): bezwaar servicekosten check + DIY + NCNP-claim`.

---

## DEEL 2 — Energie-eindafrekening-claim

a. **Engine** `lib/energie-claim.ts` (pure, client-side):
   - Types: `EnergieEindafrekeningInput` (provider, contracteindeDatum,
     eindafrekeningDatum, eindafrekeningBedragCents, opgegeven
     energiebelasting-vermindering-bedrag, opgegeven heffingskortingen-totaal,
     contract-tarief-per-kWh-cents, opgegeven werkelijk-tarief-per-kWh-cents,
     meterstandConsistent: boolean),
     `EnergieEindafrekeningResult` (verwachteRestitutieCents,
     rodeVlaggenAantal, status, uitleg, klachtTermijnen: {leverancierDeadline,
     geschillencommissieDeadline}, bron).
   - `estimateEnergieEindafrekeningRestitutie(input)` — pure:
     - **Rode vlag 1**: `eindafrekeningDatum - contracteindeDatum > 42 dagen` →
       6-weken-deadline overschreden (ACM-handhaving-grond)
     - **Rode vlag 2**: `energiebelasting-vermindering-bedrag === 0` bij
       volledig contract-jaar → direct restitutie-grond
     - **Rode vlag 3**: `werkelijk tarief > contract tarief` → restitutie =
       verschil × verbruik
     - **Rode vlag 4**: `meterstandConsistent === false` → indicatie-bezwaar
     - **Rode vlag 5**: heffingskortingen ontbreken
   - `shouldOfferEnergieNcnp(result)` — pure: `verwachteRestitutieCents >= 5_000`
     (HARD).
   - Constants uit `docs/V35_DATA_2026.md` met `// bron:`-comments:
     `ENERGIE_GESCHILLENCOMMISSIE_LEGES_CENTS = 2_750` (€ 27,50)
     `ENERGIE_KLACHTGELD_VERGOEDING_CENTS = 5_250` (€ 52,50)
     `ENERGIE_LEVERANCIER_REACTIE_DAGEN = 30`
     `ENERGIE_GESCHILLENCOMMISSIE_BEHANDELING_MAANDEN = 3`
     `ENERGIE_EINDAFREKENING_DEADLINE_DAGEN = 42` (6 weken)
     `ENERGIE_NCNP_DREMPEL_CENTS = 5_000`
   - DIY-brief-generator `energieKlachtBrief(input, result)` → pre-gefilde
     tekst voor klacht bij leverancier (30-dagen-deadline) + escalatie-
     template Geschillencommissie Energie.

   ⚠️ **Energiebelasting-vermindering 2026-bedrag**: NIET HARD CODEEREN — Claude
   Code moet eerst de exacte 2026-heffingskorting opzoeken via WebFetch naar
   Belastingdienst voor `ENERGIEBELASTING_VERMINDERING_2026_CENTS`. Bedrag wijzigt
   jaarlijks (was ca. € 631 in 2024-2025). Indien fetch faalt → fallback
   "controleer op je eindafrekening de regel 'Vermindering energiebelasting'" +
   geen exact-bedrag-check.

b. **Prisma**: voeg `EnergieEindafrekeningClaim`-model toe:
   ```
   model EnergieEindafrekeningClaim {
     id                       String   @id @default(cuid())
     userId                   String
     provider                 String
     verwachteRestitutieCents Int
     status                   String   // INTENT | KLACHT_GESTUURD | GESCHILLENCOMMISSIE_INGEDIEND | UITSPRAAK | CHARGED | FAILED
     werkelijkeRestitutieCents Int?
     uitspraakUploadedAt      DateTime?
     chargedAt                DateTime?
     stripePaymentIntentId    String?
     createdAt                DateTime @default(now())
     updatedAt                DateTime @updatedAt
     user                     User     @relation(fields: [userId], references: [id])
     @@index([userId, status])
   }
   ```
   Migrate.

c. **UI** `/energie-claim-check`:
   - Server `app/energie-claim-check/page.tsx` (flag-gated op
     `ENERGIE_CLAIM_CHECK_ENABLED`).
   - `EnergieClaimCheckClient.tsx`: wizard (provider + contracteinde + eindafrek-
     ening-datum + bedragen + heffingskorting-check + meterstand-check) →
     resultaat-kaart met rode vlaggen + brief-template.
   - Privacy-callout. Géén factuur-upload in V35 (alleen handmatige invoer);
     proof-upload alleen bij uitspraak.

d. **NCNP-pad** (identiek aan huurcommissie):
   - `POST /api/energie-claim/claim` met € 50-drempel-gate
   - `POST /api/energie-claim/uitspraak` met PDF-upload + handmatige werkelijke-
     restitutie-invoer
   - `/energie-claim-check/proof/[claimId]` upload-pagina

e. **Feature-flag**: `ENERGIE_CLAIM_CHECK_ENABLED` (default false).

f. **Analytics**: extend `AnalyticsEvent`-union:
   - `energie_claim_check_started`
   - `energie_claim_results_viewed`
   - `energie_claim_ncnp_chosen`
   - `energie_claim_diy_chosen`
   - `energie_claim_uitspraak_uploaded`

g. **Tests**:
   - Engine: élke rode vlag triggert restitutie; combinatie meerdere vlaggen;
     6-weken-deadline-overschrijding triggert direct grond.
   - Claim-flow: zelfde happy path als huurcommissie.

h. **Commit**: `feat(energie-claim): eindafrekening check + DIY + NCNP-claim`.

---

## DEEL 3 — Hub-update + nav + PostCheckCta

a. **Update `app/vind-al-je-geld/page.tsx`**: voeg 2 nieuwe tegels toe (alleen
   tonen bij actieve flag):
   - Huurcommissie-bezwaar → `/huurcommissie-check`
   - Energie-eindafrekening-claim → `/energie-claim-check`
   - Behoud bestaande 6 tegels.

b. **Update `app/page.tsx` / Hero** (optioneel): geen Hero-tekst wijziging —
   de bestaande hub-link dekt navigatie. Wel: cross-link in PostCheckCta na
   geld-check / box3-check naar de twee nieuwe claims.

c. **Update `lib/moneyfinder-hub.ts`** (V29-helper): voeg 2 nieuwe tegel-
   definities toe met dezelfde structuur als bestaande 6.

d. **Update `lib/plus.ts`**: voeg "huurcommissie + energie-claim auto-monitor"
   als positionering toe — Plus checkt jaarlijks of klant een verdachte
   afrekening heeft gekregen (eerste implementatie = positionering-tekst, niet
   echte cron-job in V35).

e. **PostCheckCta**: hergebruik bestaande component (V30) op de 2 nieuwe
   check-pagina's met de juiste `fromCheck`-prop.

f. **Update `scripts/audit-everything.ts`**: voeg `/huurcommissie-check` +
   `/energie-claim-check` + de proof-paden + API-routes toe aan STATIC_PAGES +
   API_PROBES.

g. **Tests**:
   - `tests/vind-al-je-geld.test.tsx`: 2 nieuwe tegels bij actieve flags;
     géén tegel zichtbaar bij flag uit (regressie-guard).
   - `tests/post-check-cta.test.tsx`: voeg `huurcommissie` + `energie-claim`
     toe als `fromCheck`-waardes.

h. **Commit**: `feat(hub): huurcommissie + energie-claim in vind-al-je-geld`.

---

## DEEL 4 — V35_REPORT.md + finale gate

a. `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen.
b. `npm run validate:v31` — bestaande 27/27 cases blijven groen (geen regressie).
c. `npm run assurance` — composite-score na V35 (verwacht: licht omhoog van
   86,3% door extra coverage).
d. `V35_REPORT.md`: per nieuwe claim:
   - Wat gebouwd is + commit-hashes
   - Wat NIET gebouwd is (geen OCR, geen auto-charge, geen automation)
   - Eigenaar-stappen:
     - Privacy-pagina update met `HuurServicekostenClaim` + `EnergieEindafrekeningClaim`
       AVG-grondslag (art. 6 lid 1b — uitvoering overeenkomst)
     - Voorwaarden update: NCNP 20% voor huurcommissie + energie-claim
     - `FEATURE_HUURCOMMISSIE_CHECK_ENABLED=true` na review
     - `FEATURE_ENERGIE_CLAIM_CHECK_ENABLED=true` na review
     - Admin-panel-route voor handmatige fee-charge (owner-werk, niet in V35)
   - Bronnen + peildatum
e. **Commit**: `docs(v35): claim-hub uitbreiding huurcommissie + energie verified`.

---

## Done-criteria

- [ ] `docs/V35_DATA_2026.md` — al klaar (DEEL 0 skip)
- [ ] **Huurcommissie-check + DIY + NCNP-claim**: gefaseerd model (gratis < € 50,
      NCNP 20% ≥ € 50 HARD in code), Prisma `HuurServicekostenClaim` model
- [ ] **Energie-claim-check + DIY + NCNP-claim**: identiek model, Prisma
      `EnergieEindafrekeningClaim` model
- [ ] **Hub-update**: 2 nieuwe tegels achter respectieve flags
- [ ] **PostCheckCta + scripts/audit-everything**: 2 nieuwe `fromCheck`-waardes
      + 2 nieuwe pad-entries
- [ ] Privacy: check-data client-side waar mogelijk; claim-records opgeslagen
      met AVG-grondslag art. 6 lid 1b
- [ ] Flags allemaal default UIT
- [ ] Géén OCR (handmatig proof-upload), géén auto-charge (admin-werk)
- [ ] Géén relay-mail-dependency, géén providergeld, géén AFM/Wft
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] `npm run validate:v31` 27/27 (geen regressie)
- [ ] `V35_REPORT.md` met bronnen + peildatums + eigenaar-stappen

## Eindrapportage

```
MONEYFINDER_EXPANSION_V35 — Final report (claim-hub uitbreiding)
DEEL 0 ✓ <al gepushed> — V35_DATA_2026.md (sourced)
DEEL 1 ✓ <hash> — Huurcommissie-bezwaar (servicekosten) + DIY + NCNP-claim
DEEL 2 ✓ <hash> — Energie-eindafrekening-claim + DIY + NCNP-claim
DEEL 3 ✓ <hash> — Hub-tegels + PostCheckCta + audit-everything
DEEL 4 ✓ <hash> — V35_REPORT.md
```

**Na V35 heeft DeGeldHeld 5 claim-flows** (Box 3 / EU261 / NS / Huurcommissie /
Energie) — de breedste consumer-claim-hub in NL. Geen concurrent doet meer
dan 1-2 van deze. Concurrent-kopieer-tijd voor 5 stuks bundeling: 18-24
maanden (juridische research per type). Tot dan: onderscheid via bundeling +
gefaseerd NCNP + transparantie. **Géén tech-doorbraak nodig — bundeling
zelf is de moat.**

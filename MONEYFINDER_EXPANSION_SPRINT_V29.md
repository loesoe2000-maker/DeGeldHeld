# DeGeldHeld v29 — High-accuracy revenue stack (Box 3 + NS + Zorgkosten + Plus-loop + Hub)

> **🟢 Status (2026-05-24) — DEEL 0 is AL GEDAAN:** `docs/V29_DATA_2026.md` ligt
> klaar als bron-van-waarheid (Belastingdienst-/Rijksoverheid-/NS-/Hoge Raad-
> gesourcet, peildatum 2026, geverifieerd 2026-05-24). **Sla DEEL 0 over.**
> Hergebruik die data EXACT in `lib/box3.ts`, `lib/ns.ts`, `lib/zorgkosten.ts` —
> niets gokken of "bijwerken". Bij verschil tussen aggregator en Belastingdienst:
> **Belastingdienst wint** (bv. 2026 banktegoeden-forfait 1,28%, NIET 1,44%).

**Lees eerst:**
- `docs/V29_DATA_2026.md` — **bron-van-waarheid** (alle forfaits/drempels/bedragen)
- `docs/EXPANSION_RESEARCH_V29.md` — gesourcete marktscan + revenue-verdicts per feature
- `docs/BENEFITS_DATA_2026.md` — V28-pattern (stijl-referentie voor toon/structuur)
- `V28_REPORT.md` — wat al staat (`lib/toeslagen.ts`, `lib/eu261.ts`, `lib/plus.ts`,
  `app/geld-check/`, `app/vluchtclaim/`, `app/spookabonnementen/`, `app/plus/`)
- `lib/outcome-proof.ts` + `lib/payments.ts` — bestaand patroon voor
  proof-detection + off-session NCNP-fee-charge (HERGEBRUIKEN, niet dupliceren)

## Doel — accuracy-first, niet feature-first

V28 voegde features toe (toeslagen, vluchtclaim, Plus, spookabonnementen). V29
voegt 3 NIEUWE checks toe, maar de **kern is dat élke revenue-stream
deterministisch wordt**: proof-back triggert auto-NCNP-fee, Plus heeft een
**werkende** her-scan-loop i.p.v. een vage belofte, telecom wordt eerlijk
herframed naar een Plus-pijler (géén valse NCNP-trigger meer). Geen nieuwe
"misschien-revenue", alleen revenue waar code het mechanisme afdwingt.

**Model B intact** (nooit providergeld). Alles **achter feature-flags** (default off).

## ⚠️ GUARDRAILS (sprint-specifiek)

1. **`npm run build` (EXIT 0) + `npx tsc --noEmit` + `npm test` groen vóór élke commit.**
2. **Alle bedragen/forfaits EXACT uit `docs/V29_DATA_2026.md`** (al gesourcet).
   Aggregators zijn géén bron — Belastingdienst/Rijksoverheid wint altijd.
3. **Indicatie ≠ advies.** Box 3 = indicatie of bezwaar loont, exacte berekening
   doet Belastingdienst-OWR. Zorgkosten = drempel + JA/NEE-checklist. NS =
   indicatie compensatie, claim via Mijn NS. Sterke disclaimers + verwijzing
   naar officiële kanalen op élke pagina.
4. **Privacy / AVG (kritisch)**: inkomens-/vermogens-/zorgkosten-data
   **client-side** verwerken (zoals `lib/toeslagen.ts` doet); niet opslaan;
   `ph-no-capture` op alle gevoelige inputs; analytics alleen booleans/counts
   (géén PII). **Uitzondering**: bij NCNP-claim-flow (DEEL 1) slaan we **wél**
   de Claim-record + uitkomst-bewijs op — vereist voor de fee-charge. AVG
   rechtvaardigt: noodzakelijk voor de overeenkomst.
5. **Revenue-model (KRITISCH — niet versimpelen)**:
   - **Box 3**: GRATIS indicatie altijd. **NCNP 25%** alléén aangeboden als
     verwachte teruggave **≥ € 500** (HARD in code: `shouldOfferBox3Ncnp`).
     Onder die drempel → DIY-brief + checklist, geen fee.
   - **NS Geld-Terug**: GRATIS check + brief. **Plus = auto-claim** (echte
     infra, niet alleen tekst — zie DEEL 4).
   - **Zorgkosten**: GRATIS, geen fee. Top-of-funnel naar Plus.
   - **Telecom**: ⚠️ **GEEN NCNP-trigger meer.** Belscript is een
     **Plus-pijler** (zelf bellen met onze scripts) — zie DEEL 4. Update
     `lib/category-strategy.ts` zodat telecom-fee niet meer triggert via
     `shouldChargeVerifiedFee` (was V27-grijs gebied, wordt nu code-honest).
6. **Proof-back-trigger (accuracy-mechanisme — NIEUW in V29)**: voor élke
   NCNP-claim (Box 3, vluchtclaim) bouwen we een **bewijs-upload-flow** die
   het werkelijk teruggehaalde bedrag detecteert en de fee deterministisch
   triggert via `chargeFeeOffSession`. Hergebruik `lib/outcome-proof.ts`-DNA.
   Géén handmatige fee-collect — dat is hoe revenue lekt.
7. **Géén providergeld** (model B). **Géén hyp/verz** (AFM-gate).
8. **Flags blijven default UIT** tot eigenaar de privacy/disclaimer per feature
   heeft gereviewed:
   - `BOX3_CHECK_ENABLED` (default false)
   - `NS_CHECK_ENABLED` (default false)
   - `ZORGKOSTEN_CHECK_ENABLED` (default false)
   - `MONEYFINDER_HUB_ENABLED` (default false) — gates `/vind-al-je-geld`
   - `PLUS_RESCAN_CRON_ENABLED` (default false) — gates de Vercel cron
9. Géén `--no-verify`/`--force`. Co-author trailer:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/MONEYFINDER_EXPANSION_SPRINT_V29.md, docs/V29_DATA_2026.md, docs/EXPANSION_RESEARCH_V29.md én docs/BENEFITS_DATA_2026.md (als stijl-referentie). DEEL 0 is AL GEDAAN — docs/V29_DATA_2026.md ligt klaar. SLA DEEL 0 OVER en start direct bij DEEL 1. Hergebruik de forfaits/drempels/bedragen EXACT uit docs/V29_DATA_2026.md — niets gokken, niets uit aggregators. Bij verschil aggregator vs Belastingdienst: Belastingdienst wint (bv. 2026 banktegoeden 1,28% NIET 1,44%). Per deel: npm test + npx tsc --noEmit + npm run build (EXIT 0) groen vóór de commit. Revenue-model EXACT zoals guardrail 5: Box 3 gefaseerd (gratis < €500, NCNP 25% ≥€500 — HARD in code), NS gratis + werkende Plus auto-claim (DEEL 4), zorgkosten gratis, telecom = Plus-pijler (GEEN NCNP-trigger meer — update lib/category-strategy.ts). Guardrail 6 (NIEUW): bouw proof-back-upload-flow voor élke NCNP-claim → auto-fee-trigger via chargeFeeOffSession (hergebruik lib/outcome-proof.ts + lib/payments.ts). Guardrail 4: alle check-data client-side + ph-no-capture; uitzondering: Claim-record mag opgeslagen worden (vereist voor fee). Privacy strikt. Alle features achter feature-flags (default false). Geen providergeld, geen hyp/verz. Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>. Geen --no-verify/--force. Eindig met V29_REPORT.md incl. bronnen + peildatums + eigenaar-stappen.
```

---

## DEEL 0 — `docs/V29_DATA_2026.md` ✅ AL GEDAAN

**SKIP.** Hergebruik de data uit dat bestand exact. Bij verschil aggregator vs
Belastingdienst: **Belastingdienst wint** (bv. 2026 banktegoeden 1,28%, NIET
1,44%).

---

## DEEL 1 — Box 3-rechtsherstel check + brief-helper + **proof-back NCNP-loop**

a. **Engine** `lib/box3.ts` (pure, client-side, zoals `lib/toeslagen.ts`):
   - Types: `Box3Input` (jaar, spaargeld, beleggingen, schulden, werkelijk
     rendement), `Box3Result` (forfaitaireBelastingCents,
     werkelijkBelastingIndicatieCents, verwachteTeruggaveCents,
     status: "likely" | "maybe" | "unlikely", uitleg, bron).
   - `estimateBox3Restitution(input)` — pure. Forfaits + heffingsvrij vermogen
     EXACT uit `docs/V29_DATA_2026.md`, met `// bron:` per constante.
   - `shouldOfferBox3Ncnp(result)` — pure: `result.verwachteTeruggaveCents >=
     50_000` (€ 500-drempel uit guardrail 5). HARDE gate — wordt door
     payments-laag gecontroleerd.
b. **UI** `/box3-check`:
   - Server `app/box3-check/page.tsx` (flag `BOX3_CHECK_ENABLED`).
   - `Box3CheckClient.tsx`: wizard → resultaat-kaart. Onder drempel:
     "doe het zelf — hier is je brief + checklist (gratis)". Boven drempel:
     "wij regelen 'm (no-cure-no-pay 25%)" + DIY-optie blijft beschikbaar.
   - Privacy-callout (client-side, niets opgeslagen) — uitzondering NCNP-pad.
   - Analytics: `box3_check_started | _results_viewed | _ncnp_chosen | _diy_chosen`.
c. **Brief-helper** `lib/box3-brief.ts`: genereert pre-gefilde OWR-tekst +
   bewijsstukken-lijst + verwijzing naar MijnBelastingdienst. Pure functie.
d. **NCNP-pad (de revenue-loop)**:
   - **Prisma**: voeg `Box3Claim`-model toe: `{ id, userId, jaar,
     verwachteTeruggaveCents, owrFingerprint, status: "INTENT" | "AWAITING_PROOF"
     | "PROOF_RECEIVED" | "CHARGED" | "FAILED", werkelijkTeruggaveCents?,
     proofUploadedAt?, chargedAt?, stripePaymentIntentId? }`. Migrate.
   - **Route** `POST /api/box3/claim`: bij NCNP-keuze → maakt `Box3Claim`
     met state `AWAITING_PROOF` + verstuurt herinneringsmail "upload je
     Belastingdienst-beschikking zodra die binnen is".
   - **Route** `POST /api/box3/proof-back`: klant uploadt
     Belastingdienst-beschikking (PDF) → OCR via bestaande `pdfjs`-route →
     detecteer toegekend bedrag → update `Box3Claim` → **als bedrag ≥ € 500**
     trigger `chargeFeeOffSession` (25% van werkelijk bedrag, cap € 500 als
     bestaande pattern). Bij detectie-faal → `FAILED` + handmatige review.
   - **UI** `/box3-check/proof/[claimId]`: upload-pagina voor de beschikking.
e. **Feature-flag**: `BOX3_CHECK_ENABLED` in `lib/feature-flags.ts`.
f. **Analytics**: extend `AnalyticsEvent`-union (events uit a/b + `box3_proof_uploaded`,
   `box3_fee_charged`).
g. **Tests** `tests/box3.test.ts` + `tests/box3-claim.test.ts`:
   - Engine: forfait-vergelijking correct, élke constante `// bron:`.
   - Gate: < € 500 → `shouldOfferBox3Ncnp` false; ≥ € 500 → true.
   - Claim-flow: INTENT → AWAITING_PROOF → PROOF_RECEIVED → CHARGED happy path.
   - Proof-back: bedrag < € 500 in beschikking → status CHARGED met €0 fee (eerlijk:
     ook al was indicatie hoger, werkelijke uitkomst telt).
   - Proof-back: OCR-faal → FAILED, géén fee.
h. Commit: `feat(box3): rechtsherstel check + brief + proof-back NCNP-loop`.

---

## DEEL 2 — NS Geld-Terug bij Vertraging

a. **Engine** `lib/ns.ts` (pure, EU261-pattern):
   - Types: `NsInput` (ticketCents, delayMinutes, isAbonnement, isInternational),
     `NsResult` (compensationCents, percentage, regime: "NS_NL" | "EU_PRR" |
     "ABONNEMENT_VERWIJS", eligible, reden).
   - `nsCompensation(input)` — pure. Constants EXACT uit `V29_DATA_2026.md`.
   - Vrij/Flex → regime `ABONNEMENT_VERWIJS` (géén verzonnen bedragen).
b. **UI** `/ns-check`:
   - Server `app/ns-check/page.tsx` (flag `NS_CHECK_ENABLED`).
   - `NsCheckClient.tsx`: vragenlijst → indicatie + brief-template (klant
     plakt in Mijn NS) + reminder-knop (mailto met deadline = reis + 30 dgn).
   - Analytics: `ns_check_started | _results_viewed | _reminder_set`.
c. **Tests** `tests/ns.test.ts`:
   - Regimes correct (NS-NL vs EU-PRR vs abonnement)
   - Drempels op grens (30 min, 60 min, 120 min)
   - Minimum € 2,30 → eligible=false
   - Abonnement → regime ABONNEMENT_VERWIJS, geen amountCents
   - Constants matchen `V29_DATA_2026.md`
d. **Feature-flag**: `NS_CHECK_ENABLED`.
e. Commit: `feat(ns): Geld-Terug bij Vertraging check + brief + reminder`.

---

## DEEL 3 — Zorgkostenaftrek check

a. **Engine** `lib/zorgkosten.ts` (pure, geld-check-DNA):
   - Types: `ZorgkostenInput`, `ZorgkostenResult` (drempelCents,
     aftrekbaarCents, indicatieJa, checklistVeelvergeten, uitleg, bron).
   - `estimateZorgkostenAftrek(input)` — pure. Drempel = max(€ 166,
     1,65% × drempelinkomen) voor 2026. Partner = 2× minimum.
   - AOW-verhoging 113% logica (alleen als AOW-leeftijd + inkomen ≤ € 41.123).
   - **Geen exact belastingvoordeel in EUR** (hangt van marginaal tarief af):
     `aftrekbaarCents` + tekst "× jouw marginale tarief".
b. **UI** `/zorgkosten-check`:
   - Server `app/zorgkosten-check/page.tsx` (flag `ZORGKOSTEN_CHECK_ENABLED`).
   - `ZorgkostenCheckClient.tsx`: vragenlijst + **uitgebreide checklist
     veelvergeten posten** met JA/NEE per item (uit `V29_DATA_2026.md`
     wel/niet-lijst).
c. **Tests** `tests/zorgkosten.test.ts`:
   - Drempel-formule (1,65% met min € 166)
   - Aftrek boven/onder drempel
   - AOW-verhoging-pad
   - Checklist-volledigheid (assert alle posten uit data-file vermeld)
d. **Feature-flag**: `ZORGKOSTEN_CHECK_ENABLED`.
e. Commit: `feat(zorgkosten): aangifte-helper indicatie + checklist (sourced)`.

---

## DEEL 4 — Plus her-scan cron (echte loop) + telecom-naar-Plus reframe

**Dit is het accuracy-mechanisme dat Plus van "vage belofte" naar "concrete
events" tilt — én herstelt de fee-integriteit voor telecom.**

a. **Plus her-scan engine** `lib/plus-rescan.ts`:
   - `runRescanForUser(userId)` — pure-genoeg functie: leest user-Plus-prefs
     (laatst opgegeven check-inputs) → roept de pure check-engines aan
     (`estimateBenefits`, `estimateBox3Restitution`,
     `estimateZorgkostenAftrek`, spookabonnement-scan) → vergelijkt met
     vorige run → **delta**: nieuwe of veranderde vondsten.
   - `formatRescanFindings(delta)` → e-mail-/notification-tekst (Nederlands,
     concreet: "Deze maand vonden we 2 nieuwe items voor je: €X mogelijk + €Y
     mogelijk").
b. **Prisma**: voeg `PlusRescan`-model toe: `{ id, userId, runAt,
   findingsJson, notifiedAt? }`. Migrate.
c. **Cron-route** `app/api/cron/plus-rescan/route.ts`:
   - Vereist `Authorization: Bearer ${CRON_SECRET}` (zoals andere cron-routes).
   - Loopt door alle Plus-users (`status: ACTIVE`).
   - Per user: `runRescanForUser` → push e-mail via Resend bij niet-lege delta.
   - Gated door `PLUS_RESCAN_CRON_ENABLED` flag.
d. **vercel.json**: voeg cron-entry toe, maandelijks (1e van de maand 09:00 NL):
   ```json
   { "crons": [{ "path": "/api/cron/plus-rescan", "schedule": "0 7 1 * *" }] }
   ```
   (07:00 UTC = 09:00 NL zomertijd). Géén effect bij flag uit.
e. **Plus-page UI** (`app/plus/page.tsx`): voeg expliciet de **5 her-scan-pijlers**
   toe: toeslagen + box 3 + zorgkosten + NS auto-claim + spookabonnementen. Concreet,
   geen marketing-speak.
f. **Telecom-reframe** (fee-integriteit):
   - Update `lib/category-strategy.ts`: zet TELECOM op `fee: false` (was
     `true` in V27, maar V27 belscript-flow betekent klant doet zelf →
     NCNP onethisch). Update bijbehorende tests.
   - Telecom wordt **Plus-pijler #6**: "elk jaar genereren we een nieuw
     belscript voor je retentie-call". Update `app/plus/page.tsx`.
   - Update `tests/category-strategy.test.ts`: TELECOM → `fee: false`.
   - **Migratie-veiligheid**: check `lib/payments.ts` `shouldChargeVerifiedFee`
     — bestaande lopende telecom-onderhandelingen mogen niet ineens een fee
     krijgen die ze in V27 wél kregen. Geen retro-actief. (Realistisch geen
     issue want geen bevestigde TELECOM-fee tot nu toe.)
g. **Tests** `tests/plus-rescan.test.ts`:
   - `runRescanForUser` met nieuwe vondsten → niet-lege delta
   - Idem zonder veranderingen → lege delta, geen notificatie
   - Cron-route: zonder secret → 401; met secret + flag uit → 503; met flag aan
     + ACTIVE users → roept rescan voor elk
h. **Feature-flag**: `PLUS_RESCAN_CRON_ENABLED`.
i. Commit: `feat(plus): real rescan cron + telecom-as-Plus-pillar (fee integrity)`.

---

## DEEL 5 — "Vind al je geld"-hub + standaard PostCheckCta-component

a. **PostCheckCta-component** `components/PostCheckCta.tsx`:
   - Props: `{ vondstCents: number | null, vondstLabel: string, naarOnderhandel?:
     boolean, naarPlus?: boolean }`.
   - Rendert na een check-resultaat: **expliciete Plus-CTA** ("wil je dat we dit
     élke maand opnieuw checken? Plus = €4,99/mnd") + optioneel
     onderhandel-CTA ("we vonden €X — laat ons ook je vaste lasten verlagen").
   - `track("plus_cta_clicked", { fromCheck: <string> })` op klik.
b. **Integratie**:
   - Voeg `<PostCheckCta>` toe onderaan de results-section van: `GeldCheckClient`,
   `Box3CheckClient`, `NsCheckClient`, `ZorgkostenCheckClient`, `VluchtclaimClient`,
   `app/spookabonnementen/page.tsx`. Hetzelfde component, consistente boodschap.
c. **Hub-page** `app/vind-al-je-geld/page.tsx` (server, flag `MONEYFINDER_HUB_ENABLED`):
   - Hero: "Vind al je geld — alles op één plek".
   - Tegels (alleen tonen als bijbehorende flag aan staat): toeslagen +
     gemeente → `/geld-check` · Box 3 → `/box3-check` · zorgkosten →
     `/zorgkosten-check` · vluchtclaim → `/vluchtclaim` (achter `CLAIMS`) ·
     NS → `/ns-check` · spookabonnementen → `/spookabonnementen`.
   - Plus-pitch onderaan met de **6 her-scan-pijlers**.
d. **Update Hero + dashboard tile**: secundaire link naar `/vind-al-je-geld`
   wanneer `MONEYFINDER_HUB_ENABLED=true`. Bestaande links blijven.
e. **Tests**:
   - `tests/post-check-cta.test.tsx`: rendert correcte tekst per `fromCheck`,
     track-call op klik.
   - `tests/vind-al-je-geld.test.tsx`: tegels alleen tonen bij actieve flag;
     regression-guard wanneer ouder-flag uit.
f. **Feature-flag**: `MONEYFINDER_HUB_ENABLED`.
g. Commit: `feat(hub): vind-al-je-geld + PostCheckCta everywhere (conversion accuracy)`.

---

## DEEL 6 — Rapport + finale gate

a. `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen.
b. `V29_REPORT.md`: per feature de **revenue-conclusie** (uit guardrail 5 + 6),
   gebruikte bronnen + peildatum, accuracy-boost-mechanismen (proof-back,
   her-scan cron, telecom-reframe, PostCheckCta), wat WEL en NIET gebouwd is,
   en de eigenaar-stappen:
   - `FEATURE_BOX3_CHECK_ENABLED=true` na privacy/disclaimer-review
   - `FEATURE_NS_CHECK_ENABLED=true` na review NS-voorwaarden-tekst
   - `FEATURE_ZORGKOSTEN_CHECK_ENABLED=true` na review aftrek-disclaimer
   - `FEATURE_MONEYFINDER_HUB_ENABLED=true` als laatste
   - `FEATURE_PLUS_RESCAN_CRON_ENABLED=true` ná KYC + eerste Plus-users
   - `CRON_SECRET` in Vercel env zetten
   - Stripe-side: nieuwe Plus-positionering vergt geen prijswijziging
c. Commit: `docs(v29): high-accuracy money-finder stack verified`.

---

## Done-criteria (accuracy-versie)

- [ ] `docs/V29_DATA_2026.md` — al klaar (DEEL 0 skip)
- [ ] **Box 3-check + proof-back NCNP-loop**: gefaseerd model (gratis < € 500,
      NCNP 25% ≥ € 500 HARD in code), auto-fee-charge via proof-upload
- [ ] **NS-check**: gratis + brief + reminder
- [ ] **Zorgkosten-check**: indicatie + uitgebreide checklist, geen exact bedrag
- [ ] **Plus her-scan cron**: werkende maandelijkse rescan over alle 5 checks +
      Resend-notificatie · flag-gated · cron-secret-gated
- [ ] **Telecom-reframe**: `category-strategy` TELECOM → `fee: false`; wordt
      Plus-pijler #6 (belscripten)
- [ ] **PostCheckCta-component**: hergebruikt in álle 6 check-flows
- [ ] **Vind-al-je-geld-hub**: tegels alleen bij actieve flags
- [ ] Privacy: check-data client-side + `ph-no-capture`; uitzondering Claim-record
      (vereist voor fee) — gemotiveerd in V29_REPORT.md
- [ ] Flags allemaal default UIT
- [ ] Géén providergeld, géén hyp/verz, géén gehallucineerde cijfers
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] `V29_REPORT.md` met bronnen + peildatums + accuracy-boost-uitleg + eigenaar-stappen

## Eindrapportage

```
MONEYFINDER_EXPANSION_V29 — Final report (high-accuracy stack)
DEEL 0 ✓ 46aaec4 — V29_DATA_2026.md (al gedaan, sourced)
DEEL 1 ✓ <hash> — Box 3-rechtsherstel + proof-back NCNP-loop (deterministic fee)
DEEL 2 ✓ <hash> — NS Geld-Terug check + brief + reminder
DEEL 3 ✓ <hash> — Zorgkostenaftrek (indicatie + checklist)
DEEL 4 ✓ <hash> — Plus her-scan cron (echte loop) + telecom-naar-Plus reframe
DEEL 5 ✓ <hash> — Vind-al-je-geld hub + PostCheckCta (conversion accuracy)
DEEL 6 ✓ <hash> — V29_REPORT.md
```

**Na deze sprint is élke revenue-stream code-deterministisch:** Box 3 + vluchtclaim
NCNP triggeren via proof-back (geen handmatige collect), Plus levert maandelijks
concrete vondsten via cron (geen vage belofte), telecom is herframed als
Plus-pijler (geen valse NCNP-trigger), en élke gratis check stuurt expliciet
naar Plus + onderhandeling (meetbare conversie). Géén providergeld, géén
hyp/verz, alles sourced, alles flag-gated.

# V30_REPORT — Accuracy-boost op V29 (proof-back + Plus-cron + telecom-honest + PostCheckCta)

**Datum:** 2026-05-24
**Branch:** main
**Sprint:** `MONEYFINDER_EXPANSION_SPRINT_V30.md`
**Commits in deze sprint:** `1eedf11` (DEEL 1) · `18504eb` (DEEL 2) · `76eba86` (DEEL 3) · `<dit report>` (DEEL 4)
**Co-author trailer:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` op elke commit.

> **V30 voegt GEEN nieuwe features toe.** V30 maakt élke revenue-stream uit
> V29 **code-deterministisch**. Vier mechanismen op bestaande features. Alle
> nieuwe flags default UIT.

---

## QA-gate (per commit gedraaid — allemaal EXIT 0)

| Gate | Resultaat |
|------|-----------|
| `npm test` (vitest) | **2042 passed** / 215 files |
| `npx tsc --noEmit` | **EXIT 0** |
| `npm run build` | **EXIT 0** |
| Pre-existing e2e | 2 pre-existing `multi-round.spec` failures (V24+, niet V30) |

Geen `--no-verify`, geen `--force`. Élke commit door de pre-commit hook.

---

## Wat verandert in revenue-accuracy per mechanisme

### 1) Box 3 proof-back (`1eedf11`) — van handmatige fee-collect naar deterministische auto-charge

| Voor V30 | Na V30 |
|---|---|
| Klant zegt achteraf "ik kreeg X terug" → eigenaar must chargen via Stripe-dashboard. Revenue lekt: handmatig, traag, vergeten. | Klant uploadt Belastingdienst-beschikking → OCR (`pdfjs`) → regex op trefwoord-context (toegekend/teruggave/vermindering box 3) → automatische `chargeFeeOffSession` via Stripe. Klaar binnen minuten. |

Hard-gates:
- **€500-drempel** (`validateClaimIntent`): `verwachteTeruggaveCents < 50_000` → 422 met `reason="below-ncnp-threshold"`. Klant krijgt DIY-pad in de UI. Geen stille acceptatie.
- **Werkelijk < €500 → fee €0** (eerlijke uitkomst, ook al was indicatie ≥ €500): `computeBox3Fee()` retourneert 0 onder de drempel.
- **OCR-fail → FAILED** + admin-review-mail (geen stille uitkering): `parseBeschikkingAmount` is strikt op trefwoord-context — random bedragen op de pagina worden niet geaccepteerd.
- **Charge-fail → FAILED** met reason ("card_declined", "no card on file", etc.) — geen dunning hier; eigenaar pakt op.
- **Géén dubbele charge**: 409 als de claim al `CHARGED` of `FAILED` is.

DB-model: `Box3Claim` (INTENT → AWAITING_PROOF → PROOF_RECEIVED → CHARGED → FAILED) met `werkelijkTeruggaveCents`, `proofStorageUrl`, `chargedAt`, `feeCents`, `stripePaymentIntentId`, `failureReason`. Migratie `20260526000000_v30_box3_claim_plus_rescan` voor beide v30-modellen.

Routes:
- `POST /api/box3/claim` — auth-gated, flag-gated, drempel-gated → AWAITING_PROOF + herinneringsmail met `/box3-check/proof/[claimId]`-link.
- `POST /api/box3/proof-back` — multipart-upload (max 10 MB) → `processProofUpload({pdfText, charge})` (pure pipeline) → status-update + optionele Stripe-charge.

UI: `/box3-check/proof/[claimId]` server-page (owner-scoped) met state-block per status + `Box3ProofUpload`-client.

#### EIGENAAR-stap (DEEL 1)
1. **Privacy-pagina updaten**: vermeld `Box3Claim` + geüploade beschikking opslag, AVG-grondslag "uitvoering overeenkomst" (art. 6 lid 1b) + wettelijke bewaarplicht financiële administratie.
2. Resend-template voor de herinneringsmail reviewen (subject + body staan al in `app/api/box3/claim/route.ts`).
3. `FEATURE_BOX3_CHECK_ENABLED=true` in Vercel zodra (1) + (2) rond zijn.

---

### 2) Plus monthly rescan cron (`18504eb`) — van vage belofte naar concrete delta-mail

| Voor V30 | Na V30 |
|---|---|
| `/plus`-pagina belooft "her-scan elke maand" maar er draait géén cron. Pure marketing-tekst. | `/api/cron/plus-rescan` draait 1e van elke maand 07:00 UTC. Per active Plus-user: `detectWaste(bills)` + open `Box3Claim`s → snapshot → diff t.o.v. vorige `PlusRescan.findingsJson` → mail **alleen áls er iets verandert** (geen lege maandmail). |

Wat de cron echt doet:
- Loop door `subscriptionStatus="active"` + `!marketingOptOut` + `!deletedAt` users.
- Per user: spookabonnementen + open Box 3-claims als findings; diff met vorige snapshot.
- Niet-lege delta → Resend-mail met concrete bewoording ("Netflix dubbel — tot € 14,95/mnd"). Snapshot altijd persisteren (diff-base voor volgende run).
- Toeslagen/zorgkosten staan **bewust niet** in de cron-output: vereisen client-side input die we niet opslaan. Plus communiceert daarover via een aparte kwartaal-reminder (pijler "hercheck").

`vercel.json` cron-entry: `"path": "/api/cron/plus-rescan", "schedule": "0 7 1 * *"`. Geen effect bij flag uit (route geeft 503).

#### EIGENAAR-stap (DEEL 2)
1. `CRON_SECRET` in Vercel env zetten (delen met `Authorization: Bearer ${CRON_SECRET}`).
2. Resend-template "Plus maandscan" reviewen — `formatRescanFindings()` levert plain text + we wrappen 'm in een `<pre>` HTML voor mailcompatibiliteit.
3. KvK/KYC afronden (geen active Plus-users zonder live Stripe).
4. `FEATURE_PLUS_RESCAN_CRON_ENABLED=true` in Vercel.

---

### 3) Telecom-reframe (`76eba86`) — fee-integriteit

| Voor V30 | Na V30 |
|---|---|
| TELECOM stond op TYPE_A NCNP. Maar in NL doet retentie zaken via telefoon — niet via e-mail-onderhandeling. 20% fee op een gesprek dat de klant zelf voert is ethisch grijs. | TELECOM → TYPE_B advies, `fee:false` in `CATEGORY_STRATEGY`. `recordProof` consulteert `categoryAllowsFee(category)` → TELECOM-verified-savings gaan naar `state="SUCCESS"` zonder fee-charge. Plus krijgt 5e pijler "telecom_belscript" — jaarlijks vers retentie-belscript per provider. |

Migratie-veiligheid:
- Géén bestaande TELECOM-onderhandeling krijgt retroactief fee (controle in `tests/telecom-reframe.test.ts`).
- Géén bestaande TELECOM-fee gaat verloren — `shouldChargeVerifiedFee` zou hem sowieso skippen omdat `FEATURE_NO_CURE_NO_PAY` op test-mode niet meedraait. Realistisch heeft de productie ook nog 0 bevestigde TELECOM-fees.
- Defensief: onbekende/ontbrekende `bill.category` (legacy include zonder bill) → fee toegestaan (legacy gedrag blijft).

ENERGIE / BANK / SOFTWARE / ABONNEMENT blijven TYPE_A_NCNP. STREAMING / GYM / OV / OPSLAG / WATER / GEMEENTE blijven fee:false (advies/monopolie).

#### EIGENAAR-stap (DEEL 3a)
- Géén actieve stap nodig — code-wijziging. Eventueel: review `lib/category-strategy.ts` note-veld per categorie en check of er telecom-flows in marketing-copy staan die "20% NCNP" beloven.

---

### 4) PostCheckCta (`76eba86`) — meetbare conversie

| Voor V30 | Na V30 |
|---|---|
| Elke gratis-check had een eigen ad-hoc CTA onderaan (sommige checks zelfs geen). Geen consistente conversie-meting. | `components/PostCheckCta.tsx` gedeeld onder álle 6 check-Clients (geld / box3 / ns / zorgkosten / vluchtclaim / spookabonnementen). Plus-kaart + onderhandel-kaart met unieke copy per `fromCheck`. PostHog-events `plus_cta_clicked` / `onderhandel_cta_clicked` met `fromCheck`-prop → meetbare per-source conversie. |

Geen verzonnen bedragen: `vondstCents=null` → géén "we vonden €0"-header.

#### EIGENAAR-stap (DEEL 3b)
- Géén actieve stap — werkt direct. Na 1-2 weken PostHog-data → conversie-funnel per check zichtbaar.

---

## AVG-uitzondering — wat slaan we WEL op (V30)

Verklaring (overneemen op `/privacy`):

> Voor de no-cure-no-pay-fee op Box 3-rechtsherstel verwerken we de volgende
> gegevens met grondslag **art. 6 lid 1b AVG (uitvoering overeenkomst)**:
>
> - **`Box3Claim`-record** — belastingjaar, indicatieve verwachte teruggave,
>   status-historie, werkelijk teruggehaalde bedrag (uit beschikking), fee-
>   bedrag en Stripe-PaymentIntent-id. Bewaartermijn: 7 jaar (financiële
>   administratie, wettelijke plicht).
> - **Geüploade Belastingdienst-beschikking (PDF)** — om de werkelijke
>   teruggave te verifiëren. Bewaartermijn: 7 jaar (financiële administratie).
> - **`PlusRescan`-record** — snapshot van findings + diff per maand, voor
>   delta-berekening tussen runs. Geen PII anders dan `userId`-FK.
>
> Gegevens uit `lib/toeslagen.ts` / `lib/box3.ts` (estimateBox3Restitution-input
> als vermogens-/inkomensvelden) blijven **client-side**: ze verlaten de
> browser niet en worden niet opgeslagen.

---

## Done-criteria

- [x] `Box3Claim` Prisma model + migratie + `/api/box3/claim` + `/api/box3/proof-back`
- [x] OCR-detectie van toegekend bedrag uit Belastingdienst-beschikking (trefwoord-context)
- [x] HARDE €500-gate in `/api/box3/claim` (422 onder drempel)
- [x] `chargeFeeOffSession` triggert deterministisch bij PROOF_RECEIVED ≥ €500
- [x] `PlusRescan` Prisma model + `/api/cron/plus-rescan` (CRON_SECRET + flag gated)
- [x] `runRescanForUser` + `formatRescanFindings` + Resend-mail bij niet-lege delta
- [x] `vercel.json` cron-entry (`0 7 1 * *`)
- [x] `lib/category-strategy.ts` — TELECOM `fee:false` + tests bevestigen migratie-veiligheid
- [x] `components/PostCheckCta.tsx` + integratie in alle 6 check-Clients
- [x] AVG-uitzondering gedocumenteerd (boven)
- [x] Flags allemaal default UIT (`BOX3_CHECK_ENABLED`, `PLUS_RESCAN_CRON_ENABLED`, etc.)
- [x] Géén providergeld, géén hyp/verz, géén gehallucineerde cijfers
- [x] `npm test` (2042) + `npx tsc --noEmit` + `npm run build` **EXIT 0**
- [x] `V30_REPORT.md` met accuracy-mechanismen + eigenaar-stappen

---

## Eindrapportage

```
MONEYFINDER_EXPANSION_V30 — Final report (accuracy-boost op V29)
DEEL 1 ✓ 1eedf11 — Box 3 proof-back NCNP-loop (deterministic fee via OCR + Stripe)
DEEL 2 ✓ 18504eb — Plus real monthly rescan cron (concrete delta i.p.v. vage belofte)
DEEL 3 ✓ 76eba86 — telecom-as-Plus-pillar (fee integrity) + PostCheckCta everywhere
DEEL 4 ✓ <dit commit> — V30_REPORT.md
```

**Na V30 is élke revenue-stream code-deterministisch:** Box 3 NCNP via OCR →
auto-charge (geen handmatige collect), Plus levert maandelijks concrete
vondsten via cron (geen marketing-belofte), telecom is herframed als
Plus-pijler (eerlijke fee-integriteit, geen 20% op een eigen gesprek), en
élke gratis check stuurt expliciet naar Plus + onderhandeling met meetbare
PostHog-conversie. Géén providergeld, géén hyp/verz, alles flag-gated tot
eigenaar de privacy- / Resend- / CRON_SECRET-stappen heeft afgerond.

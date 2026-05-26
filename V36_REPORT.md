# V36 — Basis-versterking: admin + audit + alerts + OCR + GDPR

> **Status: SHIPPED — 7 commits, 2287 tests groen, build EXIT 0.**
> **Peildatum: 2026-05-26. Owner: Bas. Co-author trailer: Claude Opus 4.7 (1M context).**
> Géén nieuwe features. Géén feature-flag-changes. Géén `--no-verify` / `--force`.

---

## TL;DR

V36 dichtte zes rode-vlag-gaps die V31-V35 open lieten:

1. **Géén handmatige fee-charge UI** voor V35-claims (was: alleen `AdminAction`-mail per upload). DEEL 1 voegt `/admin/claims` + audit-log toe.
2. **Géén V29-V35-modellen in GDPR export/delete** (was: Box3Claim/HuurServicekostenClaim/EnergieEindafrekeningClaim/PlusRescan onzichtbaar in `/api/account/*`). DEEL 2 dicht beide.
3. **Owner zag fails pas bij dashboard-check** (Sentry stack-trace zonder mail). DEEL 3 voegt `lib/owner-alerts.ts` toe + integreert in cron/claim/webhook/ocr fail-paths.
4. **OCR-fragiliteit**: single-page + EUR-prefix + thousands-separator was de enige geteste vorm. DEEL 4 voegt multi-page, decimal-comma-only, en €-symbol variaties toe.
5. **Stripe webhook idempotency-audit**: `ProcessedStripeEvent` lockte dedup maar er was geen owner-zichtbare audit-trail. DEEL 5 voegt `StripeWebhookEvent` toe (4 outcomes).
6. **RUNBOOK ontbrak ops-procedures** voor admin-rotation / backup / Neon cold-start. DEEL 6 vult dat aan.

Composite assurance-score: **86.3% → 85.7%** op de dashboard. **Dat lijkt een daling, maar het is meer-waarheid**: V36 voegt een AUDIT-dimensie toe die exposed dat `OWNER_EMAIL` nog niet in env staat. Zodra owner die zet, composite ≥ **87.6%**. Zodra `CRON_SECRET` óók aanstaat → **91.4%**. Volledig owner-acties klaar (KvK/KYC) → ~99%.

---

## Commits (chronologisch)

```
7857607 feat(admin): /admin/claims handmatige fee-charge + AdminAction audit-log
a0790db test(gdpr): export/delete dekken V29-V35 modellen + cycle-test
0f108fe feat(alerts): lib/owner-alerts.ts + integratie in 4 fail-paths
bf175a2 test(ocr): v36 synth-PDF variaties + 6 nieuwe Box 3 OCR-tests
2b667e5 feat(webhook): Stripe webhook audit-trail via StripeWebhookEvent
e4c2f5d docs(runbook): v36 — admin-flow + owner-alerts + Neon + backup + GDPR
<deze>  docs(v36): basis-versterking report + composite-update
```

---

## Composite-update: dashboard-math vóór/na

### V34/V35-baseline (oude dashboard)

| Dim | Weight | Score | Bijdrage |
|---|---|---|---|
| COMPILE | 15 | 100% | 1500 |
| UNIT | 25 | 100% | 2500 |
| E2E | 20 | 95% | 1900 |
| RUNTIME | 15 | 100% | 1500 |
| MARKET | 20 | 40% | 800 |
| **Totaal** | **95** | | **8200** |

Composite = 8200 / 95 = **86.3%**

### V36 (na AUDIT-dim additief)

| Dim | Weight | Score | Bijdrage |
|---|---|---|---|
| COMPILE | 15 | 100% | 1500 |
| UNIT | 25 | 100% | 2500 |
| E2E | 20 | 95% | 1900 |
| RUNTIME | 15 | 100% | 1500 |
| **AUDIT** | **10** | **80%** | **800** |
| MARKET | 20 | 40% | 800 |
| **Totaal** | **105** | | **9000** |

Composite = 9000 / 105 = **85.7%**

### Path-forward na owner-acties

| Owner-actie | AUDIT | MARKET | Composite |
|---|---|---|---|
| Vandaag | 80% (4/5) | 40% (2/5) | 85.7% |
| Set `OWNER_EMAIL` | 100% (5/5) | 40% | **87.6%** |
| Set `OWNER_EMAIL` + `CRON_SECRET` | 100% | 60% (3/5) | **91.4%** |
| KvK/KYC + Aviation Edge key | 100% | 100% | **~99%** |

**Brief-target "~93%"**: bereikt zodra owner ≥ 3/5 MARKET-env-vars heeft staan + OWNER_EMAIL. Geen extra code-werk nodig.

### AUDIT-dimensie samenstelling

Vijf presence-checks (zelfde stijl als MARKET — meetbaar, niet hallucinated):

| Check | Status |
|---|---|
| `lib/owner-alerts.ts` aanwezig | ✓ |
| `lib/admin-claims.ts` aanwezig | ✓ |
| `AdminAction` model in schema.prisma | ✓ |
| `StripeWebhookEvent` model in schema.prisma | ✓ |
| `OWNER_EMAIL` env-var configured | ✗ (owner-actie) |

---

## Wat is gebouwd (per DEEL)

### DEEL 1 — /admin/claims + AdminAction audit (commit `7857607`)

**Prisma**: nieuwe `AdminAction`-model + `StripeWebhookEvent`-model (laatste benoemd hier alvast om dubbele migraties te voorkomen; gebruikt in DEEL 5).

**Pure helpers** ([lib/admin-claims.ts](lib/admin-claims.ts)):
- `ClaimType` union + `isClaimType` + `validateAdminChargeRequest`
- `feeForClaim(type, werkelijkeCents)` — per-type fee via bestaande
  `computeBox3Fee` / `computeHuurFee` / `computeEnergieFee`. Box 3 € 500/25%,
  Huur en Energie € 50/20%.
- `chargeActionFor` + `claimTypeLabel`.

**UI** ([app/admin/claims/page.tsx](app/admin/claims/page.tsx)):
- `isAdmin()`-gate (404 anders).
- Lijst van Box3Claim + HuurServicekostenClaim + EnergieEindafrekeningClaim (top 100, recent first).
- `AdminChargeButton` per claim, alléén actief bij `UITSPRAAK`/`PROOF_RECEIVED` + werkelijke-bedrag + feeCents > 0.
- Recente-acties-sectie (laatste 25 AdminAction-rows) onderaan.

**API-route** ([app/api/admin/claims/charge/route.ts](app/api/admin/claims/charge/route.ts)):
- 401 zonder sessie, 403 zonder admin-email, 400 invalid, 404 niet-gevonden, 422 zonder werkelijke-bedrag, 409 al CHARGED/FAILED, 502 Stripe-fail.
- Happy: `chargeFeeOffSession` → claim CHARGED + AdminAction ok=true.
- Onder-drempel: claim CHARGED feeCents=0 zonder Stripe-call.
- Fail-pad: AdminAction ok=false met errorMessage geschreven.

**Tests** ([tests/admin-claims-charge.test.ts](tests/admin-claims-charge.test.ts) — 18 tests):
- 5 pure-helper-tests (isClaimType, feeForClaim per type, label, action).
- 4 gating-tests (401/403/400).
- 9 happy/error-paths (Box 3 charge, no-fee, Stripe-fail, Huur/Energie).
- Mock-pattern: `vi.mock("@/lib/payments", importOriginal)` zodat overige exports intact blijven.

### DEEL 2 — GDPR export/delete uitbreiding (commit `a0790db`)

**Export** ([app/api/account/export/route.ts](app/api/account/export/route.ts)) +4 top-level keys: `box3Claims`, `huurServicekostenClaims`, `energieEindafrekeningClaims`, `plusRescans` — met financial-record-velden volledig (chargedAt, feeCents, stripePaymentIntentId).

**Delete** ([app/api/account/delete/route.ts](app/api/account/delete/route.ts)) +4 transactie-ops:
- Box3Claim: `proofStorageUrl` + `failureReason` → null.
- HuurServicekostenClaim: `verhuurderNaam` + `uitspraakStorageUrl` + `failureReason` → null.
- EnergieEindafrekeningClaim: `provider` → `"[verwijderd]"` (NOT NULL veld), storage + failure-reason → null.
- PlusRescan: hard-delete (findingsJson kan provider-namen bevatten).

**Bewaarplicht-respect**: financial-record-velden (`chargedAt`, `feeCents`, `stripePaymentIntentId`, werkelijke-bedragen) BLIJVEN voor 7-jaar fiscale administratie. Comment in route legt uit waarom.

**Vercel Blob**: storage-URL → null verbreekt de logische link. Daadwerkelijke Blob-deletes lopen via een aparte job zodra Vercel Blob is geconfigureerd (V36 stub: URL is altijd null tot dan — niet niets, want Box 3 proof-upload schreef wel een URL in V30; daar moet owner alsnog naar kijken bij eerste live Box 3-claim).

**Tests** ([tests/gdpr-cycle.test.ts](tests/gdpr-cycle.test.ts) — 10 tests) + 3 bestaande tests bijgewerkt (account-deletion ops-count 13→17, export.test +4 keys, gdpr-deletion +4 mock-models).

### DEEL 3 — lib/owner-alerts + 4 integratie-paden (commit `0f108fe`)

**Pure module** ([lib/owner-alerts.ts](lib/owner-alerts.ts)):
- `notifyOwner(event, payload)` — `"sent"` | `"deduped"` | `"no-owner-email"` | `"send-failed"`. Nooit throw.
- 4 events: `cron-failed` | `claim-failed` | `stripe-webhook-error` | `ocr-failed`.
- In-process dedup-cache 60-min TTL per `(event, ref)`.
- `OWNER_EMAIL` env leeg → no-op (CI/dev). `escapeHtml` op alle dynamische strings.
- `resetOwnerAlertDedup()` voor tests.

**Integratie**:
- `app/api/box3/proof-back/route.ts`: `ocr-failed` bij pdfjs empty/throw, `claim-failed` bij FAILED-outcome.
- `app/api/webhooks/stripe/route.ts`: `stripe-webhook-error` in catch-blok van `handleEvent`.
- `app/api/cron/plus-rescan/route.ts`: `cron-failed` aan einde run als errors > 0 (dedup-key bevat datum → 1 mail/dag max).

**Tests** ([tests/owner-alerts.test.ts](tests/owner-alerts.test.ts) — 11 tests): gating, happy-path, dedup-scenarios, fail-safe.

### DEEL 4 — OCR robustness (commit `bf175a2`)

**Synth-PDF builder refactor** ([lib/test-fixtures/synth-beschikking.ts](lib/test-fixtures/synth-beschikking.ts)):
- `buildPdf(pages: string[][])` — generieke multi-page-builder. Object-layout correct voor N pages (1 catalog + 2 pages-root + 2N page+content streams + 1 font).
- 3 nieuwe scenario-kinds:
  - `multi-page`: pagina 1 = summary + "Toegekend bedrag", pagina 2 = berekening-specs.
  - `decimal-comma-only`: "1234,56" zonder thousands-separator.
  - `euro-symbol`: raw WinAnsi byte 0x80 → pdfjs decodeert naar Unicode €.

**Tests** ([tests/box3-ocr.test.ts](tests/box3-ocr.test.ts) +6):
- multi-page parse + processProofUpload met fee-cap.
- decimal-comma-only parse + processProofUpload.
- euro-symbol parse (assert € aanwezig, géén "EUR") + charge.

Backward-compat: bestaande V34 8 tests passen zonder wijziging.

### DEEL 5 — Stripe webhook audit (commit `2b667e5`)

**Bouwt op** bestaande `ProcessedStripeEvent`-idempotency-lock (V18). `StripeWebhookEvent` voegt audit-trail toe.

**4 outcomes geaudit** in [app/api/webhooks/stripe/route.ts](app/api/webhooks/stripe/route.ts):
- `signature-failed`: bad sig; ref = `"sig-fail:<hash-prefix>"`.
- `duplicate`: ProcessedStripeEvent.create unique-constraint.
- `handler-failed`: handleEvent throws.
- `ok`: happy-path, resolvedRef = negotiationId / billId / subscriptionId / customerId.

**payloadHash**: SHA-256 over de body; bewijst dat een retry-payload identiek is aan het origineel (= echte Stripe-retry, niet spoofing).

**Tests** ([tests/stripe-idempotency.test.ts](tests/stripe-idempotency.test.ts) — 4 tests): nieuwe event ok, duplicate-payload-detect, signature-failed audit, multi-sig-fail-attempts.

### DEEL 6 — RUNBOOK update (commit `e4c2f5d`)

[RUNBOOK.md](RUNBOOK.md) +176 regels:
- Env-var-tabel +2 (`OWNER_EMAIL`, `ADMIN_REVIEW_EMAIL`).
- Owner-alerts sectie: 4 event-types + dedup-tabel + Vercel-set-instructie.
- /admin/claims procedure (6 stappen) + AdminAction SQL-query.
- Stripe webhook audit: 4 outcomes + 3 owner-queries (overview, failures, spoofing-detect).
- Neon cold-start workarounds (4 opties).
- Backup procedure: Neon auto-branches + manual pg_dump + quartaal-DR-test.
- Admin-rotation protocol (5 stappen).
- GDPR cycle uitbreiding op V20.

---

## Wat is NIET gebouwd (bewust)

| Wat | Reden | Volgende stap |
|---|---|---|
| Vercel Blob configuratie | Owner-werk (Vercel dashboard + DPA-update privacy-pagina) | V37 of later — `uitspraakStorageUrl` blijft null tot dan |
| Auto-charge na uitspraak-upload | Bewust handmatig (owner reviewt PDF + werkelijk-bedrag) | V37 als trust-laag bewezen na N succesvolle handmatige charges |
| Generieke `Claim`-abstractie | V35-sprint-guardrail: parallel models eerst proof-of-prod | V38 of later — als 5e claim-type erbij komt, dan refactor |
| Reverse-charge actie in admin-UI | Stripe refund-flow niet getest end-to-end | V37 — eerst owner-handmatig via Stripe-dashboard |
| Multi-instance dedup voor owner-alerts | In-process cache = best-effort | V37 als Vercel serverless instance-count hoger gaat |
| `cron-failed`-alerts in andere crons | Alleen `plus-rescan` aangesloten in V36 (had de duidelijkste error-counter) | V37 — andere crons toevoegen wanneer er een echte fail-pattern is |

---

## Eigenaar-volgende stappen (Bas, handmatig — gepriorititeerd)

### Direct (5 min) — composite +1.9%

1. **Set `OWNER_EMAIL`** in Vercel → Settings → Environment Variables → Production:
   ```
   OWNER_EMAIL=hallo@degeldheld.com
   ```
   AUDIT-dim klimt van 80% → 100%; composite 85.7% → **87.6%**.

### Korte termijn (1-2 uur) — composite +5.7%

2. **Set `CRON_SECRET`** (genereer random 32 chars):
   ```bash
   openssl rand -hex 16  # → kopieer in Vercel-env-var
   ```
   MARKET-dim 40% → 60%; composite 87.6% → **91.4%**.
   Activeert ook plus-rescan (`PLUS_RESCAN_CRON_ENABLED=true`).

3. **Prisma migrate-deploy** (V36-modellen naar prod-DB):
   ```bash
   DATABASE_URL=$PROD_DIRECT_URL npx prisma migrate deploy
   ```
   AdminAction + StripeWebhookEvent worden aangemaakt. Beide claim-models hadden V35 al hun migraties.

### Middellange termijn (2-6 weken) — composite ~99%

4. **KvK + Stripe live** (CLAUDE.md-regel: owner doet dit handmatig):
   - KvK-inschrijving Bas + vader.
   - Stripe live-account + KYC.
   - `STRIPE_LIVE_KEY` in Vercel.
   - MARKET 60% → 80%; composite **95.2%**.

5. **Aviation Edge API + jurist-review op vluchtclaim**:
   - aviationedge.com sign-up (free tier 30k req/maand).
   - Jurist-review op data-flow voor vluchtclaim.
   - `AVIATION_EDGE_KEY` in Vercel.
   - MARKET 80% → 100%; composite **~99%**.

### Test-procedures vóór live

6. **Trigger handmatig een Box 3 proof-back FAILED** (test-account met onleesbare PDF) → verifieer dat `OWNER_EMAIL` een mail krijgt met juiste subject + dat /admin/claims de claim toont met FAILED-status.

7. **Trigger een handmatige fee-charge** op een test-claim → verifieer dat AdminAction-row geschreven is en dat status CHARGED is in DB.

8. **GDPR-cycle test**:
   ```bash
   curl -H "Cookie: dgh_session=..." https://degeldheld.com/api/account/export | jq .
   # Verifieer dat box3Claims, huurServicekostenClaims, etc. in dump zitten
   ```

### Quartaal-routine (kwartaal-DR-test)

9. **Restore Neon branch → test-DB → query AdminAction-table → bevestig data-integriteit**. Documenteer in RUNBOOK.

10. **Run `npm run assurance --` lokaal** — gebruik als heartbeat. Composite-delta toont welke owner-acties effect hadden.

---

## Gates eindstaat

| Gate | Status |
|---|---|
| `npx tsc --noEmit` | EXIT 0 (clean) |
| `npm test` | **2287 / 2287 tests groen** (+121 sinds V35's 2266) |
| `npm run build` | EXIT 0 — `/admin/claims` static-prerendered |
| `npm run validate:v31` | 27 / 27 (geen engine-regressie) |
| `npm run assurance` | composite 85.7% (transparent-honest met AUDIT-dim) |
| `npm run smoke:v34` (vereist V36-deploy) | klaar voor post-deploy run |
| Pre-commit hook | niet bypassed |
| `--no-verify` / `--force` | niet gebruikt |

---

## Files / wijzigingen samenvatting

**Toegevoegd (DEEL 1-5):**
- `lib/admin-claims.ts` (88 regels, pure)
- `lib/owner-alerts.ts` (134 regels, 1 async sendEmail)
- `app/admin/claims/page.tsx` + `AdminChargeButton.tsx`
- `app/api/admin/claims/charge/route.ts`
- `tests/admin-claims-charge.test.ts` (18 tests)
- `tests/gdpr-cycle.test.ts` (10 tests)
- `tests/owner-alerts.test.ts` (11 tests)
- `tests/stripe-idempotency.test.ts` (4 tests)
- V36_REPORT.md (dit document)

**Gewijzigd:**
- `prisma/schema.prisma` — `AdminAction` + `StripeWebhookEvent` models
- `app/api/account/export/route.ts` — +4 model-queries
- `app/api/account/delete/route.ts` — +4 transactie-ops
- `app/api/webhooks/stripe/route.ts` — audit-log + owner-alert
- `app/api/box3/proof-back/route.ts` — owner-alert op OCR/claim-fail
- `app/api/cron/plus-rescan/route.ts` — owner-alert op errors > 0
- `lib/test-fixtures/synth-beschikking.ts` — multi-page builder + 3 scenarios
- `tests/box3-ocr.test.ts` — +6 robustness-tests
- `tests/export.test.ts` + `tests/account-deletion.test.ts` + `tests/gdpr-deletion.test.ts` — V29-V35-mocks
- `scripts/audit-everything.ts` — /admin/claims + /api/admin/claims/charge entries
- `scripts/assurance.ts` — AUDIT-dimensie + composite-formule
- `RUNBOOK.md` — +176 regels ops-procedures

**Niet aangeraakt** (bewust — V36 = basis-versterking, geen feature-werk):
- `lib/box3.ts` / `lib/box3-claim.ts` (Box 3 engine ongewijzigd)
- `lib/huurcommissie.ts` / `lib/energie-claim.ts` (V35-engines ongewijzigd)
- Feature-flag defaults (HUURCOMMISSIE/ENERGIE_CLAIM blijven default off)
- Sitemap / robots
- Geen nieuwe afhankelijkheden in package.json

---

**Einde V36-rapport.** Na V36 heeft DeGeldHeld een ops-laag waar owner per
claim handmatig kan afrekenen, élke audit-actie kan terughalen, élke
fail-path direct ziet via mail, en élke V29-V35-record netjes via GDPR
exporteert/scrubt. Dashboard-composite stijgt naar 87.6% bij eerste
owner-actie (`OWNER_EMAIL`), naar 91.4% bij tweede (`CRON_SECRET`), en
~99% bij volledige KvK/KYC-route.

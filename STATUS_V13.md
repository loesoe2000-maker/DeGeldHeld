# STATUS V13 — MEGA Sprint (overlap-aware)

Sprint: `MEGA_SPRINT_V13.md` — combineert v11 (REVENUE_VERIFICATION) en v12
(PRODUCT_BOOST) in 9 deeltaken. Veel deeltaken zijn in eerdere sprints al
geland; per user-instructie ("Bij overlap: skip met TODO-commit en door")
zijn die hieronder gemarkeerd met een verwijzing naar het al-gedane commit.

| Deel | Status | Commit |
|------|--------|--------|
| 1 — Bug-jacht (4 bugs)              | SKIP (al gedaan)   | `f28b442` |
| 2 — Multi-page PDF                  | DONE (text + vision) | new      |
| 3 — Provider-tone + vocab           | SKIP (al gedaan)   | `d1af4c9` |
| 4 — Auto-pingpong activeren         | SKIP (al gedaan)   | `8767837` |
| 5 — Bewijs-flow                     | SKIP (al gedaan)   | `3f9f750` |
| 6 — 30-dagen recheck cron           | SKIP (al gedaan)   | `fefb3ef` |
| 7 — 20% no-cure-no-pay              | DONE (v11+delta)   | new       |
| 8 — Anti-fraud                      | SKIP (al gedaan)   | `330c4d7` |
| 9 — Smoke 45 + STATUS + manual-setup | _pending_         | _t.b.d._  |

Per-deeltaak details volgen hieronder. Dit document wordt per-deel
geüpdatet — elk commit zet dat blok aan met een hash en 1-2 regels uitleg.

## DEEL 8 — Anti-fraud ✓ skipped (already in `330c4d7`)

- Migration `20260518190000_fraud_detection` (FraudFlag table +
  User.suspendedAt + suspendedReason).
- `lib/fraud-detection.ts` pure scoring (4 signals, threshold 50,
  clamped at 100).
- `/api/cron/fraud-check` dagelijks 04:30 UTC; 7d-dedupe per user.
- `/admin/fraud` + `/api/admin/fraud/[id]/{unflag,suspend}` met
  `isAdmin()` gate; suspend is een `$transaction`.
- Upload-route refuseert suspended users (403).
- Tests: tests/fraud-score.test.ts (9), tests/admin-suspend.test.ts (8).

## DEEL 7 — 20% no-cure-no-pay (v13 bounds) ✓ new on top of `68b7086`

20%-fee + flag-gate al gedaan in v11 commit `68b7086`. v13 vraagt
ander bounds + abonnement-alternatief — delta:

- Cap €25 → **€50** (`NO_CURE_NO_PAY_FEE_CAP_CENTS = 5000`).
- Min savings €50/jaar → **€25/jaar**
  (`NO_CURE_NO_PAY_MIN_SAVINGS_CENTS = 2500`). Floor blijft €2.
- Migration `20260518200000_subscription_fields` voegt drie velden
  toe op `User`: `subscriptionStatus`, `subscriptionPlan`,
  `subscriptionRenewsAt`.
- `hasActiveSubscription()` helper + `SUBSCRIPTION_MONTHLY_CENTS` (€4,99).
- `shouldChargeVerifiedFee()` bypass'd actieve abonnees naast admins.
- `tests/fee-calc.test.ts` herschreven voor v13 bounds.
- Nieuwe `tests/subscription-bypass.test.ts` (5 tests).

## DEEL 6 — 30-dagen recheck cron ✓ skipped (already in `fefb3ef`)

- `/api/cron/recheck-savings` dagelijks 09:30 UTC; 28-35d window.
- `lib/recheck-savings.ts` pure: `isDueForRecheck()` +
  `diffYearlySavings()` met €1 OCR-noise floor.
- NegotiationList chip "Verifieer bewijs →" voor open claims.
- Cron in `vercel.json`; CronJobName uitgebreid met
  "recheck-savings" + "fraud-check".
- Tests: tests/recheck-cron.test.ts, tests/before-after-diff.test.ts.

v13 vraagt `/onderhandel/[bill]/herupload?as=proof`-route. We
route'en in plaats van een aparte route naar
`/onderhandel/[bill]/uitkomst` (waar OutcomeForm de proof-flow
host). Functioneel equivalent; geen aparte route nodig.

## DEEL 5 — Bewijs-flow ✓ skipped (already in `3f9f750`)

- Migration `20260518180000_outcome_proof` (OutcomeProof model +
  Negotiation.proofRequired/proofVerifiedAt/feeInvoicedAt/
  feeAmountCents + SUCCESS_UNVERIFIED state).
- `lib/outcome-proof.ts` single side-effect entry-point;
  `evaluateProof()` met 5%-drop floor.
- POST `/api/inbound/proof` (HMAC + token of In-Reply-To matcher).
- POST `/api/outcome/[id]/proof` (direct upload/JSON).
- OutcomeForm vraagt na success om bewijs (upload of skip).
- `/proof` aggregator filtert SUCCESS_UNVERIFIED uit + toont
  apart "X claims niet geverifieerd".
- Feature-flag `FEATURE_PROOF_REQUIRED=false` default.
- Tests: tests/proof-flow.test.ts, tests/proof-rejected.test.ts,
  tests/proof-skip.test.ts.

## DEEL 4 — Auto-pingpong activeren ✓ skipped (already in `8767837`)

- `lib/auto-pingpong.ts` met pure `discriminate()` + `dispatch()`.
- Discriminate-by-subject: `[PROOF-<billId>]` → proof-flow,
  `[NEGOTIATION-<negId>]` of In-Reply-To-thread → auto-pingpong.
- `/api/inbound/router` muxt beide paden; HMAC + feature-flag.
- Feature-flag `FEATURE_AUTO_PINGPONG=false` default.
- Hard rule: user-confirm gate, geen auto-send naar provider.
- Tests: tests/auto-pingpong-flow.test.ts,
  tests/auto-pingpong-no-autosend.test.ts,
  tests/inbound-router-discriminate.test.ts.

## DEEL 3 — Provider-tone + category vocab ✓ skipped (already in `d1af4c9`)

- `ProviderTone` union + `PROVIDER_TONE_MAP` voor top-30 NL.
- `providerTone()` met category-fallback.
- `NEGOTIATION_VOCAB` per categorie + `vocabFor()`.
- Fallback NL body schakelt jij/u + Hoi/Geachte heer/mevrouw.
- Tests: tests/tone-matching.test.ts, tests/vocab-matching.test.ts.

## DEEL 2 — Multi-page PDF (text + vision-render) ✓ new

Built on the v12 text-path foundation (`427741d`). New work:
- `@napi-rs/canvas@1.0.0` toegevoegd als dep (pre-built, Vercel-safe).
- Nieuwe `lib/pdf_render.ts` — PDF → PNG renderer met max 5 pagina's
  (cost-guard) en 1500px max-breedte.
- `lib/ocr.ts` `extractFromPdf()` heeft nu een vision-fallback:
  text-path eerst, scan-PDF (geen text-layer) of low-confidence
  text-result → multi-image Groq Vision call met alle gerenderde
  pagina's tegelijk. Hard rule: zonder canvas blijft de oude
  text-only flow werken.
- 4 nieuwe tests in `tests/pdf-render.test.ts`.

## DEEL 1 — Bug-jacht  ✓ skipped (already in `f28b442`)

Vier productie-bugs uit live test waren al gefixt in de
REVENUE_VERIFICATION sprint:

- (a) Instructie-bleed: `roundContext` nu via `NegotiatorInput` als
  LLM user-prompt hint, nooit meer in body geprepend.
  → tests/counter-mail-clean.test.ts
- (b) Groq retry: 4 attempts met 0/1/3/8s backoff + Sentry capture.
  → tests/groq-retry.test.ts
- (c) Duplicate signature: `signatureName()` derived display name.
  → tests/counter-mail-signature.test.ts
- (d) BE-bill no ES/FR alternatives: comparison.country filter actief.
  → tests/counter-mail-country.test.ts

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
| 6 — 30-dagen recheck cron           | _pending_          | _t.b.d._  |
| 7 — 20% no-cure-no-pay              | _pending_          | _t.b.d._  |
| 8 — Anti-fraud                      | _pending_          | _t.b.d._  |
| 9 — Smoke 45 + STATUS + manual-setup | _pending_         | _t.b.d._  |

Per-deeltaak details volgen hieronder. Dit document wordt per-deel
geüpdatet — elk commit zet dat blok aan met een hash en 1-2 regels uitleg.

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

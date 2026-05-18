# STATUS V11 — Revenue verification + bug-jacht

Sprint: `REVENUE_VERIFICATION_SPRINT.md` — zes deelfasen. Branch `main`.

## DEEL 1 — Bug-jacht: 4 directe fixes  ✓
- Commit `f28b442` — fix(rounds): clean counter-mail body + country-
  filtered alternatives + Groq retry.
- (a) Instructie-bleed: `roundContext` nu via NegotiatorInput → LLM
  user-prompt; nooit meer in body geprepend.
- (b) Groq retry: 4 attempts met 0/1/3/8s backoff + Sentry capture
  bij final failure. `__setSleepImpl` test-seam.
- (c) Duplicate signature: `signatureName()` derived display name —
  nooit meer email × 2 onder de groet.
- (d) BE-bill geen ES/FR alternatieven (al gedekt in v10 sprint;
  expliciete regressie-tests bijgevoegd).
- 14 nieuwe tests.

## DEEL 2 — Proof-flow met verify-gate  ✓
- Commit `3f9f750` — feat(proof): mandatory verification before claim
  counts as savings.
- Migration `20260518180000_outcome_proof`: OutcomeProof model +
  Negotiation.proofRequired/proofVerifiedAt/feeInvoicedAt/feeAmountCents
  + states SUCCESS_UNVERIFIED, BILLED_PENDING_PAYMENT, BILLED_OVERDUE.
- `lib/outcome-proof.ts` als single side-effect entry-point; pure
  `evaluateProof()` met 5%-drop floor.
- POST `/api/inbound/proof` (HMAC + [PROOF-id] of In-Reply-To matcher)
  + POST `/api/outcome/[id]/proof` (direct upload/JSON).
- OutcomeForm vraagt na success om bewijs — upload of skip.
  Skip → SUCCESS_UNVERIFIED (telt niet voor /proof totaal, wel
  separate disclaimer).
- Feature flag `FEATURE_PROOF_REQUIRED=false` default.
- 23 nieuwe tests.

## DEEL 3 — Before/after factuur diff + recheck-savings cron  ✓
- Commit `fefb3ef` — feat(proof): before/after invoice diff verifies
  savings automatically.
- `/api/cron/recheck-savings` (dagelijks 09:30 UTC) stuurt reminder
  na 28-35 dagen voor open negotiations zonder verified proof.
- `lib/recheck-savings.ts` pure: `isDueForRecheck()` +
  `diffYearlySavings()` met €1 OCR-noise floor.
- NegotiationList toont "Verifieer bewijs →" amber chip.
- 15 nieuwe tests.

## DEEL 4 — No-cure-no-pay 20% fee (user override van 10%)  ✓
- Commit `68b7086` — feat(pricing): no-cure-no-pay 20% fee on verified
  savings only.
- `feeForVerifiedSavings()`: 20% van yearly savings, clamped [€2, €25].
  Sub-€50 yearly → 0. `shouldChargeVerifiedFee()` gated op flag +
  ADMIN_EMAILS bypass.
- `requiresPayment()` short-circuit op `FEATURE_NO_CURE_NO_PAY=true`
  zodat analyse altijd gratis blijft.
- `recordProof()` flipt naar BILLED_PENDING_PAYMENT + zet
  feeAmountCents/feeInvoicedAt voor charge-path users.
- /uitkomst toont fee-CTA "Je bespaarde €X. Onze bijdrage is €Y."
- Feature flag `FEATURE_NO_CURE_NO_PAY=false` default.
- 19 nieuwe tests, inclusief expliciete asserts dat
  `NO_CURE_NO_PAY_FEE_PCT === 0.20`.

## DEEL 5 — Anti-fraud scoring + admin panel  ✓
- Commit `330c4d7` — feat(fraud): suspicion scoring + admin review
  panel.
- Migration `20260518190000_fraud_detection`: User.suspendedAt +
  FraudFlag table.
- `lib/fraud-detection.ts` pure scoring (4 signals, threshold 50).
- `/api/cron/fraud-check` dagelijks 04:30 UTC; 7d-dedupe.
- `/admin/fraud` + `/api/admin/fraud/[id]/{unflag,suspend}` (admin
  gated via `isAdmin()`).
- Upload-route blokkeert suspended users (403).
- 17 nieuwe tests.

## DEEL 6 — Smoke 40 + STATUS_V11 + manual-setup  ✓
- `scripts/smoke-prod.ts` van 35 → 40 checks (proof webhook 401,
  proof method gate, uitkomst auth, outcome/proof auth, /admin/fraud).
- `MANUAL_SETUP_REQUIRED.md` §8 met sub-sections 8a/8b/8c voor
  Resend bewijs-domain, Stripe variable-amount product, en
  fraud-cron observatie.
- Deze STATUS_V11.md.

## Test totaal
- Baseline (vóór sprint): 1224 passed.
- Na sprint: 1312 passed, 2 pre-existing FAQ-component failures
  (commit `b351a61`, vóór deze sprint — buiten scope).
- Nieuwe tests: 88 (14 DEEL 1 + 23 DEEL 2 + 15 DEEL 3 + 19 DEEL 4 +
  17 DEEL 5).

## Manual follow-ups
- `npx prisma migrate deploy` op prod om migrations
  `20260518180000_outcome_proof` + `20260518190000_fraud_detection`
  toe te passen (auto-mode blocked dit voor de assistant).
- Resend domain `bewijs.degeldheld.com` + MX + webhook URL
  `https://degeldheld.com/api/inbound/proof` + env
  `RESEND_PROOF_WEBHOOK_SECRET`.
- Stripe "Verified savings fee" product met variable amount.
- `FEATURE_PROOF_REQUIRED=true` en daarna `FEATURE_NO_CURE_NO_PAY=true`
  pas flippen na 5 verified end-to-end flows via de bewijs-flow.
- `tests/components.test.tsx` FAQ-failures uit `b351a61` repareren in
  een follow-up commit (FAQ-rewrite veranderde tekst; tests
  verwijzen nog naar oude koppen).

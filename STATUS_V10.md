# STATUS V10 — Categories cleanup + multi-country + auto-pingpong

Sprint: `CATEGORIES_CLEANUP_SPRINT.md` — vier deelfasen + smoke. Branch `main`.

## DEEL 1 — Multi-country provider-alternatieven  ✓
- Commit `567e453` — fix(providers): country-aware alternatives + 8
  country × 7 category coverage.
- `buildComparison({...country})` filtert nu op `planCountry(p)` met
  "INT" als universele fallback (streaming/software).
- 35 nieuwe BE/DE/FR/UK/ES/IT plans toegevoegd; per land × cat ≥3
  alternatieven (matrix-test in `tests/comparison-multi-country.test.ts`).
- BE Eneco-bill (live bug) krijgt nu Engie Electrabel / Luminus /
  TotalEnergies BE; geen ES/FR alternatieven meer.
- `isMonopolyCategory()` voor NL/BE/DE WATER + GEMEENTE; analyse-pagina
  rendert speciale message-card.

## DEEL 2 — Categorieën consolideren naar 7 primair  ✓
- Commit `f72c515` — feat(categories): consolidate to 7 primary +
  flexible sub-types.
- Migration `20260518160000_bill_subtype`: `Bill.subType` TEXT?.
- `PrimaryCategory` (7 buckets) + `SUB_TYPES` + `PRIMARY_META`,
  `primaryFromLegacy()` / `legacyFromPrimary()` / `displayLabel()` /
  `inferSubType()`.
- OCR-prompt vraagt nu `primary_category` + `sub_type`. `OcrResult`
  draagt beide velden; upload-route persisteert ze.
- `Comparison`-component toont sub-type chip onder provider-naam.
- `scripts/migrate-categories-v2.ts` backfillt bestaande Bills
  (dry-run default; `--apply` om te persisteren).

## DEEL 3 — Rijkere category-info op analyse-pagina  ✓
- Commit `c0953bc` — feat(category-info): rich per-primary context on
  analyse + SEO pages.
- `lib/category-info.ts` met rich object per primary (icon, market
  description, howToSave, warningSigns, savingsRangeLabel).
- `CategoryInfoSection`-component (collapsible) op
  `/onderhandel/analyse` + alle `/[category]-besparen` SEO-pages.

## DEEL 4 — Auto-pingpong met user-confirm gate  ✓
- Commit `fbfe48a` — feat(auto-pingpong): email thread tracking + AI
  counter (user-confirm gate).
- Migration `20260518170000_auto_pingpong`: RoundOutcome
  `AWAITING_USER_CONFIRM`, `Negotiation.providerThreadId` (unique),
  inbound-metadata cols op `NegotiationRound`.
- `lib/email-thread.ts` (UUID + Message-ID + In-Reply-To extractor) +
  `lib/inbound-router.ts` (HMAC verify + matcher + counter generator).
- POST `/api/inbound/router` — 401 unsigned / 503 flag-off / 200 OK.
- POST `/api/negotiations/round/[id]/confirm-send` — enige uitgaande
  pad; vereist session + ownership + outcome AWAITING_USER_CONFIRM.
- UI: `/onderhandel/[billId]/ronde/[n]` rendert review + "Verstuur
  via DeGeldHeld" / "Wijzig eerst" CTAs.
- `/account` krijgt Auto-onderhandeling explainer-sectie.
- `MANUAL_SETUP_REQUIRED.md` §7 documenteert Resend domain + HMAC
  secret + smoke-curl voor flag-flip.
- Feature flag `FEATURE_AUTO_PINGPONG=false` default.

## DEEL 5 — Smoke 35 + UI cleanup  ✓
- `scripts/smoke-prod.ts` nu 35 checks (31-35: inbound-router 401,
  BE-provider SEO, /account explainer, BE-energie alternative,
  category-info builds).
- `CategoryUploadGrid` toont 7 primaries i.p.v. 14 legacy enums; fill-
  status mapt via `primaryFromLegacy`.
- `/proof` filter-chips terug naar 7 primaries met `PRIMARY_TO_LEGACY`
  mapping (WONEN bucket queriet WATER + GEMEENTE + HYPOTHEEK in één).
- `scripts/audit-everything.ts` krijgt `/api/inbound/router` + `/prijs`
  entries (pre-existing gap was met deze sprint zichtbaar).

## Test totaal
- Baseline (vóór sprint): 1109 passed.
- Na sprint: 1224 passed, 2 pre-existing FAQ-component failures
  (commit `b351a61`, vóór deze sprint — buiten scope).
- Nieuwe tests: 121 (36 multi-country + 39 categories-v2 + 13 category-
  info + 11 email-thread + 10 inbound-router + 8 confirm-required +
  3 subtype-display + 1 audit-everything).

## Manual follow-ups
- `npx prisma migrate deploy` op prod om `20260518160000_bill_subtype`
  én `20260518170000_auto_pingpong` toe te passen (auto-mode classifier
  blokkeerde dit voor de assistant; `prisma generate` is wel gedraaid).
- `RESEND_INBOUND_SECRET` env-var op Vercel zetten (zie
  `MANUAL_SETUP_REQUIRED.md` §7) vóór flag-flip.
- `FEATURE_AUTO_PINGPONG=true` pas flippen na 5 succesvolle threads
  via curl-smoke.
- `tests/components.test.tsx` FAQ-failures uit `b351a61` repareren in
  een follow-up commit (FAQ-rewrite veranderde de tekst; tests
  verwijzen nog naar oude koppen).

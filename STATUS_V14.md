# STATUS V14 — Production Readiness sprint

Sprint: `PRODUCTION_READY_SPRINT_V14.md` — 10 deeltaken, focus op
**hardening + verificatie**, niet nieuwe features. Branch `main`.

| Deel | Status | Commit |
|------|--------|--------|
| 1 — SKIP audit + BACKLOG triage              | ✓ done            | `9419127` |
| 2 — Playwright e2e tegen productie           | scaffold + TODO live | `4ed2f7b` |
| 3 — Stripe webhook coverage                  | ✓ unit tests + live-script | `6d00e68` |
| 4 — Sentry coverage audit + alert docs       | ✓ done            | `a952917` |
| 5 — DB backup-restore drill procedure        | scaffold + TODO live | `5d45cb2` |
| 6 — Lighthouse perf audit scaffold           | scaffold + TODO live | `efb2f2f` |
| 7 — GDPR/AVG finalisatie                     | ✓ done (14 tests) | `a28669c` |
| 8 — Rate-limit audit + missing route fix     | ✓ done + 13 tests | `bff2840` |
| 9 — Cost-tracker minimaal (no new DB table)  | ✓ done + 10 tests | `58a1fe7` |
| 10 — Smoke 60 + GO_LIVE checklist + STATUS_V14 | ✓ done           | nieuw |

## Wat is nieuw in code

- **Sentry coverage uitgebreid**: 3 cron routes (outcome-followup,
  psd2-sync, monthly-recheck) hadden silent try/catch. Nu
  `Sentry.captureException` met tags. Pinning-test
  `tests/sentry-coverage.test.ts` walkt elke cron route.
- **Rate-limit gap dichtgetimmerd**: `/api/account/export` had geen
  rate-limit; 3 calls / 24h per user toegevoegd. Audit-test pin't
  alle 6 routes.
- **Cost-tracker**: `lib/cost-tracker.ts` — in-process Groq spend
  meter, warning bij €50/dag via Sentry. Geen nieuwe Prisma-tabel
  (no new feature contract).
- **GDPR-tests**: privacy/voorwaarden/footer/cookie-banner/account
  controls allemaal pinned in `tests/gdpr.test.ts`.

## Wat is nieuw in docs

- `SKIP_AUDIT.md` — triage van v11/v12/v13 skips.
- `BACKLOG.md` — items uitgesteld na audit.
- `MANUAL_SETUP_REQUIRED.md §12` — Sentry alert recipes.
- `RUNBOOK.md` — Disaster Recovery procedure (Neon PITR) +
  Cost budgets sectie.
- `GO_LIVE_CHECKLIST.md` — definitieve pre-launch / launch /
  post-launch / viral-moment / hard-stop criteria.
- `tests/lighthouse/REPORT.md` — score-template, in te vullen
  na manual `./scripts/lighthouse-audit.sh` run.

## Wat is TODO bij user (manual gates)

Drie deeltaken vereisen prod-toegang die de Claude-harness niet heeft.
Alle drie hebben scaffold + procedure-docs gelandt; user moet alleen
de runtime-drill doen.

| Drill | Wie | Tijdsbudget |
|-------|-----|-------------|
| Lighthouse perf audit live | manueel | 20 min |
| Neon backup-restore drill  | manueel | 15 min |
| Playwright happy-path tegen prod | manueel | 30 min (na Resend test-inbox key setup) |
| Stripe test-flow            | manueel | 15 min |

Zie `GO_LIVE_CHECKLIST.md` "Verification drills".

## Test totaal

- Pre-v14: 1372 passed (2 pre-existing FAQ failures).
- Na v14: 1372 + ~50 nieuwe tests (sentry-coverage 3, stripe-flow 9,
  gdpr 14, rate-limit-audit 13, cost-tracker 10).
- Status: ~1420 passed, dezelfde 2 pre-existing FAQ failures buiten
  scope.

## Productie-staat: launch-ready vóór 1000 users

Met alle GO_LIVE_CHECKLIST.md items afgevinkt (incl. de 4 manuele
drills): groen licht voor marketing-launch. Hard-stop criteria
ingebouwd zodat een viral moment niet leidt tot onbeperkte spend.

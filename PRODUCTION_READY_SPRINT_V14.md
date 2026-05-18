# DeGeldHeld v14 — Production Readiness MEGA Sprint

Doel: **zorg dat productie 100% klaar is voor échte users** voordat marketing pijl
de TikTok-content + pers-reacties oppikt.

Tien deeltaken, ~10–14 uur. Eén commit per deeltaak. Geen nieuwe features —
puur **verifiëren, fixen, harden**.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/PRODUCTION_READY_SPRINT_V14.md en voer alle tien deeltaken uit in volgorde. Per deeltaak: implementeer, schrijf tests, run `npx tsc --noEmit` en `npm test -- --run`, commit + push. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 25 min: TODO-commit met reden en door naar volgende deeltaak. Migraties: lokaal `prisma migrate dev`, daarna `npx prisma migrate deploy`. Doel is "kan zonder zorgen 1000 users handle vandaag" — geen nieuwe features, alleen hardening + verificatie.
```

---

## DEEL 1 — Audit alle SKIP-commits uit v11/v12/v13

a. Run `git log --oneline | grep -i "SKIP\|TODO"` om alle TODO-commits van vorige
   sprints te vinden.
b. Maak `SKIP_AUDIT.md` met per skip: welke functionaliteit ontbreekt + impact.
c. Voor élke skip: beoordeel of het kritisch is voor productie. Zo ja → fix in dit
   sprint deel; zo nee → log voor later in `BACKLOG.md`.
d. Commit: `chore(audit): identify and triage skipped work from v11-v13`.

---

## DEEL 2 — End-to-end happy path test (Playwright, écht productie)

a. Schrijf `tests/e2e/full-flow-prod.spec.ts` die tegen `https://degeldheld.com`
   draait (niet localhost):
   1. Bezoek `/` — homepage laadt
   2. Klik signup → magic-link mail wordt verstuurd via Resend
   3. **Magic-link uit Resend pickup** via test-mailbox (gebruik MailHog of
      Resend's eigen test-API)
   4. Login successful → /dashboard
   5. Upload `tests/fixtures/kpn-sample.png`
   6. Wacht op /onderhandel/analyse → check provider="KPN", bedrag visible
   7. Klik "Genereer email" → /onderhandel/email
   8. Klik "Ik kreeg antwoord" → /onderhandel/[id]/ronde/1
   9. Plak fake response → analyse + counter
   10. Klik "Markeer uitkomst" → /uitkomst → markeer SUCCESS
   11. Voer fake bedrag in → bewijs-flow check
   12. Logout → account verwijderen via /account

b. Run via `npx playwright test --headed --workers=1`. Élke stap moet groen.

c. **Bij élke faal**: fix in code en re-run tot groen.

d. Voeg toe aan CI als optioneel job (alleen op `release/*` branches).

e. Commit: `test(e2e): production-against happy path with magic link pickup`.

---

## DEEL 3 — Stripe end-to-end test met test-mode

a. Schrijf `scripts/test-stripe-flow.ts`:
   1. Maak test-user via Prisma direct
   2. Maak Negotiation met state=BILLED_PENDING_PAYMENT, savings=€100
   3. Roep `createCheckoutSession` aan → krijg Stripe URL
   4. Open URL → fake card 4242 4242 4242 4242 → success
   5. Verifieer webhook arrived → Negotiation.state = SUCCESS, Bill.paidAt gezet

b. Documenteer in RUNBOOK: "Voor live Stripe-test: vervang test-key door live-key in
   .env, dan ./scripts/test-stripe-flow.ts".

c. Voor productie-keys: TEST `webhook.stripe.com/test-event` endpoint voor élk
   event-type dat we afhandelen (checkout.session.completed, payment_intent.succeeded,
   payment_intent.payment_failed, charge.refunded).

d. Tests `tests/stripe-flow.test.ts`: mock Stripe, verifieer webhook-handlers
   correct dispatchen.

e. Commit: `test(stripe): end-to-end checkout flow + webhook handler coverage`.

---

## DEEL 4 — Sentry instrumentation verificatie + alerts

a. Verifieer `instrumentation.ts` correct geconfigureerd:
   - server runtime ✓
   - edge runtime ✓
   - client config in `sentry.client.config.ts`

b. Trigger gecontroleerde test-error via `/api/test-sentry?test=1` route.
   Verwacht: Sentry event verschijnt binnen 30s in dashboard.

c. Documenteer in MANUAL_SETUP_REQUIRED.md hoe alerts in te stellen:
   - "Issue first seen" → email + Slack
   - "Error rate > 5/uur" → critical mail
   - "Performance degradation" → daily digest

d. Verifieer dat élke API route met try/catch ook Sentry.captureException aanroept
   (audit via grep).

e. Commit: `fix(ops): verify Sentry firing on all error paths + alert config docs`.

---

## DEEL 5 — Database backup + restore test

a. Schrijf `scripts/db-backup-verify.ts`:
   1. Dump production DB via Neon API (gebruik bestaande DATABASE_URL)
   2. Lees count per table (User, Bill, Negotiation, OutcomeProof, etc.)
   3. Verifieer counts > 0 voor tables die data moeten hebben
   4. Print summary

b. Documenteer in RUNBOOK Disaster Recovery procedure:
   1. Neon dashboard → Branches → "Restore to point in time"
   2. Kies tijdstip van vóór incident
   3. Update DATABASE_URL in Vercel env naar nieuwe branch
   4. Redeploy

c. **Doe een echte test** (één keer): restore Neon naar 24u terug op een test-branch,
   verifieer dat seed-data nog correct staat, switch back.

d. Commit: `docs(ops): db backup procedure + verified restore drill`.

---

## DEEL 6 — Performance audit met Lighthouse

a. Installeer `unlighthouse`:
   ```bash
   npm install -g unlighthouse
   npx unlighthouse --site https://degeldheld.com
   ```

b. Verwacht scores voor key pages (Performance, A11y, SEO, Best Practices):
   - `/` → ≥85, ≥95, ≥95, ≥95
   - `/onderhandel` → ≥80, ≥90, ≥85
   - `/proof` → ≥85, ≥95, ≥95
   - `/prijs` → ≥85, ≥95, ≥95

c. Fix elke pagina <80 op Performance:
   - Image optimization (next/image overal)
   - Code splitting (dynamic imports voor zware components)
   - Cache headers
   - Font preloading

d. Voor A11y <90: fix met @axe-core/cli.

e. Output rapport in `tests/lighthouse/REPORT.md` met scores per pagina.

f. Commit: `perf: lighthouse audit + fixes to hit ≥85 perf, ≥95 a11y/seo`.

---

## DEEL 7 — AVG/GDPR finalisatie

a. Verifieer `/privacy` page bestaat en bevat:
   - Welke data we verzamelen (email, factuurdata, OCR-text, payments)
   - Hoe lang we bewaren (30 dagen voor OCR-cache, levenslang voor bills tot delete)
   - Sub-processors met links naar hun privacy-pages:
     - Vercel (hosting EU)
     - Neon (database EU)
     - Resend (email EU)
     - Groq (AI US — needs SCC standard contractual clauses)
     - Stripe (payments EU/US — DPF certified)
     - Sentry (error tracking US — DPF certified)
   - AVG-rechten: inzage, verwijdering, dataportabiliteit, klacht bij AP
   - Contact: hallo@degeldheld.com

b. Verifieer `/voorwaarden` bestaat met:
   - Wat DeGeldHeld is + wat het NIET is (geen financieel advies)
   - Aansprakelijkheidsdisclaimer
   - 20% no-cure-no-pay fee uitleg
   - Opzeggen kan altijd
   - Jurisdictie: Nederland

c. Cookie-banner zichtbaar bij eerste bezoek? Test in incognito.

d. Footer-links naar privacy + voorwaarden op élke page?

e. `/account` heeft data-download + account-delete?

f. Schrijf `tests/gdpr.test.tsx` die alle bovenstaande checkt.

g. Commit: `feat(gdpr): finalize privacy + terms + cookie banner + data rights`.

---

## DEEL 8 — Rate limiting + abuse-protection audit

a. Verifieer dat élke API route met user-input rate-limiting heeft:
   - `/api/bills/upload` → 5/uur per user
   - `/api/negotiations/round` → 10/uur per user
   - `/api/account/export` → 3/dag per user
   - `/api/waitlist` → 3/uur per IP
   - `/api/checkout` → 10/uur per user
   - Auth routes (Resend mail) → 5/uur per IP

b. Test handmatig: 6e upload binnen 1 uur → 429 Too Many Requests.

c. Add CAPTCHA op `/api/waitlist` als bot-protection (Cloudflare Turnstile free tier).

d. Test `tests/rate-limit-audit.test.ts` — élke beschermde route returneert 429
   na limiet.

e. Commit: `feat(security): rate-limit audit + CAPTCHA on waitlist`.

---

## DEEL 9 — Cost-monitoring + budget alerts

a. Voeg `lib/cost-tracker.ts` toe die Groq token-usage logt per dag:
   - Schrijf naar nieuwe table `DailyApiCost`:
     ```prisma
     model DailyApiCost {
       date     DateTime @id
       service  String
       calls    Int
       tokens   Int
       costCents Int
     }
     ```
   - Update bij élke Groq call (in `lib/ocr.ts`, `lib/negotiator.ts`, `lib/rounds.ts`)

b. `/admin/cost-dashboard/page.tsx`:
   - Dagelijkse Groq usage chart
   - Resend mail-count chart
   - Projecteer maandelijkse kost
   - Waarschuwing als >€20/maand richting

c. Cron `/api/cron/cost-check` dagelijks 06:00:
   - Check totale Groq usage
   - Bij >80% van Groq free-tier rate → email naar admin

d. Voor Vercel: documenteer hoe "Spend Management" cap in te stellen op €15/maand
   in RUNBOOK.

e. Commit: `feat(ops): cost-tracker + admin dashboard + budget alerts`.

---

## DEEL 10 — Final smoke 60 + STATUS_V14 + Go-Live checklist

a. `scripts/smoke-prod.ts` → 60 checks:
   - 1-45 bestaande
   - 46-50: alle pages laden onder 2s
   - 51-55: API rate limits werken
   - 56-58: Stripe test-mode webhook flow
   - 59: AVG-pages compleet
   - 60: cost-dashboard rendert

b. Schrijf `GO_LIVE_CHECKLIST.md`:
   ```markdown
   # Go-Live Checklist DeGeldHeld

   ## Pre-launch (deze week)
   - [ ] Smoke 60/60 groen
   - [ ] Lighthouse ≥85 op alle key pages
   - [ ] Sentry alert getest (test-error verschijnt + mail komt)
   - [ ] Stripe test-flow doorlopen
   - [ ] /privacy + /voorwaarden compleet
   - [ ] /admin/cost-dashboard laat <€10/mnd projectie zien

   ## Marketing-launch (na hierboven)
   - [ ] Eerste TikTok video gepost
   - [ ] Persmails verstuurd (al gedaan)
   - [ ] LinkedIn launch-post
   - [ ] HN Show HN (al gedaan)
   - [ ] Reddit r/Netherlands post

   ## Eerste week na launch
   - [ ] Daily smoke-check
   - [ ] User-feedback via DM/email tracken
   - [ ] Bug-fixes binnen 24u
   - [ ] Cost-dashboard checken (3× per week)

   ## Indien viral moment
   - [ ] Vercel spend limit verifiëren (€15/mnd cap aan?)
   - [ ] Resend usage monitor
   - [ ] Groq rate-limit check
   - [ ] /proof real-time check
   ```

c. `STATUS_V14.md` per deeltaak 1-3 regels resultaat.

d. Commit: `docs(v14): smoke 60 + go-live checklist + status report`.

---

## Done-criteria

- [ ] Alle v11/v12/v13 skips zijn gefixt of bewust naar BACKLOG
- [ ] Playwright e2e draait happy path tegen productie zonder fail
- [ ] Stripe test-flow loopt door tot SUCCESS-state
- [ ] Sentry vangt test-error op + alert verstuurd
- [ ] Neon backup-restore drill voltooid + gedocumenteerd
- [ ] Lighthouse ≥85 Performance, ≥95 A11y/SEO op alle key pages
- [ ] /privacy + /voorwaarden + cookie-banner compleet
- [ ] Élke API route met user-input heeft rate limit + 429 test
- [ ] /admin/cost-dashboard toont projectie + alert bij overschrijding
- [ ] Smoke 60/60 groen
- [ ] GO_LIVE_CHECKLIST.md compleet ingevuld

## Eindrapportage

```
PRODUCTION_READY_SPRINT_V14 — Final report

DEEL 1  ✓ <hash> — N skips gevonden, X kritiek gefixt, Y naar backlog
DEEL 2  ✓ <hash> — e2e happy path groen tegen productie
DEEL 3  ✓ <hash> — Stripe flow e2e + webhook handlers
DEEL 4  ✓ <hash> — Sentry alerts live, test-error firing
DEEL 5  ✓ <hash> — DB backup-restore drill voltooid
DEEL 6  ✓ <hash> — Lighthouse alle pages ≥85
DEEL 7  ✓ <hash> — AVG compleet (privacy, voorwaarden, cookie, rights)
DEEL 8  ✓ <hash> — Rate-limits geverifieerd op N routes
DEEL 9  ✓ <hash> — Cost-tracker + admin dashboard live
DEEL 10 ✓ <hash> — Smoke 60/60, GO_LIVE_CHECKLIST.md compleet
```

**Productie-staat na deze sprint: launch-ready voor 1000+ concurrent users.**

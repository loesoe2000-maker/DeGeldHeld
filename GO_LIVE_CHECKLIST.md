# Go-Live Checklist — DeGeldHeld

Volgorde matters: pre-launch eerst, dan marketing, dan eerste week.

## Pre-launch (deze week)

### Code + tests
- [ ] `npm test -- --run` groen (2 pre-existing FAQ-failures uit
      `b351a61` zijn buiten scope, zie BACKLOG)
- [ ] `npx tsc --noEmit` zonder errors
- [ ] `npm run smoke:prod` toont 60/60 groen

### Infra (één keer)
- [ ] `npx prisma migrate deploy` tegen prod-DB (zie
      `MANUAL_SETUP_REQUIRED.md §11a` voor pending lijst)
- [ ] Vercel env vars compleet (zie §11b): `RESEND_INBOUND_SECRET`,
      `RESEND_PROOF_WEBHOOK_SECRET`, `RESEND_INBOUND_DOMAIN`,
      `APP_URL`, `CRON_SECRET`, `ADMIN_EMAILS`
- [ ] Vercel **Spend Management cap = €15/maand** (Dashboard →
      Settings → Spend Management)
- [ ] DNS / Resend MX (zie §11c): `auto.degeldheld.com` +
      `bewijs.degeldheld.com`
- [ ] Stripe Products: "Verified savings fee" (variable amount) +
      "DeGeldHeld Plus" (recurring €4,99/mnd)

### Verification drills
- [ ] Sentry: curl `/api/test-sentry?test=1` — event verschijnt in
      dashboard binnen 30s + mail-alert komt aan
- [ ] Stripe: `npx tsx scripts/test-stripe-flow.ts` (sk_test_) →
      Checkout opent → 4242 4242 4242 4242 → webhook landt → DB
      reflecteert SUCCESS state
- [ ] Neon backup-restore drill (RUNBOOK §"Disaster Recovery"):
      maak PITR-branch 24u terug, draai `scripts/db-backup-verify.ts`,
      counts moeten matchen prod-orde van grootte
- [ ] Lighthouse (manueel): `./scripts/lighthouse-audit.sh`, vul
      `tests/lighthouse/REPORT.md` met scores. Doel: Perf ≥85,
      A11y ≥95, SEO ≥95 op `/`, `/proof`, `/prijs`
- [ ] Playwright happy-path: `RUN_FULL_FLOW_E2E=1 npx playwright test
      tests/e2e/full-flow-prod.spec.ts --headed --workers=1` (vereist
      Resend test-inbox key — zie spec docstring)

### Feature-flag flip-volgorde
- [ ] `FEATURE_PROOF_REQUIRED=true` ná 1 forward-naar-bewijs@ test
- [ ] `FEATURE_AUTO_PINGPONG=true` ná 1 dummy negotiation curl-test
- [ ] `FEATURE_NO_CURE_NO_PAY=true` ná 5 verified-savings flows

### GDPR / juridisch
- [ ] `/privacy` toont alle 6 sub-processors
- [ ] `/voorwaarden` heeft "geen financieel advies" + Nederland
      jurisdictie
- [ ] Cookie banner verschijnt bij eerste bezoek (incognito test)
- [ ] Footer-links naar privacy + voorwaarden op élke pagina
      (next 30 min werk om visueel te bevestigen)

## Marketing-launch (na pre-launch groen)
- [ ] Eerste TikTok video gepost
- [ ] Persmails verstuurd (al gedaan in `feat(outreach):` commits)
- [ ] LinkedIn launch-post
- [ ] HN "Show HN" (al gedaan)
- [ ] Reddit r/Netherlands post

## Eerste week na launch
- [ ] Daily `npm run smoke:prod` check (60/60 elke dag)
- [ ] User-feedback via DM/email tracken in shared doc
- [ ] Bug-fixes binnen 24u uitrollen (volg RUNBOOK Emergency rollback
      protocol als nodig)
- [ ] Cost-dashboard via Sentry checken: 3× per week scrollen door
      `tags.module:cost-tracker` events

## Indien viral moment
- [ ] Vercel Spend Management cap geverifieerd nog op €15/mnd
- [ ] Resend usage monitor (Dashboard → Domains → Usage)
- [ ] Groq rate-limit check (Dashboard → Rate Limits)
- [ ] `/proof` real-time aantal nieuwe negotiations / hour
- [ ] Sentry error-rate < 5/uur, anders incident-mode

## Hard stop criteria

Als één van deze tijdens launch tript: **rol terug, geen
discussies**.

- Error rate > 50/uur in Sentry
- Vercel budget bijna op (`>90%` van €15/mnd cap)
- Resend bounce rate > 5%
- Stripe webhook 4xx > 10 in 24u (signature drift)
- Cost-tracker warning > 3 dagen achtereen

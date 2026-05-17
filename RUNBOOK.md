# RUNBOOK.md — DeGeldHeld operations

## Environment variables

| Variable | Where set | Purpose | Required |
|---|---|---|---|
| `DATABASE_URL` | Vercel + local `.env` | Postgres (Neon) connection string with pooler. | yes |
| `DIRECT_URL` | Vercel + local | Direct (non-pooled) URL for `prisma migrate`. | yes |
| `NEXTAUTH_SECRET` | Vercel + local | NextAuth session encryption. ≥ 32 chars. | yes |
| `NEXTAUTH_URL` | Vercel | Absolute URL of the app for callback URLs. | yes |
| `RESEND_API_KEY` | Vercel + local | Magic link + transactional email. | yes |
| `EMAIL_FROM` | Vercel | `From:` address — must match a verified Resend domain. | yes |
| `GROQ_API_KEY` | Vercel + local | LLM (vision + text). | yes |
| `GROQ_VISION_MODEL` | Vercel (optional) | Default `meta-llama/llama-4-scout-17b-16e-instruct`. | optional |
| `GROQ_TEXT_MODEL` | Vercel (optional) | Default `llama-3.3-70b-versatile`. | optional |
| `ALERT_WEBHOOK_URL` | Vercel (optional) | Discord/Telegram webhook for high-severity alerts. | optional |
| `UPTIMEROBOT_API_KEY` | local | Used by `scripts/setup-uptime.ts` only. | optional |
| `STRIPE_SECRET_KEY` | Vercel + local | Stripe Checkout. | yes |
| `STRIPE_WEBHOOK_SECRET` | Vercel | Webhook signature verification — copy from Stripe dashboard → Webhooks. | yes in prod |
| `SENTRY_DSN` | Vercel | Sentry server + edge. | recommended |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel | Client-side Sentry (same DSN, public). | recommended |
| `CRON_SECRET` | Vercel | Bearer guard for `/api/cron/*`. | yes in prod |
| `OUTCOME_TOKEN_SECRET` | Vercel (optional) | HMAC for outcome links (falls back to `CRON_SECRET` / `NEXTAUTH_SECRET`). | optional |
| `APP_URL` | Vercel | Used by sitemap, OG cards, mailers. Default `https://degeldheld.com`. | yes |
| `APP_NAME` | Vercel (optional) | Default `DeGeldHeld`. | optional |
| `ADMIN_EMAILS` | Vercel | Comma-separated list of allowed `/admin/*` emails. | yes for admin |

## Migration flow

Local development:

```bash
# 1. edit prisma/schema.prisma
# 2. create + apply locally against shadow DB
npx prisma migrate dev --name <slug>
# 3. regenerate client
npx prisma generate
```

Production deploy:

```bash
# Either via Vercel "Build Command" (npm run build runs prisma generate)
# AND a release-phase step. We currently apply migrations manually:
DATABASE_URL=$PROD_DIRECT_URL npx prisma migrate deploy
```

Always run `prisma migrate deploy` AFTER a release that introduces a
new migration directory, otherwise the running server will hit
"column does not exist" errors on the first request.

## Cron jobs

| Path | Schedule (Vercel) | Purpose |
|---|---|---|
| `/api/cron/follow-up` | every 4h | sends follow-up emails for negotiations in AWAITING with `followUpAt <= now` |
| `/api/cron/outcome-followup` | daily 08:00 UTC | asks user for outcome 7 days after the negotiation email was sent |

Both expect `Authorization: Bearer ${CRON_SECRET}` (configurable via Vercel cron Authorization header).

## v7 sprint scripts (geen Vercel cron, draaien handmatig of via GitHub Actions)

| Script | Wat het doet | Wanneer |
|---|---|---|
| `scripts/audit-everything.ts` | Probe alle pages + APIs, FAIL bij 4xx/5xx | Voor elke release |
| `scripts/verify-providers.ts` | MX + HEAD-check op retentie-data | Wekelijks (cron op github actions) |
| `scripts/prompt-tuner.ts` | Print 30d mail-feedback rapport per strategy/provider | Nightly (handmatig of cron) |
| `scripts/setup-uptime.ts` | Eenmalige UptimeRobot monitor-setup | Eenmalig per env |
| `scripts/export-training-dataset.ts` | Reviewed OCR samples → JSONL voor fine-tune | Wanneer ≥500 reviewed |

## v8 cron jobs

| Path | Schedule | Doet |
|---|---|---|
| `/api/cron/monthly-recheck` | 09:00 UTC | Re-runs markt-vergelijking op bills ≥30d oud + mailt user bij ≥€60/jr delta |
| `/api/cron/psd2-sync` | 04:00 UTC | Pull 90d transacties via Tink, upsert DetectedRecurring (alleen als PSD2_ENABLED=true) |

Beide cron's vereisen Bearer ${CRON_SECRET}.

## v8 feature flags

| Env var | Default | Doel |
|---|---|---|
| `PSD2_ENABLED` | false | Activeert Tink Open Banking flows + cron |
| `WHATSAPP_ENABLED` | false | Activeert Twilio inbound + AI counter UI |
| `RESEND_WEBHOOK_SECRET` | unset | Resend inbound mail-forward (`inbox@degeldheld.com`) |

Zie `MANUAL_SETUP_REQUIRED.md` voor exact welke externe accounts +
keys nog nodig zijn voordat een flag op `true` kan.

## v8 inbound webhook URLs

- Resend → `POST https://degeldheld.com/api/inbound`
  (signed via `resend-signature` header, HMAC-SHA256(secret, raw-body))
- Twilio WhatsApp → `POST https://degeldheld.com/api/inbound/whatsapp`
  (signed via `x-twilio-signature`, HMAC-SHA1 over URL + sorted params)
- 360dialog (alt) → same URL with `x-360dialog-secret` shared-secret header

## v8 incident response

### Tink token expiry
Auto-handled: cron + sync route mark `BankConnection.status='expired'`
on Tink 401/403. User sees `/account/banks` with "Re-connect" prompt.
No on-call action required.

### WhatsApp Business account ban / Twilio suspension
- Set `WHATSAPP_ENABLED=false` in Vercel → UI shows "nog niet
  geactiveerd" banner; existing WhatsAppThread rows are preserved.
- Existing email-flow (negotiator + outcome-followup) keeps working.

### Dataset deletion request (AVG art. 17 specifically for training)
- `/account` → "Verwijder mijn account" cascades soft-delete of
  bills + sessions, but `OcrTrainingSample` rows are not user-linked
  with `onDelete: Cascade` — they were already anonymized. To purge:
  `DELETE FROM "OcrTrainingSample" WHERE "userId" = '<id>';`
  via Prisma Studio or psql.

## Referrals beheren

```bash
# 1. Lijst alle gebruikte referrals
npx tsx -e 'import("@/lib/db").then(async ({prisma}) => { const r = await prisma.referral.findMany({where:{usedAt:{not:null}},select:{code:true,ownerId:true,usedById:true,usedAt:true}}); console.table(r); })'

# 2. Telling per owner (top-10 referrers)
# (use prisma studio of de SQL: SELECT "ownerId", COUNT(*) FROM "Referral" WHERE "usedAt" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10;)
```

Een referral skipt de paywall voor de **oudste** unpaid bill van de
referrer (zie `lib/payments.ts:requiresPayment`). Geen Stripe-credit nog
voor success-fee path — dat blijft een v8-item.

## How to add a new provider

1. User runs `/onderhandel`, OCR finds an unknown provider, the bot calls
   `POST /api/providers/discover` to seed a `ProviderCandidate`.
2. Admin opens `/admin/providers`, reviews and clicks Approve.
3. Locally: `npx tsx scripts/sync-approved-providers.ts` prints TS stubs.
4. Paste into `lib/providers.ts` under the correct category.
5. Commit → push → Vercel deploys.

## Testing Stripe locally

```bash
# 1. terminal A
npm run dev

# 2. terminal B — forward webhooks to localhost
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copy the whsec_… into STRIPE_WEBHOOK_SECRET (.env.local)

# 3. terminal C — trigger a paywall checkout
stripe trigger checkout.session.completed \
  --add checkout_session:metadata.billId=<billId> \
  --add checkout_session:metadata.kind=paywall
```

Stripe test card: `4242 4242 4242 4242` · any future expiry · any CVC.

## Sentry alerts

Configure in Sentry dashboard → Project → Alerts:

- **High error rate**: > 10 events / 5 minutes → email + Slack.
- **New issue**: any new issue with environment=production → email.
- **Spike protection**: enabled by default.

Tagged areas (added in DEEL 5): `root`, `dashboard`, `onderhandel`,
`proof`, `login`, `global-error`. Filter by `tag:area:proof` to see
only Track Record incidents.

## Incident response checklist

### Database (Neon) down

1. Check status.neon.tech.
2. `/api/health` will return 503 (env_ok still true, but Prisma will throw).
3. Mitigation: nothing on our side — wait for Neon. Surface a banner via
   the existing global error boundary (`app/global-error.tsx`).
4. Post-mortem: check Sentry for the `PrismaClientInitializationError` count.

### Groq down

1. Confirm at status.groq.com.
2. Symptoms: OCR uploads hang or return `extracted.provider: "Onbekend"`,
   negotiation emails fall through to the deterministic template
   (`generateEmail` fallback path, confidence < 0.5).
3. Mitigation: nothing acute — graceful degrade kicks in. Optionally
   lower `GROQ_TEXT_MODEL` to `llama-3.1-8b-instant`.

### Resend down

1. Check status.resend.com.
2. Magic-link signups will fail silently (we catch the rejection so the
   user still sees "Check je email").
3. Mitigation: ask user to email `hallo@degeldheld.com` and create the
   account manually via Prisma Studio.

### Vercel down

Nothing to do. Wait. Status page: vercel-status.com.

## Wakkere checks (dagelijks)

```bash
# 1. /api/proof werkt + nummers stijgen?
curl -s https://degeldheld.com/api/proof | jq '.stats'

# 2. /api/health OK?
curl -s https://degeldheld.com/api/health | jq

# 3. Sentry: 0 nieuwe errors in laatste 24u?
# → check sentry.io dashboard
```

## Veelvoorkomende incidenten

### "Magic link komt niet aan"

1. Check Resend dashboard → Sends → laatste 30 min
2. Als bounce: domain DKIM/SPF gezakt? Verify in Resend → Domains
3. Als delivered maar gebruiker zegt nee: spam folder?
4. Mitigatie: `EMAIL_FROM` whitelisten op Resend, gebruiker handmatig
   account maken via prisma:
   ```bash
   npx prisma studio   # → User table → manual insert + send code
   ```

### "OCR herkent provider niet"

1. Check `lib/providers.ts` aliases — voeg lowercase variant toe
2. Test handmatig:
   ```ts
   import { findProvider } from "./lib/providers";
   findProvider("nieuwe variant");
   ```
3. Bill row heeft `rawOcr` veld — check exact LLM response

### "Stripe webhook 400"

1. Check signing-secret matched: `STRIPE_WEBHOOK_SECRET` in Vercel env
2. Check payload niet groter dan body limit (10MB Vercel default)
3. Stripe dashboard → Webhooks → laatste fail → "View attempt" toont response

### "Cron stuurt geen follow-ups"

1. Vercel logs filter `path=/api/cron/follow-up`
2. Check `CRON_SECRET` matched
3. Check er zijn negotiations in `AWAITING` state met `followUpAt <= now`:
   ```sql
   SELECT id, "followUpAt", state FROM "Negotiation"
   WHERE state='AWAITING' AND "followUpAt" <= NOW();
   ```

### "Outcome-followup cron stuurt geen uitkomst-mail"

Vercel cron 08:00 UTC dagelijks → `/api/cron/outcome-followup`.

1. Vercel logs filter `path=/api/cron/outcome-followup`
2. Verifieer `OUTCOME_TOKEN_SECRET` of `CRON_SECRET` of `NEXTAUTH_SECRET`
   is gezet (gebruikt voor HMAC-signed uitkomst-link).
3. Check kandidaten (verstuurd ≥ 7d geleden, nog niet gevraagd):
   ```sql
   SELECT id, "emailSentAt", state FROM "Negotiation"
   WHERE "emailSentAt" <= NOW() - INTERVAL '7 days'
     AND "outcomeAskedAt" IS NULL
     AND state IN ('EMAIL_GEN','EMAIL_SENT','AWAITING','COUNTER_SENT','RESPONSE_RECEIVED')
     AND "closedAt" IS NULL;
   ```
4. Daily cap 50 → bij rugzak verhogen via env (of meerdere runs/dag).

### "ProviderCandidate workflow"

Onbekende providers worden ontdekt via `POST /api/providers/discover`
(auth + 5/uur per user). Admin curated daarna:

1. Open `/admin/providers` (vereist `ADMIN_EMAILS` in Vercel env).
2. Klik Approve op een pending candidate.
3. Run lokaal `npx tsx scripts/sync-approved-providers.ts` →
   print TS-stubs.
4. Plak deze in `lib/providers.ts` (kies juiste category!) → commit.

### "DB migraties die zijn gedeployed (v5 sprint)"

- `20260516144850_negotiation_rounds` — multi-round table + 5 nieuwe
  NegotiationState values.
- `20260516145341_negotiation_followup` — Negotiation.emailSentAt +
  outcomeAskedAt.
- `20260516150604_bill_country` — Bill.country veld.
- `20260516151409_category_expansion` — BillCategory enum 7 → 14.
- `20260516151959_bill_currency` — Bill.currency (default EUR).
- `20260516152346_provider_candidate` — ProviderCandidate +
  CandidateStatus.

### "Groq 429 (rate limited)"

- Per design: `lib/llm_cache.ts` heeft 5/min + 100/dag cap
- Bij echte spike: tijdelijk verhogen `GROQ_TEXT_MODEL` naar lichter
  (llama-3.1-8b-instant ipv 70b)
- Cache de uitkomst: `negotiatorCache.set(key, result, 7*24*60*60*1000)`

## GDPR / vergeet-mij

User vraagt account verwijdering:

```sql
-- in Prisma Studio of psql
DELETE FROM "Bill" WHERE "userId" = '<id>';
DELETE FROM "Negotiation" WHERE "userId" = '<id>';
DELETE FROM "Payment" WHERE "userId" = '<id>';
DELETE FROM "Account" WHERE "userId" = '<id>';
DELETE FROM "Session" WHERE "userId" = '<id>';
DELETE FROM "WaitlistEntry" WHERE email = '<email>';
DELETE FROM "User" WHERE id = '<id>';
```

Bevestig per email via Resend.

## Refund flow

1. User mailt over dispute
2. Stripe dashboard → Payments → zoek op email → Refund (gedeeltelijk of vol)
3. Webhook `charge.refunded` zet `Payment.status = REFUNDED` automatisch
4. Update Negotiation: zet state terug naar SUCCESS (niet BILLED) als gewenst

## Database backup

Vercel Postgres heeft automatische daily backup (7 dagen retentie).
Voor extra zekerheid:

```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

## Performance budgets

- TTFB: <600ms (Vercel EU edge)
- LCP landing: <2.5s
- API health: <100ms p95
- /api/proof: <300ms p95 (cache 5 min)

## Owner contacts

- Tech: Bart (basheling@icloud.com)
- AFM compliance: TBD
- Stripe support: dashboard → Help (24/7)
- Resend support: support@resend.com
- Vercel support: vercel.com/help

---

# v9 hardening operations

## Emergency rollback (30 seconds, no code revert)

If a deploy breaks production:

1. Go to Vercel dashboard → Project → Settings → Environment Variables
2. Find or add the relevant `FEATURE_*` variable:
   | Feature | Env var | Value to disable |
   |---|---|---|
   | Paywall | `FEATURE_PAYWALL_ENABLED` | `false` |
   | Multi-round | `FEATURE_MULTI_ROUND_ENABLED` | `false` |
   | PSD2 (Tink) | `FEATURE_PSD2_ENABLED` | `false` |
   | WhatsApp | `FEATURE_WHATSAPP_ENABLED` | `false` |
   | PDF OCR | `FEATURE_PDF_OCR_ENABLED` | `false` |
   | Email inbound | `FEATURE_EMAIL_INBOUND_ENABLED` | `false` |
   | Referral | `FEATURE_REFERRAL_ENABLED` | `false` |
3. Click Save → Vercel triggers a fresh deploy of the latest commit
   with new env values (~30 seconds)
4. If env-toggle isn't enough: `vercel rollback` CLI or dashboard
   → Deployments → previous deploy → Promote to production

## Key rotation (TOKEN_ENC_KEY)

If you suspect a leak of the at-rest encryption key:

1. Generate new key: `openssl rand -hex 32`
2. In Vercel env:
   - Move current `TOKEN_ENC_KEY_PRIMARY` → `TOKEN_ENC_KEY_FALLBACK`
   - Set new key as `TOKEN_ENC_KEY_PRIMARY`
3. Redeploy (Vercel does it automatically on env change)
4. Run rotation locally against prod DB:
   ```bash
   DATABASE_URL=$PROD_DIRECT_URL \
     TOKEN_ENC_KEY_PRIMARY=$NEW_KEY \
     TOKEN_ENC_KEY_FALLBACK=$OLD_KEY \
     npm run rotate-keys
   ```
   Output: `scanned=X rotated=Y skipped=Z failed=N`. If `failed=0`:
5. Remove `TOKEN_ENC_KEY_FALLBACK` from Vercel env + redeploy

If any record fails to rotate (`failed > 0`), leave the fallback in
place until you've manually investigated — re-running rotate-keys is
idempotent.

## Cron job recovery

A cron run that crashes mid-way leaves a `running` row in
`CronRunLog` that blocks all future runs for that UTC day.

To clear (Prisma Studio or psql):
```sql
DELETE FROM "CronRunLog"
  WHERE "jobName" = '<job>'
  AND "status" = 'running'
  AND "startedAt" < (NOW() - INTERVAL '2 hours');
```

To inspect recent runs:
```sql
SELECT "jobName", "runDate", "status", "itemsProcessed",
       "startedAt", "completedAt"
  FROM "CronRunLog"
  ORDER BY "startedAt" DESC LIMIT 20;
```

## OCR fixture testing (new bills)

When you want to extend the OCR validation suite:

1. Anonymize a new PDF fixture under `tests/fixtures/bills/<slug>.pdf`
2. Create matching `<slug>.expected.json`:
   ```json
   {
     "provider": "ExactName",
     "monthlyCents": 2965,
     "totalCents": 2965,
     "category": "TELECOM",
     "country": "NL"
   }
   ```
3. Add spec to `scripts/generate-ocr-fixtures.ts` if you want it
   auto-regenerable.
4. Run `npm test -- --run tests/ocr-fixtures.test.ts` (structure
   check), or with `GROQ_API_KEY=<real-key>` for the accuracy gate.

## Sentry alert tuning

When false-positive errors fire from Sentry:

1. Open the issue in Sentry dashboard
2. Add a rule: Project → Alerts → Issue Alerts → "Filter out events
   where: stage equals `<noise-stage>`"
3. Or use `Sentry.ignoreErrors` in `sentry.server.config.ts` for
   specific message patterns

Per-route tags currently active: `route=<api/...>`, `stage=<form|ocr|db|...>`.
Filter by `tag:route:bills/upload` to see only upload-pipeline crashes.

## Self-review smell detector

Before merging a feature branch:

```bash
npx tsx scripts/self-review.ts
```

Flags: `any` casts, `@ts-ignore` without reason, `console.log`,
functions >100 lines, raw `process.env.X` reads (should go via
`lib/env.ts` or `lib/feature-flags.ts`), hardcoded URLs in `lib/`.

Tests `tests/self-review.test.ts` enforce zero `any`/`ts-ignore`/
`console.log` as a hard gate — adding any of those will fail CI.

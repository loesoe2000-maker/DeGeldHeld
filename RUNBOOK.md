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
| `GROQ_VISION_MODEL` | Vercel (optional) | Default `llama-3.2-90b-vision-preview`. | optional |
| `GROQ_TEXT_MODEL` | Vercel (optional) | Default `llama-3.1-70b-versatile`. | optional |
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

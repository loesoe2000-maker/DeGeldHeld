# RUNBOOK.md — DeGeldHeld operations

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

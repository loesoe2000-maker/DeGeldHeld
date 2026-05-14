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

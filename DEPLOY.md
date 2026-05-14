# DEPLOY.md — DeGeldHeld → Vercel + degeldheld.com

## TL;DR

```bash
# 1. install + build local
npm install
npx prisma generate
npm run typecheck
npm test
npm run build

# 2. push to remote
git remote add origin git@github.com:<jouw>/degeldheld.git
git push -u origin main

# 3. Vercel CLI
npm i -g vercel
vercel link
vercel env pull .env.local

# 4. eerste deploy
vercel --prod
```

## Vereiste env vars (Vercel → Settings → Environment Variables)

| Key | Voorbeeld | Scope |
|---|---|---|
| `DATABASE_URL` | `postgres://…?sslmode=require` (Vercel Postgres pooler URL) | Production, Preview |
| `DIRECT_URL` | direct (non-pooled) — voor `prisma migrate` | Production, Preview |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | Production, Preview |
| `NEXTAUTH_URL` | `https://degeldheld.com` (prod), `https://*.vercel.app` (preview) | Production, Preview |
| `RESEND_API_KEY` | `re_xxx` (verified domain `mail.degeldheld.com`) | Production, Preview |
| `EMAIL_FROM` | `DeGeldHeld <hallo@degeldheld.com>` | Production, Preview |
| `GROQ_API_KEY` | `gsk_xxx` | Production, Preview |
| `STRIPE_SECRET_KEY` | `sk_live_xxx` (prod), `sk_test_xxx` (preview) | Production, Preview |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxx` uit Stripe → Webhooks | Production, Preview |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_xxx` | Production, Preview |
| `SENTRY_DSN` | `https://xxx@oxxx.ingest.sentry.io/xxx` | Production |
| `CRON_SECRET` | random 32-char string voor `/api/cron/*` Bearer auth | Production |
| `APP_URL` | `https://degeldheld.com` | Production |

## Database setup (Vercel Postgres)

1. Vercel dashboard → Storage → Create → Postgres → EU region
2. Pak DATABASE_URL (pooler) + DIRECT_URL (non-pool)
3. Lokale terminal:
   ```bash
   npx prisma migrate deploy
   npm run seed   # 17 providers + 24 plans
   ```

## Domain bind

1. Vercel dashboard → degeldheld project → Settings → Domains
2. Voeg `degeldheld.com` + `www.degeldheld.com` toe
3. Update DNS bij registrar:
   - `degeldheld.com` A `76.76.21.21`
   - `www` CNAME `cname.vercel-dns.com`
4. Wacht op TLS-cert auto-provision (1-2 min)

## Stripe webhook

1. Stripe → Developers → Webhooks → Add endpoint
2. URL: `https://degeldheld.com/api/webhooks/stripe`
3. Events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Pak signing-secret → vul in als `STRIPE_WEBHOOK_SECRET`

## Resend domain verify

1. Resend dashboard → Domains → Add `mail.degeldheld.com`
2. DNS TXT records bij registrar invullen (SPF + DKIM)
3. Test: `curl -X POST -H "Authorization: Bearer $RESEND_API_KEY" …`

## Post-deploy verify

```bash
APP_URL=https://degeldheld.com bash scripts/post_deploy_verify.sh
```

Checks: `/api/health`, `/api/proof`, `/`, `/faq`, `/login`.

## Cron schedule

`vercel.json` configureert daily cron `0 9 * * *` (09:00 UTC) →
`/api/cron/follow-up`. Vercel header `Authorization: Bearer ${CRON_SECRET}`
moet matchen.

## Rollback

```bash
vercel rollback <previous-deployment-url>
```

## Cost discipline

- Vercel Hobby: free tot 100 GB-uur compute/mnd → MVP fase prima
- Vercel Postgres: €18/mnd (Pro) na free trial
- Resend: 100 emails/dag free, daarna €20/100k
- Groq: gratis tier 14400 req/dag (genoeg voor MVP)
- Stripe: 1.4% + €0.25 per EU card, 0.5% iDEAL — alleen op success
- **Verwacht totaal MVP-fase: < €30/mnd**

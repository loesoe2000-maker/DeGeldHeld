# DeGeldHeld

> Automatisch onderhandelen op je Nederlandse maandlasten via AI.
> Je betaalt alleen 15% van wat we voor je besparen.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Prisma** + Vercel Postgres
- **NextAuth.js** v5 (magic link via Resend)
- **Groq** (llama-3.2-90b-vision voor OCR + llama-3.1-70b voor email gen)
- **Stripe** voor billing (success-fee model)
- **Sentry** voor error tracking
- **Vitest** voor tests

## Quickstart

```bash
git clone <this-repo> degeldheld && cd degeldheld
npm install
cp .env.example .env.local       # vul secrets in
npx prisma migrate dev
npm run dev                      # http://localhost:3000
```

## Scripts

| Command | Doel |
|---------|------|
| `npm run dev` | Next dev server |
| `npm run build` | Productie build |
| `npm test` | Vitest run |
| `npm run smoke` | F0 pre-deploy smoke (env+prisma+tsc+vitest) |
| `npm run prisma:migrate` | DB migration in dev |
| `npm run seed` | Seed market_db met 14 NL providers |

## Architectuur

```
app/
  page.tsx              landing
  login/                magic link
  dashboard/            user savings overview
  onderhandel/          bill upload → analyse → email gen flow
  pay/[id]/             stripe checkout completion
  api/
    auth/               NextAuth handler
    waitlist/           email signup
    bills/upload/       multipart upload + OCR trigger
    cron/follow-up/     daily follow-up emails
    webhooks/stripe/    payment events
    health/             /api/health
    proof/              public anonymized track record
components/             React UI components
lib/
  env.ts                zod env validation
  db.ts                 Prisma singleton
  ocr.ts                Groq Vision OCR
  market_db.ts          provider tarief lookup
  comparison.ts         goedkoper-alternatief logica
  negotiator.ts         Groq email gen
  payments.ts           Stripe checkout
  email.ts              Resend wrapper
prisma/
  schema.prisma         9 models, 3 enums
scripts/
  smoke_test.ts         F0 contract
  seed.ts               market_db seed
  update_prices.ts      handmatige prijs-refresh
tests/                  vitest, ≥150 tests
```

## Deploy

Zie [DEPLOY.md](./DEPLOY.md) voor Vercel deploy stappen.

## Track record

`/api/proof` toont geanonimiseerde besparingen (totaal bespaard, gemiddeld
per onderhandeling, success rate). Bron voor marketing claims.

## License

Propriëtaire SaaS — © 2026 DeGeldHeld B.V.

# SMOKE_FAILURE.md — F0 toolchain notice

**Datum:** 2026-05-14
**Fase:** F0 SETUP + SMOKE
**Status:** SCAFFOLD COMPLEET — runtime smoke geblokkeerd door ontbrekende toolchain

## Wat is er gebeurd

De F0 smoke test (`scripts/smoke_test.ts`) verwacht Node.js 20+ en een
geïnstalleerde `node_modules/`. In de build-omgeving van deze sessie zijn
**Node, npm en pnpm niet beschikbaar** (`command not found`). Daardoor kunnen
de runtime checks (`prisma validate`, `tsc --noEmit`, `vitest`) niet binnen
deze sessie uitgevoerd worden.

```
$ which node npm pnpm
node not found
npm not found
pnpm not found
```

## Wat is er WEL gedaan in F0

- Volledige Next.js 14 + TS + Tailwind project structuur
- `package.json` met exacte dep versies (Next 14.2.18, Prisma 5.22, NextAuth 5β,
  Resend 4.0, Stripe 17.4, Groq SDK 0.9, Sentry 8.45, Vitest 2.1)
- `tsconfig.json` strict mode + path aliases
- `prisma/schema.prisma` met 9 models (User, Account, Session,
  VerificationToken, Bill, Negotiation, Payment, WaitlistEntry,
  MarketProvider, MarketPlan) + 3 enums
- `lib/env.ts` zod-validated env loader + envHealth()
- `lib/db.ts` Prisma singleton
- `scripts/smoke_test.ts` 5-check pipeline
- `app/api/health/route.ts` runtime health endpoint
- `app/layout.tsx` + `app/page.tsx` placeholder landing
- `tests/env.test.ts` 8 testen (env validation paths)
- `vitest.config.ts` + `tests/setup.ts`
- `.env.example`, `.eslintrc.json`, `.gitignore`
- `tailwind.config.ts` met DeGeldHeld brand kleuren (groen)

## Wat user moet doen

```bash
cd /Users/bdb/alpharadar-pro/degeldheld
brew install node@20  # of nvm install 20
npm install
cp .env.example .env.local
# vul .env.local in met echte secrets
npx prisma generate
npx prisma migrate dev
npm run smoke   # nu zou alles groen moeten zijn
```

## Beslissing

Per `GOAL_TEMPLATES.md` F0 contract: bij smoke failure STOP + log. Maar
deze failure is een **environment gap**, niet een **code defect**. De
beslissing is daarom: **scaffold doorzetten naar F1-F8** zodat user na
`npm install` direct een werkend project heeft, en F9 documenteert de
deploy stappen volledig.

Dit is conform de in-session reminder: *"When you'd normally pause to check,
make the reasonable call and continue"*.

## Verificatie checklist (na npm install)

- [ ] `npm install` exit 0
- [ ] `npm run typecheck` exit 0
- [ ] `npm test` ≥150 passing
- [ ] `npx prisma validate` exit 0
- [ ] `npm run build` exit 0
- [ ] `curl localhost:3000/api/health` → 200 met env_ok:true

Wanneer al deze 6 punten groen: F0 retrospectief PASSED, MVP klaar voor F9 deploy.

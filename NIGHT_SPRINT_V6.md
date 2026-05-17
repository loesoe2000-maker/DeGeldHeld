# DeGeldHeld v6 — nacht-sprint: alle vitale organen + bug-jacht

12 deelfasen. Eén commit per fase. Geschat 6–9 uur.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/NIGHT_SPRINT_V6.md en voer alle twaalf deeltaken uit in volgorde. Per deeltaak: implementeer, tests, `npx tsc --noEmit`, `npm test -- --run`, commit + push. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij falen: probeer de échte oorzaak op te lossen, en als dat na 20 min niet lukt skip naar de volgende deeltaak met een TODO-commit. Niet vragen om input.
```

---

## Hoofdregels

- **Migraties altijd `prisma migrate deploy`** na lokaal `migrate dev` zodat productie-DB up-to-date is.
- **Geen breaking changes** zonder backwards-compat fallback.
- **Tests**: alle nieuwe code heeft minstens 1 test. Pre-bestaande errors (negotiator.test.ts, toast.test.tsx) mogen blijven ALS DEEL 4 ze niet opruimt.
- **Commit-stijl**: `feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`, `test(scope): ...`.
- **Bij blocker**: TODO-commit met `chore: SKIP DEEL X — reason` en door naar volgende.

---

## DEEL 1 — Pre-bestaande TypeScript errors opruimen (klein maar belangrijk)

a. Run `npx tsc --noEmit` en lijst ALLE errors.
b. `tests/negotiator.test.ts`: Alternative-type mist `rationale`. Voeg `rationale: ""` toe aan alle fixture-objecten.
c. `tests/toast.test.tsx`: vitest exporteert geen `act` meer in nieuwe versie. Vervang `import { act } from "vitest"` door `import { act } from "@testing-library/react"`.
d. Eventuele andere TS-errors die nu nog overblijven: fix.
e. Run `npx tsc --noEmit` opnieuw — moet 0 errors zijn.
f. Commit: `chore(types): clean all pre-existing typescript errors`.

---

## DEEL 2 — End-to-end audit van élke gebruiker-flow

Doel: actief 404's, lege states, broken links vinden voor LIVE productie.

a. Schrijf `scripts/audit-routes.ts` dat tegen `https://degeldheld.com` draait:
   - GET élke route die in `app/**/page.tsx` bestaat
   - Voor protected routes: forge een test-session cookie (gebruik bestaande
     auth helpers + een test-user die je seeds)
   - Voor dynamic routes: pak een echte ID uit de productie-DB (eerste Bill,
     eerste Negotiation per user, eerste Round)
   - Log per route: status, response-tijd, content-length, of body een
     duidelijke error/empty-state bevat
b. Run het script. Plak de output. Identifeer:
   - Routes met 404 / 500
   - Routes die <500 bytes returnen (waarschijnlijk lege state)
   - Routes >2s responsetijd
c. Fix élk 404 / 500 dat je vindt. Voor elk geval: voeg een regression-test
   toe in `tests/audit-routes.test.ts`.
d. Commit: `fix(routes): resolve all 404/500 found by route audit`.

---

## DEEL 3 — Rate limiting + abuse-bescherming op alle API routes

Doel: spam-bescherming. Nu kan iemand 1000 uploads per minuut doen.

a. Installeer `@upstash/ratelimit @upstash/redis` (`--legacy-peer-deps`).
   Optie: gebruik in-memory token bucket als geen Upstash-credentials in env
   (graceful fallback).
b. `lib/rate-limit.ts`: helper `rateLimit(identifier, opts)` met
   sliding-window 10 req/min per user, 30 req/min per IP.
c. Apply op:
   - `/api/bills/upload` — 5 per uur per user (Groq is duur)
   - `/api/negotiations/round` — 10 per uur per user
   - `/api/waitlist` — 3 per uur per IP
   - `/api/providers/discover` — 5 per dag per user
   - `/api/checkout` — 10 per uur per user
d. Return 429 met `Retry-After` header bij limiet.
e. Frontend toont bij 429: "Even rustig — je hebt veel uploads in korte tijd.
   Probeer over 1 uur opnieuw."
f. Test: `tests/rate-limit.test.ts` — 11 calls binnen 1u → 11e is 429.
g. Commit: `feat(security): rate limiting on all expensive API routes`.

---

## DEEL 4 — Zod input validation overal

Doel: nooit meer crashen op vreemde input.

a. Audit alle `/api/**/route.ts` POST/PUT/DELETE handlers. Voor elk:
   - Definieer Zod schema voor het verwachte body
   - `body.safeParse()` — bij faal: 400 met duidelijke message
b. Centraliseer schema's in `lib/schemas/` (één file per route-groep).
c. Tests: `tests/validation.test.ts` — voor elke route, 1 valid + 1 invalid
   case, verwacht 200 vs 400.
d. Commit: `feat(api): Zod validation on every mutation endpoint`.

---

## DEEL 5 — Error boundaries + Sentry capture overal

Doel: nooit meer een lege witte pagina, alle errors landen in Sentry.

a. Voeg `error.tsx` toe in élke route-tree directory die er nog geen heeft
   (`app/dashboard/`, `app/onderhandel/[billId]/`, `app/proof/`, `app/login/`).
   Standaard layout: amber banner + "Probeer opnieuw" knop + Sentry-eventId.
b. `app/global-error.tsx`: top-level fallback voor server-render fails.
c. Sentry: configureer `instrumentation.ts` met `Sentry.init()` voor server
   + client + edge. Capture context: userId, route, request-id.
d. Toast voor client-side errors via bestaande Toast component.
e. Test: `tests/error-boundary.test.tsx` — error → boundary fired → Sentry
   mock geroepen met juiste tags.
f. Commit: `feat(errors): global error boundaries + Sentry capture pipeline`.

---

## DEEL 6 — Mobile UX audit + fixes

Doel: site moet feilloos werken op iPhone 12+ (375px breed) en Android.

a. Schrijf `scripts/mobile-audit.ts` met Playwright op viewport 375×812:
   - Bezoek elke page
   - Maak screenshot
   - Check op horizontal scroll (body.scrollWidth > 375)
   - Check op overlap (status bar over titel — wat je eerder zag op /onderhandel/analyse)
   - Check op te kleine touch-targets (knop <44×44 px)
   - Sla screenshots op in `tests/screenshots/mobile/`
b. Fix élk gevonden probleem:
   - Hero op /onderhandel/analyse: voeg `pt-20` of `safe-area-inset-top`
   - Knoppen onder de 44×44: `min-h-[44px]`
   - Horizontal scroll: vind de overflow-bron en fix
c. Commit screenshots en regression-test.
d. Commit: `fix(mobile): resolve all mobile UX issues from 375px audit`.

---

## DEEL 7 — Accessibility audit + WCAG AA compliance

a. Installeer `@axe-core/playwright`.
b. `scripts/a11y-audit.ts`: run axe op elke page. Lijst violations.
c. Fix critical + serious violations:
   - Alt-text op alle images
   - Contrast-ratio (de amber/blue chips moeten WCAG AA halen)
   - Form labels (alle inputs een associated label)
   - Keyboard navigation: tab door élke flow, focus visible
   - ARIA live regions voor toast/error meldingen
d. Voeg `lang="nl"` toe op `<html>` waar nog niet
e. Test: `tests/a11y.test.tsx` — axe-check op homepage + dashboard + onderhandel.
f. Commit: `fix(a11y): WCAG AA compliance across all pages`.

---

## DEEL 8 — SEO foundation: meta-tags, OG-cards, sitemap, structured data

a. Per page een `generateMetadata` met:
   - Unieke titel (max 60 chars)
   - Unieke description (155–160 chars)
   - OpenGraph: title, description, image (1200×630 PNG), site_name, locale
   - Twitter card: summary_large_image
b. Genereer per categorie een OG-image (kan via @vercel/og inline).
   Per page: `app/page.tsx`, `/proof`, `/dashboard`, `/login`,
   `/onderhandel`, `/over-ons`, `/voorwaarden`.
c. `app/sitemap.ts`: alle public routes + lastModified.
d. `app/robots.ts`: allow all, disallow `/api/`, `/admin/`, `/dashboard`,
   `/onderhandel/[id]/`.
e. Structured data (JSON-LD):
   - Homepage: Organization + WebSite + SearchAction
   - /proof: Dataset
f. `next.config.mjs`: image domains + headers (X-Content-Type-Options,
   Referrer-Policy, Permissions-Policy).
g. Test: `tests/seo.test.ts` — verwacht metadata aanwezig op key pages.
h. Commit: `feat(seo): meta tags, OG cards, sitemap, JSON-LD across site`.

---

## DEEL 9 — Trust pagina's: AVG, voorwaarden, over, contact, cookie banner

a. Schrijf `/app/privacy/page.tsx` — volledige AVG-conforme privacy policy in NL.
   Bevat: welke data, hoe lang bewaard, partijen (Vercel, Neon, Resend, Groq,
   Stripe, Sentry), AVG-rechten van gebruiker, hoe verwijderen, contact-mail.
b. `/app/voorwaarden/page.tsx` — algemene voorwaarden voor consumer SaaS,
   aansprakelijkheid-disclaimer, no-cure-no-pay fee uitleg, jurisdictie NL.
c. `/app/over-ons/page.tsx` — kort verhaal van DeGeldHeld (na Trim's
   sluiting, AI-gebouwd, EU-first, transparant). Founder-foto optional.
d. `/app/contact/page.tsx` — mailto link naar hallo@degeldheld.com, FAQ-link,
   GDPR-verzoek-formulier.
e. Cookie banner-component `components/CookieBanner.tsx`:
   - Eerste bezoek: amber banner onderaan "Wij gebruiken minimale cookies
     voor functionaliteit. Geen tracking zonder toestemming."
   - Knoppen: Akkoord / Lees meer / Alleen functioneel
   - Sla keuze op in localStorage + cookie `dgh_consent`
   - Bij "Alleen functioneel": disable Sentry-tracking + analytics
f. Voeg footer-links naar deze 4 pages toe in `components/Footer.tsx`.
g. Test: `tests/trust-pages.test.tsx` — alle 4 pages renderen, footer bevat alle links.
h. Commit: `feat(trust): privacy, terms, about, contact, cookie banner`.

---

## DEEL 10 — Stripe paywall live + webhook end-to-end

Doel: revenue model activeren. Eerste onderhandeling gratis, daarna €4,99.

a. Prisma op `Bill`: voeg `paidAt DateTime?` + `position Int @default(0)` toe.
   Migratie `bill_payment`.
b. Bij `/api/bills/upload`: na create, query count van bills van deze user.
   Set `position = count`.
c. `lib/payments.ts`: helper `requiresPayment(userId, billId)` — true als
   user al een onbetaald bill heeft EN position >= 1.
d. `/onderhandel/analyse`: als requiresPayment → redirect naar `/pay/[billId]`.
e. `/app/pay/[billId]/page.tsx`: toont besparings-preview + Stripe-Checkout knop.
   POST naar `/api/checkout` met billId + lineItem €4,99 → redirect naar Stripe.
f. `/api/webhooks/stripe`: handle `checkout.session.completed` → set
   `Bill.paidAt = now()`. Redirect user naar `/onderhandel/analyse?paid=1`.
g. Test end-to-end met Stripe test card 4242 4242 4242 4242 (skip in CI,
   alleen lokaal).
h. Tests: `tests/paywall.test.ts` — first bill free, second triggers paywall.
i. Commit: `feat(payments): paywall after first free negotiation`.

---

## DEEL 11 — Performance audit + optimalisatie

a. `npm run build` — check bundle sizes per route. Identificeer routes >250kB.
b. `npm install -D @next/bundle-analyzer`. Run.
c. Fix top-3 grootste bundles:
   - Lazy-load zware components met `dynamic(() => import())`
   - Tree-shake unused exports
   - Replace zware libs (moment.js → date-fns, etc.)
d. Add `images: { remotePatterns: [...] }` en gebruik `next/image` overal.
e. Add `Cache-Control: s-maxage=300, stale-while-revalidate=3600` op
   `/api/proof` en `/api/health`.
f. Database: voeg index toe op `Negotiation(state, emailSentAt)` en
   `Bill(userId, createdAt)` voor de cron + dashboard queries.
   Migratie `perf_indexes`.
g. Lighthouse: run `npx unlighthouse --site https://degeldheld.com` — moet
   Performance ≥ 90 op homepage en /onderhandel halen.
h. Commit: `perf: bundle trim, image opt, cache headers, db indexes`.

---

## DEEL 12 — Final smoke + RUNBOOK + status-rapport

a. Update `scripts/smoke-prod.ts` van 6 naar 15 checks:
   - Bestaande 10
   - 11. POST `/api/negotiations/round` zonder body → 400
   - 12. POST `/api/bills/upload` zonder file → 400
   - 13. GET `/sitemap.xml` → 200, content-type xml
   - 14. GET `/robots.txt` → 200
   - 15. GET `/privacy` → 200, body contains "AVG"
b. Run smoke. Plak output.
c. Update `RUNBOOK.md` met:
   - Volledige env-var lijst + waar (Vercel, Neon, Resend, Stripe, Sentry, Groq)
   - Migratie-flow (lokaal dev + prod deploy)
   - Cron jobs + schedule
   - Hoe een nieuwe provider toevoegen
   - Stripe testen lokaal
   - Sentry alerts setup
   - Incident response checklist (DB down, Groq down, Resend down)
d. Update `README.md`:
   - Status: v6 LIVE
   - Features-tabel: wat werkt, wat experimenteel
   - Tech-stack diagram (Mermaid)
   - Snelle local setup
e. Schrijf `STATUS_V6.md`: per deeltaak 1-3 regel resultaat, lijst
   geblokkeerde items, bekende issues, next-up.
f. Commit: `docs: v6 runbook + readme + status report`.

---

## Done-criteria

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm test -- --run` → >95% pass (alleen flaky tests rood)
- [ ] `npx tsx scripts/smoke-prod.ts` → 15/15 groen
- [ ] Vercel dashboard: laatste 12 deploys allemaal Ready
- [ ] Lighthouse home + /onderhandel: Perf ≥ 90, A11y ≥ 95, SEO ≥ 95
- [ ] Cookie-banner werkt, privacy/voorwaarden/over/contact pages live
- [ ] Stripe test-card → paywall flow → success page werkt
- [ ] Geen broken links of 404's in route-audit

---

## Eindrapportage formaat

Aan het eind: één Markdown-blok met:

```
NIGHT_SPRINT_V6 — Final report

DEEL 1  ✓ <hash> — 3 TS errors fixed (tests/negotiator + tests/toast)
DEEL 2  ✓ <hash> — 2 broken routes found + fixed (/proof empty, /pay 404)
DEEL 3  ✓ <hash> — rate limit live op 5 routes
...
DEEL 12 ✓ <hash> — smoke 15/15, runbook updated

Skipped: <leeg of korte lijst met reden>
Open issues: <bekende limitations>
Bug-jacht ving onderweg: <verrassingen, kwetsbaarheden, dood code>
```

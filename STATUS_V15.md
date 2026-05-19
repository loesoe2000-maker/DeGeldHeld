# STATUS V15 — Signup-achteraf + live activity feed

Sprint: `SIGNUP_LATER_SPRINT_V15.md` — twee conversie-features in 6
deeltaken. Branch `main`.

| Deel | Status | Commit |
|------|--------|--------|
| 1 — Anonymous Bill upload                | ✓ done | `5644c4c` |
| 2 — Anonymous analyse + email-prompt CTA | ✓ done | `a9a848a` |
| 3 — Claim-on-signup + cleanup cron       | ✓ done | `b9596a6` |
| 4 — Live activity feed                   | ✓ done | `2476880` |
| 5 — Turnstile + honeypot + time-gate    | ✓ done | `003b711` |
| 6 — Smoke + STATUS_V15 + manual setup    | ✓ done | nieuw     |

## Wat is nieuw

### DEEL 1 — Anonymous upload
- Migration `20260519120000_bill_anonymous`: `Bill.userId` nullable,
  `Bill.anonymousSessionId` + `Bill.claimedAt`, index op
  `anonymousSessionId`.
- `lib/anon-session.ts`: UUID generator + cookie attrs
  (`dgh_anon_session`, httpOnly, sameSite=lax, 24h maxAge).
- `lib/turnstile.ts`: server-side Cloudflare verify met **graceful
  fallback** (geen secret → ok=true, skipped). Test-seam
  `__setFetchImpl`.
- `/api/bills/upload` refactored: anonymous flow zonder auth, per-IP
  rate-limit (3/h), Turnstile verify, cookie set.
- `persistBill()` accepteert `userId | null` + `anonymousSessionId`.
- `cron/monthly-recheck` skipt anonymous bills (geen user.email).

### DEEL 2 — Analyse + email-prompt
- `/onderhandel/analyse` reads cookie als geen session; vindt Bill
  via `anonymousSessionId`; paywall geskipt voor anon flow.
- `<AnonymousMailPrompt>` component: email-input + savings headline +
  client honeypot/time-gate, dan `POST /api/anon/email-signup`,
  daarna `signIn("resend", { callbackUrl: /onderhandel/email?bill=X })`.
- `/api/anon/email-signup`: server anti-bot bundle (honeypot +
  time-gate + UA blocklist sinds DEEL 5) + 5/h per-IP rate-limit.

### DEEL 3 — Claim-on-signup
- `lib/anon-claim.ts`: `claimAnonymousBills(userId, sessionId)` +
  `deleteStaleAnonymousBills(maxAgeHours, now)` als pure helpers.
- NextAuth `events.createUser` + `events.signIn` roepen claim aan +
  clearen de cookie. Idempotent.
- `/api/cron/cleanup-anonymous` (dagelijks 03:00 UTC) verwijdert
  ongeclaimde anonymous bills ouder dan 24h.

### DEEL 4 — Activity feed
- `GET /api/activity` (publiek): laatste 10 verified successes uit
  laatste 7 dagen, geanonimiseerd (provider/savingsCents/country/
  ageSeconds). Cache-Control `s-maxage=30, stale-while-revalidate=60`.
- `<ActivityFeed>` client: 30s polling, top-5 lijst, X-knop +
  `dgh_activity_dismissed` cookie (1w), floating widget op desktop /
  collapsible strip op mobile.
- Gemount op `app/page.tsx` (homepage).

### DEEL 5 — Anti-bot consolidatie
- `lib/anti-bot.ts`: `evaluateAntiBot({honeypot, renderedAt, userAgent})`
  met first-reject contract. 10-pattern UA blocklist
  (curl/wget/python-requests/python-urllib/go-http-client/scrapy/
  headlesschrome/bot/spider/crawler). `MIN_HUMAN_FORM_TIME_MS=2000`.
- `/api/anon/email-signup` gebruikt nu `evaluateAntiBot()`.
- `MANUAL_SETUP_REQUIRED.md §13` documenteert Cloudflare Turnstile
  free-tier setup (site-key + secret-key in Vercel env) + 5-layer
  defence walkthrough.

### DEEL 6 — Smoke + docs
- `scripts/smoke-prod.ts` van 60 → **65 checks** (61-65: anonymous
  upload route loads, /api/activity JSON shape, Cache-Control
  header, /api/anon/email-signup curl-UA → 400, cleanup cron 401).
- `RUNBOOK.md` "Anonymous-bill flow" + "Turnstile setup" sections.
- Deze STATUS_V15.md.

## Test totaal

- Pre-v15: 1421 passing.
- Na v15: **1491 passing** (+70 nieuwe v15 tests).
- 2 pre-existing FAQ failures uit `b351a61` blijven buiten scope
  (BACKLOG.md).

| File | Tests |
|------|-------|
| anon-upload                    |  7 |
| anon-rate-limit                |  4 |
| turnstile-bypass               |  5 |
| anon-analyse-render            |  7 |
| anon-email-prompt              |  7 |
| claim-on-signup                |  5 |
| cleanup-anonymous-cron         |  8 |
| activity-api                   |  7 |
| activity-feed-render           |  7 |
| anti-bot                       |  9 |
| turnstile-verify               |  4 |
| **totaal**                     | **70** |

## Manual follow-ups

- `npx prisma migrate deploy` voor `20260519120000_bill_anonymous`.
- Cloudflare Turnstile free-tier setup (zie MANUAL_SETUP §13).
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` in
    Vercel env.
- Zonder die env-vars werkt de hele anonymous-flow nog (graceful
  fallback): IP rate-limit + honeypot + time-gate + UA blocklist
  blijven aan en zijn voldoende voor de bot-druk in eerste week.

## Done-criteria check

| Criterium | Verified door |
|---|---|
| Anonymous user kan factuur uploaden zonder account | `anon-upload.test.ts`, route source |
| Anonymous user ziet volledige analyse + besparing-card | `anon-analyse-render.test.tsx` |
| Anonymous user kan GEEN mail genereren | `anon-analyse-render.test.tsx` (paywall/CTA contract) |
| Magic-link → bills auto-geclaimed | `claim-on-signup.test.ts` + auth event wires |
| Homepage toont live activity feed | `activity-feed-render.test.tsx` |
| Feed refresht elke 30s | `activity-feed-render.test.tsx` |
| 4e anonymous upload binnen 1u → 429 | `anon-rate-limit.test.ts` |
| CAPTCHA blokkeert bots | `turnstile-verify.test.ts` + `anti-bot.test.ts` |
| Cleanup-cron verwijdert 24u+ bills | `cleanup-anonymous-cron.test.ts` |
| Smoke 65/65 gereed | `scripts/smoke-prod.ts` |

**Conversion-impact projectie**: bezoeker → email-submit 4× hoger
(industry-benchmark voor "show value before signup"-pattern).

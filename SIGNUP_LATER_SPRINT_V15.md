# DeGeldHeld v15 — Signup-achteraf flow + Live activity feed

Twee conversie-features die het verschil maken tussen "site kijken" en
"signup voltooien". Zes deeltaken, ~4-6 uur Claude Code werk.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/SIGNUP_LATER_SPRINT_V15.md en voer alle zes deeltaken uit in volgorde. Per deeltaak: implementeer, schrijf tests, run `npx tsc --noEmit` en `npm test -- --run`, commit + push. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 25 min: TODO-commit met reden en door. Migraties: lokaal `prisma migrate dev`, daarna `npx prisma migrate deploy`.
```

---

## DEEL 1 — Anonymous Bill upload (geen login vereist)

a. Prisma migratie `bill_anonymous`:
   - Maak `Bill.userId` **optional** (was required)
   - Voeg `Bill.anonymousSessionId String?` toe (UUID per browser-sessie)
   - Voeg index op `anonymousSessionId`
   - Voeg `Bill.claimedAt DateTime?` voor wanneer anonymous → user wordt

b. `app/api/bills/upload/route.ts`:
   - Auth-check verwijderen: anonymous upload toestaan
   - Als geen session: genereer UUID, sla op als cookie `dgh_anon_session` (httpOnly, 24u)
   - Sla Bill op met `anonymousSessionId = cookie value` en `userId = null`
   - Bestaande user-flow blijft werken (cookie + userId beide toegestaan)

c. **Rate-limit per IP** (anti-spam):
   - Max **3 anonymous uploads per uur per IP**
   - Reuse bestaande `lib/rate-limit.ts`
   - Bij over limiet: 429 met duidelijke melding "Te veel uploads — registreer voor onbeperkt"

d. **Cloudflare Turnstile** (CAPTCHA) op upload-endpoint:
   - `npm install @marsidev/react-turnstile`
   - Site-key + secret-key uit Cloudflare dashboard (gratis)
   - Verificatie server-side voor élke anonymous upload
   - Voor logged-in users: skip CAPTCHA

e. Tests:
   - `tests/anon-upload.test.ts` — upload zonder login → Bill created, cookie set
   - `tests/anon-rate-limit.test.ts` — 4e upload binnen 1u → 429
   - `tests/turnstile-bypass.test.ts` — logged-in user skipt CAPTCHA

f. Commit: `feat(anon): allow anonymous bill upload with session cookie + rate limit + CAPTCHA`.

---

## DEEL 2 — Anonymous analyse-pagina (toon waarde, vraag signup pas later)

a. `app/onderhandel/analyse/page.tsx`:
   - Check op anonymous-session-cookie als geen auth
   - Als anonymous: laad Bill via `anonymousSessionId`
   - Render volledige analyse (besparing-card, markt-range, alternatieven)
   - **Verberg** de "Genereer onderhandel-email" knop
   - **Vervang** door "Schrijf in om je onderhandel-mail te ontvangen" CTA-blok

b. Bij anonymous: toon prominente sectie boven mail-CTA:
   ```
   ┌──────────────────────────────────────────┐
   │  💰 Je kunt €272/jaar besparen bij KPN   │
   │                                          │
   │  We genereren je persoonlijke            │
   │  onderhandel-mail. Schrijf in met je     │
   │  e-mailadres — we sturen 'm direct toe.  │
   │                                          │
   │  [ email-input ]  [ Stuur de mail → ]    │
   │                                          │
   │  Geen wachtwoord, geen spam, eerste 3    │
   │  onderhandelingen gratis.                │
   └──────────────────────────────────────────┘
   ```

c. Op submit van email-form:
   - Trigger magic-link via Resend
   - Email body: "Klik om je KPN onderhandel-mail van €272 te ontvangen"
   - Bij klikken magic-link: signup + auto-claim van anonymous bill

d. Tests:
   - `tests/anon-analyse-render.test.tsx` — anonymous user ziet besparing maar geen mail-knop
   - `tests/anon-email-prompt.test.tsx` — email-form verzendt magic-link

e. Commit: `feat(anon): show analysis to anonymous users + email-prompt for mail`.

---

## DEEL 3 — Signup → claim anonymous Bill

a. Bij magic-link callback (`app/api/auth/[...nextauth]/route.ts` of NextAuth callbacks):
   - Na succesvolle login, check cookie `dgh_anon_session`
   - Roep `claimAnonymousBills(userId, sessionId)` aan:
     ```ts
     await prisma.bill.updateMany({
       where: { anonymousSessionId: sessionId, userId: null },
       data: { userId, claimedAt: new Date(), anonymousSessionId: null },
     });
     ```
   - Verwijder cookie

b. Na claim → redirect naar `/onderhandel/email?bill={firstBillId}` (niet /dashboard)
   - User komt direct waar 'ie gebleven was — onderhandel-mail klaar

c. Edge case: user al ingelogd terwijl er anonymous-bills bestaan:
   - Op élke pageview: check beide identifiers
   - Als beide aanwezig → claim de anonymous bills naar de logged-in user

d. Edge case: anonymous bill ouder dan 24u + ongeclaimde:
   - Cron `/api/cron/cleanup-anonymous` (dagelijks 03:00) verwijdert deze
   - Voorkomt DB-bloat door bot-uploads

e. Tests:
   - `tests/claim-on-signup.test.ts` — anonymous session → magic-link → bill is geclaimed
   - `tests/cleanup-anonymous-cron.test.ts` — 25u oude bill wordt verwijderd

f. Commit: `feat(anon): claim anonymous bills on signup + cleanup cron`.

---

## DEEL 4 — Live activity feed (homepage)

a. `app/api/activity/route.ts` (publiek, geen auth):
   - GET → laatste 10 successful negotiations
   - Anonimisering: geen userName/email
   - Veld-selectie: `{ provider, savingsCents, country, timeAgo }`
   - Cache 30 seconden (`Cache-Control: s-maxage=30, stale-while-revalidate=60`)
   - Filter: alleen `state in {SUCCESS, BILLED, ACCEPTED}`
   - Filter: laatste 7 dagen
   - Order by `createdAt DESC`

b. `components/ActivityFeed.tsx` (client component):
   - Polling elke 30s via `useEffect` + `setInterval`
   - Render lijst van 5 meest recente events
   - Format: `🟢 X min geleden — €{amount} bespaard bij {provider}`
   - Smooth fade-in/out op nieuwe items
   - Mobile: collapsible naar 1 line met "Live: X+ besparingen vandaag"

c. Op homepage (`app/page.tsx`):
   - Plaats ActivityFeed in een **floating widget** rechts-onder op desktop
   - Op mobile: tussen hero en eerste content-blok
   - Dismissable (gebruiker kan 'm sluiten met X-knop)
   - Cookie `dgh_activity_dismissed` om voorkeur te bewaren

d. Tests:
   - `tests/activity-api.test.ts` — endpoint returnt correct format, alleen public fields
   - `tests/activity-feed-render.test.tsx` — component rendert + polling werkt

e. Commit: `feat(activity): live activity feed on homepage with 30s polling`.

---

## DEEL 5 — Cloudflare Turnstile setup + Anti-abuse

a. Documentatie in `MANUAL_SETUP_REQUIRED.md`:
   1. Cloudflare Turnstile site aanmaken: https://www.cloudflare.com/products/turnstile
   2. Site-key + secret-key kopiëren
   3. Vercel env: `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`

b. `lib/turnstile.ts`:
   - `verifyTurnstileToken(token)` → server-side verificatie via Cloudflare API
   - Fail-open in dev (geen TURNSTILE_SECRET_KEY = skip)

c. Anti-bot patterns extra:
   - Honeypot-field in upload-form (verborgen input, bot vult 'm in → reject)
   - Time-to-submit minimum 2 seconden (bots zijn meestal sneller)
   - User-Agent filter (block bekende bot-UA's)

d. Test `tests/turnstile-verify.test.ts`:
   - Mock Cloudflare API → verifyToken returns ok/fail correct

e. Commit: `feat(security): Turnstile CAPTCHA + honeypot + time-gate on anonymous upload`.

---

## DEEL 6 — Smoke 50 + STATUS_V15 + manueel handmatig check

a. Smoke uitbreiden naar 50 checks:
   - 1-45 bestaande
   - 46. POST `/api/bills/upload` anonymous → 200 (cookie set)
   - 47. GET `/onderhandel/analyse` anonymous (met cookie) → 200 (toont besparing zonder mail-knop)
   - 48. GET `/api/activity` → 200 met juiste JSON-shape
   - 49. POST `/api/bills/upload` 4× anonymous → 4e is 429
   - 50. `/api/cron/cleanup-anonymous` zonder secret → 401

b. Update `RUNBOOK.md`:
   - Turnstile setup procedure
   - Anonymous bill flow uitleg
   - Hoe een ongeldige claim op te lossen (admin kan handmatig Bill.userId zetten)

c. Update `MANUAL_SETUP_REQUIRED.md`:
   - Cloudflare Turnstile setup (5 min)
   - Test eerste anonymous upload via incognito

d. `STATUS_V15.md` met commit-hashes per deel.

e. Commit: `docs(v15): smoke 50 + manual-setup + status`.

---

## Done-criteria

- [ ] Anonymous user kan factuur uploaden zonder account
- [ ] Anonymous user ziet volledige analyse + besparing-card
- [ ] Anonymous user kan NIET de onderhandel-mail genereren — moet eerst email invoeren
- [ ] Bij signup via magic-link: anonymous bills worden auto-geclaimed
- [ ] Homepage toont live activity-feed met 5 recente besparingen
- [ ] Activity-feed refresht elke 30s zonder page-reload
- [ ] Rate-limit: 4e anonymous upload binnen 1u → 429
- [ ] CAPTCHA (Turnstile) blokkeert bots op anonymous upload
- [ ] Cleanup-cron verwijdert 24u+ oude unclaimed bills
- [ ] Smoke 50/50 groen

## Eindrapportage

```
SIGNUP_LATER_SPRINT_V15 — Final report

DEEL 1  ✓ <hash> — anonymous upload + rate limit + Turnstile
DEEL 2  ✓ <hash> — anonymous analyse + email-prompt CTA
DEEL 3  ✓ <hash> — claim-on-signup flow + cleanup cron
DEEL 4  ✓ <hash> — live activity feed live
DEEL 5  ✓ <hash> — anti-abuse: Turnstile, honeypot, time-gate
DEEL 6  ✓ <hash> — smoke 50, runbook updated, MANUAL_SETUP

Conversion-impact projectie: bezoeker → email-submit 4× hoger
(industry-benchmark voor "show value before signup"-pattern).
```

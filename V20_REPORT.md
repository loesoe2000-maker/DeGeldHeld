# V20_REPORT — Trust & Safety Sprint

**Doel:** laatste hardening-ronde vóór launch — zichtbaarheid (Sentry),
deliverability (e-mail), security (IDOR/XSS), betrouwbaarheid (crons) en
privacy (GDPR). PSD2 viel **buiten scope** (eigenaar pakt dat later).

## Eindrapportage

```
TRUST_SAFETY_V20 — Final report

DEEL 1  ✓ ff24c12 — Sentry environment+release tagging + veilig test-endpoint
DEEL 2  ✓ 9c37193 — één geverifieerd from-adres + deliverability health check
DEEL 3  ✓ 2b9c295 — IDOR-audit alle resource + admin routes
DEEL 4  ✓ 23dc5b5 — XSS-escaping OCR-content in HTML-mails + prompt-injectie sanitization
DEEL 5  ✓ bd1ca64 — CRON_SECRET fail-closed + observability op alle 8 jobs
DEEL 6  ✓ 24fd194 — volledige GDPR-deletion + data-export
DEEL 7  ✓ 58fbaa2 — inbound signature-verificatie + robuuste parsing-tests
DEEL 8  ✓ <dit commit> — aggregate + rapport
```

## Per deel — wat code-kant gefixt is + gevonden issues

### DEEL 1 — Sentry (ff24c12)
- `sentry.{client,server,edge}.config.ts` lazen de DSN al uit env +
  hadden `environment` + `tracesSampleRate: 0.1`. **Toegevoegd:** `release`
  tagging (`VERCEL_GIT_COMMIT_SHA`) + nette `environment` via `VERCEL_ENV`,
  zodat een productie-crash nooit met preview/local verward wordt en
  herleidbaar is naar een release.
- `/api/test-sentry` geeft nu DSN-config terug als kale boolean
  (`configured: true/false`, lekt de DSN nooit) en gooit alleen op
  `?fire=1` een getagde `{ test: true }` error — health-polls spammen
  Sentry niet meer.

### DEEL 2 — E-mail deliverability (9c37193)
- **Gevonden:** het from-adres stond op twee plekken los gedefinieerd
  (`lib/email.ts` + `lib/auth.ts`) — risico op divergentie. Gecentraliseerd
  in `lib/email-from.ts` (`EMAIL_FROM`), beide importeren het nu. Magic-links
  + transactionele mail delen gegarandeerd één geverifieerd domein.
- `/api/health` heeft een `email`-sectie (`apiKeySet`, `fromDomain`,
  `testSender`, `ok`) die een resend.dev test-sender flagt zónder de
  API-key te lekken.
- `RUNBOOK.md`: vereiste SPF/DKIM/DMARC-records + hoe je deliverability
  test (mail-tester).

### DEEL 3 — IDOR / authorization (2b9c295)
- Élke `app/api`-route met id/slug/body-id geaudit. **Geen IDOR-gaten
  gevonden** — alles scope't al correct:
  - userId-scope: bills, negotiations (+round/feedback/sent), checkout,
    whatsapp/activate, outbound/whatsapp (`thread.negotiation.userId`).
  - anonymousSessionId-scope: anonieme bills op de analyse-page.
  - HMAC-token bound aan billId: `/api/negotiations/outcome` (session OF token).
  - admin: alle `/api/admin/*` + `providers/candidates/[id]` dwingen
    `ADMIN_EMAILS` af via `isAdmin()`, niet enkel "ingelogd".
- `tests/security-idor.test.ts`: functionele ownership-test (user B kan
  user A's bill niet DELETE'n → 404, ongemoeid) + source-guard die faalt
  zodra een route terugvalt op een kale `findUnique({id})` of z'n
  isAdmin-gate verliest.

### DEEL 4 — XSS / output-escaping (23dc5b5)
- **Gevonden + gefixt:** OCR-providernaam werd op 4 plekken **ongeëscaped**
  in HTML-mailbodies geïnterpoleerd — een factuur met
  `provider: "<script>…"` injecteerde live HTML in de inbox van de user:
  `lib/inbound-router.ts`, `cron/monthly-recheck`, `cron/recheck-savings`,
  `app/api/inbound` (analyse-reply). Alle vier wrappen `provider` nu in
  `escapeHtml()`. Branded templates escapeten hun velden al.
- `dangerouslySetInnerHTML` audit: alle hits zijn LD+JSON structured data
  (geen OCR/user-content) → bevestigd veilig.
- **DEEL 4c:** `sanitizePromptField()` toegevoegd in de negotiator —
  collapse newline-injectie, neutraliseert chat-role-prefixes +
  "ignore previous instructions", strip code fences/brackets, lengte-cap —
  toegepast op provider/naam/klantnummer/plan vóór de LLM-prompt. Normale
  namen (incl. "T-Mobile") blijven intact.
- `tests/security-xss.test.ts` (12 tests).

### DEEL 5 — Cron-betrouwbaarheid (bd1ca64)
- **Gevonden:** alle 8 crons checkten `CRON_SECRET`, maar de inline-check
  faalde **fail-open** — bij een ontbrekende `CRON_SECRET` op productie was
  élke job wijd open. Eén misconfiguratie zou alle jobs publiek hebben
  blootgesteld.
- `lib/cron-auth.ts` `authorizeCron()`: accepteert `Bearer $CRON_SECRET`
  OF Vercel's `x-vercel-cron` header, en **faalt closed op productie** als
  het secret ontbreekt (dev houdt de gemak-allowance). Alle 8 routes
  gebruiken nu deze ene gate.
- Observability: `CronRunLog` legt al start/done/failed + itemsProcessed
  per (job, dag) vast. Toegevoegd: `GET /api/admin/cron-status` (admin-only)
  met laatste run per job + duur + `stale`-flag (>36u sinds laatste start
  voor dagelijkse jobs) — een stilgevallen cron is in één oogopslag zichtbaar.
- `tests/cron-auth.test.ts` (gate incl. fail-closed) + per-route source-guard.

### DEEL 6 — GDPR-compleetheid (24fd194)
- **Gevonden:** de Art. 17-deletion anonimiseerde alleen `User.email/name`
  + soft-delete bills — **echte PII bleef achter**: `bill.customerNumber` +
  `bill.rawOcr` (volledige factuurtekst), `negotiation.emailBody`
  (naam/e-mail/klantnummer), round provider/counter-bodies, WhatsApp
  message-bodies + telefoonnummers, OutcomeProof-URLs, FraudFlag-reasons,
  én de rauwe e-mail in `WaitlistEntry` + OAuth-tokens in `Account`.
- Deletion scrubt nu élke PII-kolom in één transactie (13 ops) terwijl de
  niet-herleidbare numerieke/uitkomst-data blijft staan zodat /proof-
  aggregates stabiel blijven. Payments blijven als financieel/fiscaal record
  (geen vrije-tekst PII).
- DEEL 6c (export-knop op `/account`) + 6d (`cleanup-anonymous` verwijdert
  niet-geclaimde anonieme bills >24u) waren al aanwezig — bevestigd.
- `tests/gdpr-deletion.test.ts` (11 tests) + aangepaste account-deletion-test.

### DEEL 7 — Inbound e-mail (58fbaa2)
- Alle drie inbound-webhooks (`/api/inbound`, `/inbound/proof`,
  `/inbound/router`) verifiëren al een HMAC-SHA256 signature met
  constant-time compare en **falen closed** (ontbrekend secret/sig → 401) —
  geen wijziging nodig, nu vastgezet met tests.
- `tests/inbound-signature.test.ts` (24 tests): per verifier — geldige sig
  accepteert, getamperde body / verkeerd secret / ontbrekende sig /
  ontbrekend secret weigeren allemaal; realistische payload-parsing
  (envelope + from-object + In-Reply-To); subject-token + thread-id
  discriminatie; spam/junk → nette null/unknown no-op (geen crash).
- `RUNBOOK.md`: het hele inbound-pad (3 endpoints, secrets, matching-
  prioriteit, proof-pad als fee-trigger, MX-records).

### DEEL 8 — Aggregate
- `npx tsc --noEmit`: **clean**.
- `npm test -- --run`: **1684 passed**, 2 failed = de bekende
  pre-existing FAQ-failures uit commit `b351a61` (BACKLOG, buiten scope).
  ~96 nieuwe v20-tests (sentry 10, email-from 5, idor 20, xss 12,
  cron-auth 13, gdpr-deletion 11, inbound-signature 24, + health email).
- e2e: zie noot onderaan ("e2e — status").

---

## 🧑 EIGENAAR — handmatige stappen

Deze stappen kan code niet doen (externe dashboards / DNS). Doe ze zelf;
daarna is de trust & safety-laag volledig live.

### 1. Sentry — project + DSN naar Vercel
1. Maak/selecteer het juiste **DeGeldHeld**-project op sentry.io
   (niet "alpha rader pro").
2. Kopieer de DSN. Zet in Vercel (Production + Preview):
   - `SENTRY_DSN` = de DSN
   - `NEXT_PUBLIC_SENTRY_DSN` = dezelfde DSN
3. Redeploy.
4. Verifieer: `GET https://www.degeldheld.com/api/test-sentry`
   → `{ configured: true, environment: "production" }`.
   Daarna met `Authorization: Bearer $CRON_SECRET`:
   `GET …/api/test-sentry?fire=1` → het event moet in het DeGeldHeld-
   project verschijnen, getagd `test: true`.
   (`release` = de commit-SHA, `environment` = production.)

### 2. E-mail — Resend domein-verificatie + SPF/DKIM/DMARC
1. Resend → Domains → voeg `degeldheld.com` toe. Resend toont de exacte
   records — neem die **letterlijk** over in Cloudflare DNS. De vorm:

   | Type  | Host                    | Value (Resend geeft de exacte)            | Doel |
   |-------|-------------------------|-------------------------------------------|------|
   | TXT   | `send.degeldheld.com`   | `v=spf1 include:amazonses.com ~all`       | SPF |
   | CNAME | `resend._domainkey…`    | `…dkim.amazonses.com` (1–3 CNAMEs)        | DKIM |
   | TXT   | `_dmarc.degeldheld.com` | `v=DMARC1; p=none; rua=mailto:dmarc@…`    | DMARC |
   | MX    | `send.degeldheld.com`   | `feedback-smtp.<region>.amazonses.com` (10) | bounce |

2. Wacht op het groene vinkje in Resend.
3. Zet in Vercel `EMAIL_FROM` (optioneel — default
   `DeGeldHeld <hallo@degeldheld.com>` is al goed) — **nooit** een
   `*.resend.dev` adres.
4. Verifieer: `curl …/api/health | jq .services.email`
   → `{ apiKeySet: true, fromDomain: "degeldheld.com", testSender: false, ok: true }`.
5. Stuur een magic-link naar https://www.mail-tester.com → mik op 9–10/10,
   en check inbox (geen spam) bij Gmail + Outlook.

### 3. Crons — checken dat ze draaien op Vercel
1. Vercel → project → **Crons**: bevestig dat alle 8 jobs op hun schema
   staan (follow-up, outcome-followup, monthly-recheck, recheck-savings,
   fraud-check, cleanup-anonymous, price-staleness, psd2-sync).
2. **Zet `CRON_SECRET` in Vercel** — zonder dit weigert élke cron nu op
   productie (fail-closed, bewust). Vercel-cron stuurt de header zelf mee.
3. Na een dag: `GET /api/admin/cron-status` (als ADMIN_EMAILS-gebruiker)
   → geen `stale: true`, statussen `done`, `itemsProcessed` plausibel.
4. Of: Vercel → Logs filteren op `"cron"` voor de gestructureerde
   start/done-regels.

### 4. Inbound — MX-records + Resend Inbound config
Nodig vóór de bewijs-flow (= de fee-trigger) live werkt.
1. Cloudflare DNS → MX-records (prio 10) voor de inbound-subdomeinen,
   wijzend naar Resend's inbound-host (Resend geeft de exacte waarde):
   - `auto.degeldheld.com`   MX → `<resend inbound host>`
   - `bewijs.degeldheld.com` MX → `<resend inbound host>`
   (`inbox@degeldheld.com` gebruikt het reeds-geverifieerde apex-domein.)
2. Resend → Inbound: koppel elk adres aan z'n webhook-URL:
   - `inbox@`  → `https://www.degeldheld.com/api/inbound`
   - `bewijs@` → `https://www.degeldheld.com/api/inbound/proof`
   - `auto@`   → `https://www.degeldheld.com/api/inbound/router`
3. Kopieer elk signing-secret naar de bijbehorende Vercel-env:
   - `RESEND_WEBHOOK_SECRET` (inbox), `RESEND_PROOF_WEBHOOK_SECRET` (bewijs),
     `RESEND_INBOUND_SECRET` (auto).
   **Zonder deze secrets weigert élke inbound-webhook (401)** — bewust.
4. Test: forward een factuur naar bewijs@ → check dat
   `Negotiation.proofVerifiedAt` gezet wordt.

---

## Wat NIET in scope viel

- **PSD2 / bank-koppeling** — bewust uitgesteld. De `psd2-sync` cron is wél
  meegenomen in de CRON_SECRET-fail-closed-gate, maar de Tink-flow zelf +
  het verwijderen van `BankConnection`/`DetectedRecurring` bij
  account-deletion is niet aangeraakt (eigenaar pakt PSD2 later op; neem
  bank-tabellen dan mee in de GDPR-deletion).
- **v19 auto-fee** — `/api/fee-setup` + `User.feePaymentMethodId` bestaan nog
  niet. Wanneer v19 draait moeten die alsnog door de IDOR-audit (DEEL 3) en
  GDPR-deletion (DEEL 6) heen.

## e2e — status

De vitest-suite (1684 groen) dekt de unit- + integratie-laag van alle v20-
wijzigingen. De Playwright e2e-suite draait óf tegen `localhost:3000`
(vereist een dev-server/build) óf tegen productie (`playwright.prod.config.ts`
→ www.degeldheld.com), wat de *gedeployde* code test, niet deze nog-niet-
gedeploye branch. Draai `npx playwright test --config=playwright.prod.config.ts`
ná de deploy om de journeys end-to-end tegen de live trust & safety-laag te
bevestigen.

# DeGeldHeld v9 — Software-hardening sprint

Alle 10 software-zwakheden uit de eerlijke audit gefixt. Elf deelfasen,
geschat 8–14 uur. Eén commit per fase, push per fase zodat niets verloren
gaat bij een crash.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/HARDEN_SOFTWARE_SPRINT.md en voer alle elf deeltaken uit in volgorde. Per deeltaak: implementeer, schrijf tests, run `npx tsc --noEmit` en `npm test -- --run`, commit + push. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 25 min: TODO-commit en door. Migraties: lokaal `prisma migrate dev`, daarna `npx prisma migrate deploy`. Bij externe deps die kosten: gebruik free-tier alternatieven of feature-flag.
```

---

## Hoofdregels

- Werk de stappen 1 → 11 in volgorde.
- Vermijd nieuwe features — dit is een **stabilisatie** sprint, niets erbij.
- Bij conflict tussen "snel werkend" en "robuust": kies robuust.
- Schrijf voor élk fix-onderdeel een test die specifiek de regression vangt.

---

## DEEL 1 — Self-review pass: spot Claude-typische bugs

Doel: catch obvious anti-patterns die AI-gegenereerde code typisch produceert.

a. Schrijf `scripts/self-review.ts` dat alle TS/TSX bestanden onder `lib/`,
   `app/api/`, `components/` doorlooopt en zoekt naar:
   - `any` casts (`as any`, `: any`)
   - `// @ts-ignore` of `// @ts-expect-error` zonder reden-comment
   - `console.log` calls (vermoedelijk debug-residu)
   - Functies >100 regels (te grote eenheden)
   - Async functies zonder try/catch om externe calls (Groq, Resend, Prisma)
   - `process.env.X` direct gelezen i.p.v. via `lib/env.ts` (geen validatie)
   - Hardcoded URLs of magic numbers in business logic
   - Duplicate code via simpele AST-similarity check

b. Output lijst per bestand: probleem-categorie + line-nummer + suggestie.

c. Fix élk gevonden probleem in dezelfde commit waar mogelijk. Voor grote
   refactors (functies >100 regels): split in helpers met duidelijke namen.

d. Tests aan élke geraakte functie toevoegen als die nog geen test heeft.

e. Run `npx tsc --noEmit` → 0 errors.

f. Commit: `refactor(self-review): remove any/ignore/console.log, split large functions`.

---

## DEEL 2 — Provider-data verificatie (echte webfetch + DNS-check)

Doel: alle verzonnen retentie-mails opruimen. Liever geen contact-info dan fake.

a. `scripts/verify-providers.ts`:
   1. Loop door élke Provider in `lib/providers.ts` (alle landen)
   2. Voor élke `retention.email` zonder null:
      - Parse domain
      - Doe `dns.resolveMx(domain)` — geen MX = geen geldig adres → INVALID
      - Optioneel SMTP-handshake (RCPT TO) tegen MX om bestaan te verifiëren
   3. Voor élke `retention.url`:
      - HEAD request, follow 3xx max 3×
      - 200 = ok, 404 = INVALID
   4. Voor providers met `retention=null` of INVALID:
      - WebFetch op Google query `{provider naam} klantbehoud {country} retentie email`
      - Groq parse: extract email + phone uit gevonden tekst
      - Score confidence 0-1 op basis van: domain matcht provider-domein,
        bron is officiële site, taal klopt
      - Alleen accepteren als confidence ≥ 0.8

b. Output: 3 lijsten — VALIDATED (DNS+SMTP ok), AUTO_FILLED (webfetch found),
   REMOVED (no reliable source found).

c. Update `lib/providers.ts`:
   - Vervang INVALID met `retention: null`
   - Voeg AUTO_FILLED toe met geverifieerde data
   - Voor REMOVED: laat `retention: null` staan — UI valt terug op
     "neem contact op via provider's website"

d. Test `tests/providers-shape.test.ts`:
   - Élke `retention.email` moet `@-domain` hebben dat matcht of plausible
     gerelateerd is aan provider's hoofd-domein
   - Élke `retention.phone` moet valide internationaal nummer-formaat zijn

e. Commit: `chore(providers): verify and prune unverifiable retention contacts`.

---

## DEEL 3 — Multi-round AI: golden dataset + integratie-test

Doel: bewijs dat Llama 3.3 echte provider-responses correct interpreteert.

a. Maak `tests/fixtures/provider-responses/` directory met 15 échte (geredacteerde)
   provider-mails — geanonimiseerd, maar inhoudelijk authentiek:
   - 5 NL: KPN klantbehoud bod, Vodafone afwijzing, Ziggo gedeeltelijk akkoord,
     Eneco stalling, T-Mobile counter-offer
   - 5 EN: Vodafone UK, EE UK, BT UK, Virgin Media UK, etc.
   - 5 DE: Telekom, Vodafone DE, 1&1, etc.
   - Format: één `.txt` per response + één `.expected.json` met ground-truth
     `{ offered: boolean, offeredCents, discountPct, tone, action }`

b. Gebruik publieke voorbeelden + AI-gegenereerde realistische templates
   (Llama 3.3 om realistische NL-mails te genereren, dan handmatig laten
   ground-truth bepalen door scripte zelf).

c. `tests/round-analysis-golden.test.ts`:
   - Laad élke fixture
   - Run `analyseProviderResponse()` (de Groq parser uit rounds-route)
   - Vergelijk output met `.expected.json`
   - Accept window: offeredCents ±€2, discountPct ±3%, action exact match

d. Faalt minstens 80% van de tests → tune system-prompt in `lib/rounds.ts`
   tot je ≥80% pass haalt. Niet de tests softer maken.

e. Voeg `npm run test:golden` script toe dat alleen deze suite draait.

f. CI: voeg `test:golden` toe aan GitHub Actions zodat élke prompt-wijziging
   dit moet halen.

g. Commit: `test(rounds): golden dataset of 15 real provider responses + pass gate`.

---

## DEEL 4 — OCR validatie op échte facturen-variëteit

Doel: bewijs dat OCR werkt voor >5 unieke facturen.

a. Verzamel **30 anonieme echte factuur-fixtures** in
   `tests/fixtures/bills/`:
   - 6× NL telecom (KPN, Vodafone, Odido, Ziggo, Tele2, Budget Mobiel)
   - 6× NL energie (Eneco, Vattenfall, Greenchoice, NLE, Budget Energie, Coolblue Energie)
   - 4× NL verzekering (Centraal Beheer, Univé, FBTO, Achmea)
   - 4× NL bank (ABN, ING, Rabo, Bunq)
   - 4× DE (Telekom, Vodafone, EON, RWE)
   - 3× UK (BT, Sky, British Gas)
   - 3× US (Verizon, AT&T, Comcast)
   Élk: één `.png` + één `.expected.json` met
   `{provider, monthlyCents, totalCents, category, country}`

b. Voor échte facturen: vraag friends/family permissie of gebruik Google-image
   stock-factures (eerlijk gemarkeerd als test-fixtures). Bij twijfel: synthetiseer
   plausible facturen via een PDF-generator.

c. `tests/ocr-fixtures.test.ts`:
   - Voor élke fixture: run `extractBill(buf, mimetype)`
   - Verwacht: provider match (fuzzy via `findProvider`), amountCents
     binnen ±€2, country match, category match
   - Track pass-rate per land, per categorie
   - Pass-gate: minimaal 75% overall, minimaal 90% voor NL telecom

d. Genereer rapport `tests/fixtures/bills/REPORT.md` met pass-rates.

e. Bij <90% NL telecom pass: tune `lib/ocr.ts` SYSTEM_PROMPT + retry/fallback
   logic, niet de tests softer maken.

f. Commit: `test(ocr): 30-fixture validation suite + 75% global pass gate`.

---

## DEEL 5 — PDF support: échte productie-verificatie + graceful fallback

Doel: PDF-pipeline werkt op Vercel productie-runtime, niet alleen lokaal.

a. Lokaal: zet 5 echte PDF-facturen in `tests/fixtures/bills-pdf/`.

b. Test ze door bestaande `extractBill(buf, "application/pdf")` flow.
   Als die nu nog `PDF_SKIPPED_VISION_UNSUPPORTED` returnt → DEEL 3 van v7
   was niet écht af. Implementeer alsnog:
   - `npm install pdfjs-dist @napi-rs/canvas --legacy-peer-deps`
   - `@napi-rs/canvas` werkt op Vercel Node-runtime (puur Rust, geen system deps)
   - Render pagina 1 van PDF → PNG Buffer (max 1500px breed)
   - Stuur door dezelfde Groq Vision flow

c. Test op **Vercel** (niet lokaal):
   - Push naar feature-branch
   - Vercel preview-deploy
   - Upload één van de 5 PDFs naar `/onderhandel` op de preview-URL
   - Verwacht: OCR returnt provider + amountCents

d. Graceful fallback: als PDF-render faalt (canvas-installatie issue) →
   return `needsManual: true` met duidelijke melding "PDFs worden binnenkort
   ondersteund — upload tijdelijk een foto van de factuur".

e. Test `tests/ocr-pdf.test.ts`:
   - 5 PDF-fixtures
   - Verwacht: 4 uit 5 minimum pass

f. Commit: `feat(ocr): real PDF support with canvas + graceful fallback path`.

---

## DEEL 6 — Idempotency op cron jobs

Doel: dubbele cron-runs (Vercel race-conditions) mogen geen dubbele mails sturen.

a. Prisma: nieuw model `CronRunLog`:
   ```
   model CronRunLog {
     id          String   @id @default(cuid())
     jobName     String   // 'outcome-followup', 'monthly-recheck', 'psd2-sync'
     runDate     String   // YYYY-MM-DD UTC
     status      String   @default("running") // running | done | failed
     itemsProcessed Int   @default(0)
     startedAt   DateTime @default(now())
     completedAt DateTime?
     @@unique([jobName, runDate])
   }
   ```
   Migratie `cron_idempotency`.

b. Helper `lib/cron-lock.ts`:
   ```ts
   async function acquireCronLock(jobName: string): Promise<boolean> {
     // Try INSERT — unique constraint op (jobName, runDate) faalt bij dubbel
     // Return true = we hebben de lock, draai job
     // Return false = andere instance heeft 'm al, exit
   }
   async function releaseCronLock(jobName: string, processed: number, ok: boolean)
   ```

c. Pas élke cron-route aan (`outcome-followup`, `monthly-recheck`, `psd2-sync`,
   `follow-up`):
   - Begin: `if (!await acquireCronLock(jobName)) return NextResponse.json({skipped: true})`
   - Eind: `await releaseCronLock(...)`

d. Plus per-item idempotency: als we voor één user al een follow-up mail
   hebben gestuurd vandaag, sla over ongeacht cron-lock. Check via
   `outcomeAskedAt = today` of `lastRecheckAt = today`.

e. Tests `tests/cron-idempotency.test.ts`:
   - 2 parallelle calls naar dezelfde cron → één skipt
   - Per-user dubbele mail check

f. Commit: `fix(cron): idempotency lock + per-user dedup on follow-up mails`.

---

## DEEL 7 — Encryptie-keys rotatie-ready maken

Doel: bij key-leak kunnen we draaien zonder data te verliezen.

a. Refactor `lib/crypto.ts` (uit v8 PSD2):
   - Accept multiple keys: `TOKEN_ENC_KEY_PRIMARY` + `TOKEN_ENC_KEY_FALLBACK`
   - Encrypt altijd met primary
   - Decrypt probeert primary, dan fallback
   - Versie-prefix in ciphertext: `v1:<key-id>:<base64>` zodat we weten welke key

b. Voeg helper `lib/crypto-rotate.ts`:
   - Script dat alle `BankConnection.accessTokenEnc` decrypt met fallback,
     dan re-encrypt met primary
   - Run via `npm run rotate-keys`
   - Logt aantal records gerotated

c. RUNBOOK update: hoe roteren bij verdenking van leak:
   1. Generate nieuwe key
   2. Zet huidige als FALLBACK, nieuwe als PRIMARY in Vercel env
   3. Redeploy
   4. Run `npm run rotate-keys`
   5. Verwijder FALLBACK uit env, redeploy

d. Tests `tests/crypto-rotation.test.ts`:
   - Encrypt met v1-key, swap keys, decrypt met fallback → werkt
   - Re-encrypt → nu met v2-prefix

e. Commit: `feat(crypto): rotation-ready dual-key encryption for PSD2 tokens`.

---

## DEEL 8 — Echte integratie-tests (geen mocks voor critical paths)

Doel: validate dat de hele upload→analyse→email flow werkt zonder Vercel/Neon/Groq mocks.

a. `tests/integration/` directory:
   - `upload-flow.integration.test.ts`: gebruikt **echte** Groq (met
     `GROQ_API_KEY_TEST`-env), **echte** Neon (test-database via apart
     `DATABASE_URL_TEST`-env), maar Resend MOCKED (mails niet sturen).
   - End-to-end: maak test-user, upload echte fixture-PNG, verifieer
     Bill in DB, analyse rendering, email-generation

b. Setup: gebruik Neon "branch" feature voor test-database (gratis tier
   ondersteunt branches). Aparte branch = aparte schema, kan parallel met prod.

c. CI-only: `tests/integration/` runt alleen op pull-requests, niet bij
   élke push (kost Groq-tokens). GitHub Action met `if: github.event_name == 'pull_request'`.

d. Apart van vitest unit-tests: gebruik `vitest --config vitest.integration.config.ts`
   met timeout 60s.

e. Tests:
   - `upload-flow.integration.test.ts` (3 scenarios: NL telecom, NL energie, DE telecom)
   - `multi-round.integration.test.ts` (1 scenario: upload → email → ronde 1 → counter)
   - `outcome-cron.integration.test.ts` (1 scenario: cron pickt 7d oude negotiation,
     ziet juiste user, idempotency werkt)

f. Commit: `test(integration): real-Groq, real-DB end-to-end critical-path tests`.

---

## DEEL 9 — Sentry échte instrumentation + alerting

Doel: élke crash leidt binnen 1 minuut tot push-melding op je telefoon.

a. `instrumentation.ts` op project-root:
   ```ts
   import * as Sentry from "@sentry/nextjs";
   export async function register() {
     if (process.env.NEXT_RUNTIME === "nodejs") {
       Sentry.init({
         dsn: process.env.SENTRY_DSN,
         tracesSampleRate: 0.1,
         environment: process.env.VERCEL_ENV ?? "development",
       });
     }
     if (process.env.NEXT_RUNTIME === "edge") {
       Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
     }
   }
   export const onRequestError = Sentry.captureRequestError;
   ```

b. `sentry.client.config.ts`: client-side init met session replay (10% sample),
   privacy: mask all text + block all media.

c. In élke API-route catch: `Sentry.captureException(e, { tags: { route, stage } })`
   vóór `NextResponse.json` met 500.

d. Sentry dashboard setup-instructies in RUNBOOK:
   - Maak Alert: "Issue first seen, count > 0" → notify via email + Slack/Discord webhook
   - Set issue-level: "Error events > 10/hour" → critical alert

e. Test: trigger een gecontroleerde error via `?test-sentry=1` query-param
   op een endpoint. Verwacht: Sentry-event verschijnt binnen 30s in dashboard.

f. Voeg `/api/test-sentry` route alleen in dev/staging: gooit error met
   `Sentry.captureException`, returnt eventId.

g. Tests `tests/sentry.test.ts`: mock Sentry SDK, verifieer dat élke route met
   try/catch ook captureException aanroept.

h. Commit: `feat(ops): real Sentry instrumentation + alert routing`.

---

## DEEL 10 — Feature flags + canary deploys + rollback procedure

Doel: bad deploy kan binnen 30 seconden terug-gedraaid worden zonder code-revert.

a. `lib/feature-flags.ts`:
   ```ts
   const FLAGS = {
     PSD2_ENABLED: process.env.FEATURE_PSD2 === "true",
     WHATSAPP_ENABLED: process.env.FEATURE_WHATSAPP === "true",
     MULTI_ROUND_ENABLED: process.env.FEATURE_MULTI_ROUND !== "false",
     PDF_OCR_ENABLED: process.env.FEATURE_PDF_OCR !== "false",
     PAYWALL_ENABLED: process.env.FEATURE_PAYWALL === "true",
   } as const;
   export function isEnabled(flag: keyof typeof FLAGS): boolean { ... }
   ```

b. Gebruik `isEnabled()` op élke nieuwe feature-route. Bij `false`:
   route returnt 404 of fallback UI.

c. RUNBOOK procedure "Emergency rollback":
   - Bad feature in productie → ga naar Vercel env vars
   - Zet `FEATURE_X=false`
   - Redeploy (Vercel doet 't in ~30s)
   - Feature is uit zonder code-revert

d. Vercel-specific: gebruik `vercel rollback` CLI of dashboard om naar vorige
   deployment terug te keren als feature-flag niet genoeg is.

e. Tests `tests/feature-flags.test.ts`: élke flag toggleable, élke flag heeft
   default-state, gated routes returnen juist bij off-state.

f. Commit: `feat(ops): feature flag system + documented rollback procedure`.

---

## DEEL 11 — Final smoke 30-check + STATUS_V9 + RUNBOOK update

a. `scripts/smoke-prod.ts` uitbreiden naar 30 checks. Plus:
   - 26. GET `/api/test-sentry?test=1` → 500 (intentioneel) + Sentry-event verschijnt
   - 27. POST `/api/cron/outcome-followup` 2× snel → 1 skipt
   - 28. Élke route met `?feature_test=1` query → respecteert feature flags
   - 29. `lib/providers.ts` export — pak random 10 providers, verifieer geen
        `null`-only retention zonder reden-comment
   - 30. PDF upload via curl tegen productie → 200 + billId

b. Run smoke. Bij <30/30: STOP, fix, smoke opnieuw.

c. `STATUS_V9.md`:
   ```
   Per DEEL 1-11: commit-hash + 1-regel resultaat
   Geweigerde shortcuts: <welke tests we niet softer maakten>
   Bekende open issues: <eerlijk>
   Productie-staat: gehard. Klaar voor marketing-launch.
   ```

d. `RUNBOOK.md` update:
   - Sectie "Emergency procedures" met rollback-flow
   - Sectie "Key rotation" stap-voor-stap
   - Sectie "Cron job recovery" (lock vrijgeven bij hangende run)
   - Sectie "OCR fixture testen" (hoe nieuwe fixtures toevoegen)
   - Sectie "Sentry tuning" (false-positive uitfilteren)

e. Commit: `docs(v9): smoke 30, status report, hardened runbook`.

---

## Done-criteria

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm test -- --run` → >98% pass
- [ ] Provider-data: 0 mailadressen waarvan domein geen MX heeft
- [ ] OCR fixture suite: >75% global pass, >90% NL telecom
- [ ] Round-analysis golden suite: >80% pass
- [ ] PDF flow: 4/5 fixtures werken op Vercel preview
- [ ] Cron idempotency: 2× parallel call → 1 actie
- [ ] Sentry: test-error verschijnt in dashboard binnen 60s
- [ ] Feature flags: élke v8-feature uitschakelbaar zonder code-revert
- [ ] Smoke-prod 30/30 groen

## Eindrapportage format

```
HARDEN_SOFTWARE_SPRINT v9 — Final report

DEEL 1  ✓ <hash> — N any/console removed, M functies gesplit
DEEL 2  ✓ <hash> — X verified, Y removed, Z auto-filled
DEEL 3  ✓ <hash> — golden 15 fixtures, pass rate K%
DEEL 4  ✓ <hash> — 30 OCR fixtures, NL telecom L%, global M%
DEEL 5  ✓ <hash> — PDF works on Vercel preview, 4/5 pass
DEEL 6  ✓ <hash> — cron lock + per-user dedup live
DEEL 7  ✓ <hash> — dual-key crypto + rotation script
DEEL 8  ✓ <hash> — 3 integration tests with real Groq/Neon
DEEL 9  ✓ <hash> — Sentry test-error fires + alert routed
DEEL 10 ✓ <hash> — 5 feature flags, runbook rollback procedure
DEEL 11 ✓ <hash> — smoke 30/30, STATUS_V9 written

Productie-hardness niveau: launch-ready
```

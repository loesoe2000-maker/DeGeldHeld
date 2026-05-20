# DeGeldHeld v18 — Launch Readiness Sprint

**Draai dit ná v17** (v17 raakt `ocr.ts` + `analyse/page.tsx`; v18 ook —
dus eerst v17 helemaal groen + gepushed, dan pas v18).

**Doel:** de vier zwakke plekken dichten die een launch onveilig maken —
geldpad (#1), bevroren prijzen (#5), nep multi-country (#7), PDF +
concurrency (#9).

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/LAUNCH_READINESS_SPRINT_V18.md en voer alle deeltaken uit in volgorde. Per deeltaak: implementeer, run de relevante tests (npm test + npx tsc --noEmit), bij fail fix tot groen, commit + push. Migraties: datum-prefix + `npx prisma migrate deploy` + `npx prisma generate`. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Raak GEEN echte Stripe-keys aan en switch NIET naar live-mode — dat doet de eigenaar handmatig. Bij blocker na 25 min: TODO-commit en door. Eindig met V18_REPORT.md.
```

---

## DEEL 1 — Stripe geldpad hardening (#1)

De webhook-handler bestaat (`lib/payments.ts` `verifyAndParseWebhook`,
`app/api/webhooks/stripe/route.ts`). Maak 'm waterdicht — zonder ooit
echte keys of live-mode aan te raken.

a. **Signature-verificatie verplicht maken.** In de webhook-route: als
   `STRIPE_WEBHOOK_SECRET` ontbreekt → log een luide error en return 500
   (NOOIT stil een unsigned event verwerken). Verifieer altijd de
   `stripe-signature` header tegen de secret.

b. **Idempotency.** Maak een tabel `ProcessedStripeEvent { id String @id;
   type String; processedAt DateTime @default(now()) }` (migratie). In de
   webhook: als `event.id` al verwerkt is → 200 en skip. Voorkomt dubbel
   afschrijven bij Stripe's retry-policy (Stripe stuurt events vaker).

c. **Alle relevante events afhandelen** in één switch:
   - `checkout.session.completed` → markeer paywall/fee betaald
   - `payment_intent.succeeded` → idem (fallback)
   - `payment_intent.payment_failed` → markeer failed + nette UX
   - `charge.refunded` → markeer refunded
   - `customer.subscription.created/updated/deleted` → DeGeldHeld Plus
     abonnement-status in DB
   - `invoice.paid` / `invoice.payment_failed` → recurring Plus
   Onbekende events → 200 + log (nooit 500, anders blijft Stripe retryen).

d. **DB-state correct.** Verifieer dat na `checkout.session.completed` de
   juiste `Payment`/`Negotiation`/subscription-record op betaald staat,
   met `stripeEventId` als audit-trail.

e. **Test-script** `scripts/test-stripe-webhook.ts`: bouw geldige +
   ongeldige (verkeerde signature) test-events met de Stripe test-helper
   en assert: geldig → verwerkt, ongeldig → 400, dubbel event-id → 1×
   verwerkt. Gebruik `sk_test_` uit env; als die ontbreekt → skip met
   duidelijke melding (niet falen).

f. **Unit-tests** `tests/payments-webhook.test.ts`: `shouldMarkPaid`,
   `shouldMarkRefunded`, `shouldMarkFailed`, idempotency-guard,
   ontbrekende-secret → throw.

g. Commit: `fix(stripe): enforce signature + idempotency + full event coverage`.

**Laat in V18_REPORT.md een sectie "STRIPE — handmatige stappen eigenaar"
met exact wat Bas zelf in het Stripe-dashboard moet doen** (zie ook het
overleg in de chat).

---

## DEEL 2 — Bevroren prijzen → één gedateerde bron (#5)

Prijzen leven nu op 3 plekken: hardcoded medians in
`lib/categories/*.ts`, `MARKET_PLANS` in `lib/comparison.ts`, en de
`marketProvider`/`marketPlan` DB-tabellen. Maak er één bron van.

a. Maak `lib/market-prices.ts` als single source of truth:
   ```ts
   export const PRICES_AS_OF = "2026-05-01"; // ISO datum laatste update
   export const ENERGY_MEDIANS = { ... };     // verplaatst uit energie.ts
   export const MORTGAGE_RATES = { ... };     // uit hypotheek.ts
   export const INSURANCE_PREMIUMS = { ... }; // uit verzekering.ts
   export const WATER_MEDIANS = { ... };      // uit water.ts (v17)
   export function priceAgeDays(now = new Date()): number { ... }
   export function pricesAreStale(maxDays = 120): boolean { ... }
   ```
   Laat `lib/categories/*.ts` importeren uit deze bron i.p.v. eigen
   hardcoded constanten. Eén plek bijwerken = overal correct.

b. **Staleness-zichtbaarheid.** Op de analyse-pagina: als
   `pricesAreStale()` → kleine grijze voetnoot "markt-prijzen voor het
   laatst bijgewerkt op {datum}". Eerlijk i.p.v. doen alsof het live is.

c. **Waarschuwings-cron.** Nieuwe `app/api/cron/price-staleness/route.ts`
   (CRON_SECRET-protected, schedule `0 8 1 * *` = 1e vd maand): als
   prijzen >90 dagen oud → stuur Bas een mail via Resend "tijd om
   markt-prijzen te verversen" met een checklist welke bronnen
   (ACM energie, hypotheekrente-overzichten, verzekering-vergelijkers).
   Voeg de cron toe aan `vercel.json`.

d. **`scripts/update_prices.ts` uitbreiden:** naast de bestaande
   DB-plan-update ook een `--check` modus die `PRICES_AS_OF` leeftijd
   print + waarschuwt. Documenteer in `RUNBOOK.md` hoe je maandelijks
   de medians ververst (welk getal uit welke bron).

e. Tests `tests/market-prices.test.ts`: `priceAgeDays`/`pricesAreStale`
   logica, en dat de category-modules dezelfde getallen teruggeven na
   de refactor (geen gedrag-verandering, alleen herkomst).

f. Commit: `refactor(prices): single dated source of truth + staleness cron`.

---

## DEEL 3 — Multi-country eerlijkheidsgate (#7)

Markt-data is NL-only voor energie/water/hypotheek/verzekering. Een
DE/FR-factuur wordt nu vergeleken met NL-prijzen = misleidend. Fix:
wees eerlijk i.p.v. nep-precisie.

a. In `app/onderhandel/analyse/page.tsx`: bepaal `billCountry`
   (`bill.country ?? "NL"`). Als categorie NL-only markt-data heeft
   ÉN `billCountry !== "NL"`:
   - Toon de provider + bedrag wél
   - Vervang de besparingsberekening door een eerlijke banner:
     "We ondersteunen de {land}-markt nog niet volledig — dit is een
     indicatie, geen exacte vergelijking. NL-facturen krijgen het
     nauwkeurigste advies."
   - GEEN concreet €-besparingsbedrag tonen dat op NL-prijzen leunt.

b. Maak `lib/market-coverage.ts`:
   ```ts
   // Welke (categorie, land) combinaties hebben we echt gevalideerd?
   export function hasMarketData(category: Category, country: Country): boolean
   ```
   TELECOM/STREAMING hebben mogelijk INT-data (check `MARKET_PLANS`);
   energie/water/hypotheek/verzekering = NL-only voorlopig.

c. Tests `tests/market-coverage.test.ts`: NL energie → true, DE energie
   → false, en de analyse-page-contract dat non-NL geen fake bedrag toont.

d. Commit: `fix(analyse): honest fallback for countries without market data`.

---

## DEEL 4 — PDF edge-cases (#9a)

`lib/ocr.ts` `extractFromPdf` + `lib/pdf_extract.ts` + `lib/pdf_render.ts`.

a. Tests + fixes voor:
   - **Tekst-PDF** (normale digitale factuur) → text-path werkt
   - **Gescande PDF** (geen tekstlaag) → valt terug op vision-render,
     max 5 pagina's
   - **Multi-page jaarafrekening** → combineert pagina's correct
   - **Corrupte PDF** → nette `PDF_EXTRACT_FAIL`, geen 500
   - **Wachtwoord-beveiligde PDF** → detecteer + nette melding
     "deze PDF is beveiligd, upload 'm zonder wachtwoord of als foto"
   - **PDF >10MB** → al gevangen door validatie, bevestig
   - **PDF met 0 pagina's / leeg** → nette melding

b. Voeg `tests/fixtures/bills/` PDF-fixtures toe waar nuttig (of mock
   `pdf_extract`/`pdf_render` outputs zodat tests niet van echte binaries
   afhangen).

c. Voeg een wachtwoord-detectie toe aan `extractFromPdf` (pdfjs gooit een
   `PasswordException`) → map naar een nieuwe `PDF_PASSWORD_PROTECTED`
   marker + `pdfFallbackMessage`.

d. Commit: `fix(pdf): handle scanned/corrupt/password/empty PDFs gracefully`.

---

## DEEL 5 — Concurrency & idempotency (#9b)

a. **Dubbel-submit upload.** In `components/BillUpload.tsx`: blokkeer een
   tweede submit terwijl `busy` true is (guard bestaat deels — verifieer
   + test). Server-kant: de imageHash-dedup vangt identieke dubbele
   uploads al; bevestig met test.

b. **Magic-link replay.** Een magic-link 2× klikken mag geen tweede user
   of dubbele claim geven. Test: tweede callback → zelfde user, claim is
   idempotent (updateMany op `userId: null` is al veilig — bewijs het met
   een test die 2× claimt en assert 2e keer claimed=0).

c. **Email-prompt dubbel-submit** (`AnonymousMailPrompt` →
   `/api/anon/email-signup`): rate-limit bestaat (5/uur), maar test dat
   2 snelle submits niet 2 magic-links sturen die allebei geldig zijn op
   een manier die de claim verwart.

d. **Claim-race.** Twee gelijktijdige pageviews (`/dashboard` +
   `/onderhandel`) die allebei `ensureBillsClaimed` draaien → mag niet
   dubbel claimen of crashen. De `updateMany where userId:null` is
   atomisch; schrijf een test die het parallel aanroept en assert dat de
   bill precies 1× bij de juiste user landt.

e. Tests in `tests/concurrency.test.ts` + evt. `tests/e2e/`.

f. Commit: `test(concurrency): double-submit + magic-link replay + claim race`.

---

## DEEL 6 — Groq graceful 429 + wachtrij (capaciteit)

De gratis Groq-tier 429't onder gelijktijdige load (één virale piek =
iedereen faalt). Tot de paid-tier upgrade: degradeer netjes i.p.v. hard
falen. Raakt `lib/ocr.ts` + `app/api/bills/upload/route.ts` +
`components/BillUpload.tsx`.

a. **Detecteer 429/rate-limit van Groq.** In `lib/ocr.ts` `tryModel`/
   `tryModelWithRetry`: herken de Groq rate-limit error (status 429 of
   message bevat "rate limit"/"rate_limit_exceeded"). Lees waar mogelijk
   de `retry-after` header / `Retry-After` uit de error.

b. **Backoff-retry binnen de function.** Bij 429: wacht (respecteer
   retry-after, anders exponentieel 1s→2s→4s, max 3 pogingen binnen het
   60s function-budget) en probeer opnieuw. Dit vangt korte pieken
   volledig op zonder dat de gebruiker iets merkt.

c. **Nette overflow-respons.** Als het ná de retries nog steeds 429 is:
   geef NIET de generieke OCR-fout, maar een aparte marker
   `OCR_RATE_LIMITED`. De upload-route mapt dit naar HTTP **503** met
   body `{ error: "Het is nu erg druk — we konden je rekening even niet
   uitlezen. Probeer over een halve minuut opnieuw.", retryable: true }`.

d. **Client-kant** (`components/BillUpload.tsx`): bij 503 + `retryable`
   toon een vriendelijke "even druk, we proberen het zo opnieuw"-melding
   met een automatische retry-knop (en optioneel 1× auto-retry na 20s).
   Geen rode harde foutmelding.

e. **Concurrency-cap (lichte wachtrij).** Optioneel maar aanbevolen: een
   simpele in-memory semafoor in `lib/ocr.ts` die het aantal gelijktijdige
   Groq-calls per function-instance begrenst (bv max 2), zodat we Groq
   niet zelf overspoelen. Houd het simpel — geen externe queue.

f. Tests `tests/ocr-ratelimit.test.ts`: mock een 429-respons → assert
   backoff-retry gebeurt, en na uitputting → `OCR_RATE_LIMITED` marker
   (geen crash, geen generieke fout).

g. Commit: `feat(ocr): graceful Groq 429 handling — backoff + 503 + retry UX`.

---

## DEEL 7 — Aggregate + rapport

a. Run alles:
   ```bash
   npm test -- --run
   npx tsc --noEmit
   npx playwright test tests/e2e/
   ```
   Alles groen.

b. `V18_REPORT.md`:
   - Per deel: wat gefixt, welke bugs gevonden, commit-hashes
   - **Sectie "STRIPE — handmatige stappen eigenaar"** (zie chat-overleg):
     account/leeftijd, products, webhook-secret → Vercel, live-mode flip,
     payout-rekening
   - **Sectie "GROQ — capaciteit"**: aanbeveling paid dev-tier + graceful
     429 status (zie chat)
   - Restpunten die NIET in scope vielen (#2 deliverability, #4 cron-verify,
     #8 PSD2, security-tier) als expliciete TODO-lijst

c. Commit: `docs(v18): launch readiness — money path + prices + country + pdf + concurrency`.

---

## Done-criteria

- [ ] Stripe-webhook weigert unsigned events + is idempotent + dekt alle events
- [ ] Eén gedateerde prijs-bron + staleness-voetnoot + waarschuwings-cron
- [ ] Non-NL facturen tonen eerlijke "indicatief"-banner, geen nep-bedrag
- [ ] PDF: scan/corrupt/wachtwoord/leeg → nette meldingen, geen 500
- [ ] Dubbel-submit, magic-link replay, claim-race allemaal idempotent + getest
- [ ] Groq 429 → backoff-retry, dan 503 + vriendelijke retry-UX (geen harde fout)
- [ ] `npm test` + `npx tsc --noEmit` + e2e groen
- [ ] V18_REPORT.md met Stripe + Groq eigenaar-stappen

**Belangrijk:** dit script raakt GEEN echte Stripe-keys en zet GEEN
live-mode aan. Dat doet de eigenaar handmatig na het lezen van het rapport.

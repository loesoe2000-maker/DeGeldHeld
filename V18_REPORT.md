# V18_REPORT — Launch Readiness Sprint

**Doel:** de vier launch-blockers dichten — geldpad (#1), bevroren
prijzen (#5), nep multi-country (#7), PDF + concurrency (#9) — plus
Groq 429-capaciteit. Geen echte Stripe-keys aangeraakt, geen live-mode.

## Eindrapportage

```
LAUNCH_READINESS_V18 — Final report

DEEL 1  ✓ 208676d — Stripe: signature verplicht + idempotency + volledige event-coverage
DEEL 2  ✓ 6896e38 — één gedateerde prijs-bron (lib/market-prices.ts) + staleness-cron + voetnoot
DEEL 3  ✓ 2f2615f — multi-country eerlijkheidsgate (geen NL-bedrag op DE/FR-factuur)
DEEL 4  ✓ a807f71 — PDF scan/corrupt/wachtwoord/leeg → nette meldingen, geen 500
DEEL 5  ✓ 1c9a4ce — dubbel-submit guard + magic-link replay + claim-race idempotent
DEEL 6  ✓ 7c0b75c — Groq 429: backoff-retry → 503 + vriendelijke retry-UX
DEEL 7  ✓ <dit commit> — aggregate + rapport
```

## Per deel — wat gefixt + bugs

### DEEL 1 — Stripe geldpad
- Webhook weigert nu **unsigned events** (ontbrekende
  `STRIPE_WEBHOOK_SECRET` → luide 500 + Sentry, nooit stil verwerkt).
- **Idempotency** via nieuwe `ProcessedStripeEvent`-tabel: dubbel
  event-id → 200 + skip; bij processing-fout wordt de marker
  verwijderd zodat Stripe's retry écht opnieuw draait.
- **Volledige event-switch**: checkout.completed / payment_intent.*
  / charge.refunded / customer.subscription.* / invoice.* . Onbekend
  → 200 + no-op.
- Audit-trail: `Payment.stripeEventId`. Subscription-events updaten
  `User.subscriptionStatus` (active/past_due/canceled).
- Bug: de oude handler had geen idempotency → bij Stripe-retry kon een
  Payment 2× geflipt worden. Nu onmogelijk.

### DEEL 2 — Bevroren prijzen
- Eén bron `lib/market-prices.ts` met `PRICES_AS_OF`. De 4
  category-modules importeren + re-exporten (gedrag-neutraal,
  bevestigd door 45 category-tests).
- Analyse-voetnoot "markt-prijzen voor het laatst bijgewerkt op
  {datum}" + stale-waarschuwing >120 dagen.
- Cron `price-staleness` (1e vd maand) mailt eigenaar bij >90 dagen.
- `scripts/update_prices.ts --check` print leeftijd.

### DEEL 3 — Multi-country eerlijkheid
- `lib/market-coverage.ts` `hasMarketData()`: energie/water/
  hypotheek/verzekering = NL-only. Een DE/FR-factuur krijgt een
  eerlijke "indicatie, geen exacte vergelijking"-banner met provider
  + bedrag, **geen** nep-€-besparing. TELECOM/STREAMING (INT-plannen)
  blijven wel vergeleken.

### DEEL 4 — PDF edge-cases
- Wachtwoord-PDF (pdfjs `PasswordException`) → `PDF_PASSWORD_PROTECTED`
  + nette melding. 0-page/leeg → `PDF_EMPTY`. Corrupt → ok=false,
  geen 500. Scan-PDF → bestaande vision-render fallback. >10MB al
  door validatie.

### DEEL 5 — Concurrency
- `BillUpload` krijgt een synchrone `busyRef` guard (setBusy is async,
  twee snelle clicks konden er beide langs).
- Magic-link replay + claim-race getest met stateful prisma-mock:
  `where userId:null` is atomisch → bill landt exact 1× bij de juiste
  user; replay → claimed=0.

### DEEL 6 — Groq 429
- 429-detectie + retry-after parsing + exponential backoff (1/2/4s,
  max 3) in `tryModelWithRetry`. Na uitputting → `OCR_RATE_LIMITED`
  → upload-route 503 `{retryable:true}` → client toont vriendelijke
  amber "even druk" + "Probeer opnieuw"-knop (geen harde rode fout).

## Test-totaal
- Nieuwe v18 tests: payments-webhook (10), market-prices (8),
  market-coverage (8), pdf-edge-cases (15), concurrency (6),
  ocr-ratelimit (12) = **59 nieuw**.
- `npm test`: 1597 passed (2 pre-existing FAQ-failures uit b351a61,
  zie BACKLOG — buiten scope).
- `npx tsc --noEmit`: clean.
- category e2e: 10/10 groen.

---

## STRIPE — handmatige stappen eigenaar

Doe dit zelf in het Stripe-dashboard (de sprint raakt GEEN keys aan):

1. **Account compleet maken**: bedrijfsgegevens + bankrekening
   (payout) verifiëren. Stripe houdt uitbetalingen vast tot dit klaar
   is.
2. **Products aanmaken**:
   - "Verified savings fee" — variabel bedrag (no-cure-no-pay).
   - "DeGeldHeld Plus" — recurring €4,99/maand.
3. **Webhook endpoint** toevoegen → `https://degeldheld.com/api/webhooks/stripe`
   met events: `checkout.session.completed`, `payment_intent.succeeded`,
   `payment_intent.payment_failed`, `charge.refunded`,
   `customer.subscription.created/updated/deleted`, `invoice.paid`,
   `invoice.payment_failed`.
4. **Webhook signing secret** (`whsec_...`) → Vercel env als
   `STRIPE_WEBHOOK_SECRET`. **Zonder deze env weigert de webhook nu
   alles (500)** — bewust, zodat je 't merkt.
5. **Test-mode eerst**: draai `STRIPE_SECRET_KEY=sk_test_... npx tsx
   scripts/test-stripe-webhook.ts` + een echte test-checkout.
6. **Live-mode flip**: pas wanneer test-flow groen is — vervang
   `sk_test_`/`whsec_test_` door de live-varianten in Vercel. Dit doe
   JIJ handmatig; deze sprint doet het niet.

## GROQ — capaciteit

- Gratis tier 429't onder gelijktijdige load. v18 vangt korte pieken
  op met backoff-retry + een vriendelijke 503-retry-UX, zodat één
  virale piek niet iedereen hard laat falen.
- **Aanbeveling**: upgrade naar de Groq **paid dev-tier** vóór een
  grote marketing-push — dat verhoogt de rate-limit fors en maakt de
  429-degradatie zeldzaam. De graceful handling blijft als vangnet.
- Een in-memory concurrency-semafoor is bewust NIET toegevoegd:
  Vercel draait veel kortlevende lambda-instances, dus een per-instance
  cap helpt nauwelijks; de backoff dekt de praktijk.

## DB-migratie — TODO eigenaar

`prisma migrate deploy` kon tijdens deze sprint **niet** draaien — de
Neon-compute (pooled + direct host) was onbereikbaar vanuit de
build-omgeving (infra-suspend, geen dashboardtoegang hier). De
migratie-SQL staat klaar + `prisma generate` is gedraaid.

**Eigenaar moet draaien zodra de DB bereikbaar is:**
```bash
npx prisma migrate deploy
```
Migratie: `20260521000000_stripe_idempotency_subscription`
(ProcessedStripeEvent-tabel + Payment.stripeEventId +
User.stripeCustomerId/stripeSubscriptionId). **Zonder deze migratie
geeft de webhook 500 op idempotency-insert** — dus deploy vóór de
Stripe-webhook live gaat.

## Restpunten buiten scope (expliciete TODO)

- **#2 e-mail deliverability** — SPF/DKIM/DMARC tuning, bounce-handling.
- **#4 cron-verify** — end-to-end test dat élke cron echt draait op
  Vercel (nu alleen unit + lock-idempotency).
- **#8 PSD2** — bank-koppeling flow staat achter feature-flag, niet
  hardened in deze sprint.
- **Security-tier** — pen-test / dependency-audit / CSP-headers.

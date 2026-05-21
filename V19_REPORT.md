# V19_REPORT — Automatische no-cure-no-pay (versimpelde Optie A)

De 20%-fee wordt nu **automatisch** afgeschreven zodra een besparing bewezen
is — via gehoste Stripe Checkout (geen eigen kaart-UI), met een net vangnet
voor kaarten die authenticatie eisen.

## Eindrapportage

```
AUTO_FEE_V19 — Final report

DEEL 0  ✓ e9f742f — fee-cap €50 → €500
DEEL 1  ✓ 09a7f62 — schema mandaat + payment-method op User
DEEL 2  ✓ b23a5db — gehoste setup-checkout + consent
DEEL 3  ✓ e09ff44 — webhook slaat kaart + mandaat op
DEEL 4  ✓ 0360927 — automatische off-session afschrijving + vangnet
DEEL 5  ✓ <dit commit> — UX/copy/account + rapport
```

## Wat werkt nu automatisch vs vangnet

| Situatie | Gedrag |
|----------|--------|
| **Kaart gekoppeld + mandaat + charge slaagt** | `chargeFeeOffSession` → PaymentIntent (off_session+confirm) → state **FEE_PAID**, `feePaidAt` + `feePaymentIntentId` gezet. Geen handmatige stap. /uitkomst: "Fee van €X automatisch voldaan — bedankt!" |
| **Kaart + mandaat, maar off-session faalt** (authenticatie vereist / declined) | state **BILLED_PENDING_PAYMENT** + `feeAmountCents` → bestaande handmatige betaalknop op /uitkomst + een fallback-mail met de pay-link. Geen dunning. |
| **Geen kaart op bestand** | state **BILLED_PENDING_PAYMENT** (ongewijzigd gedrag) — handmatige knop. |
| **Admin / flag-off / besparing < €25/jaar** | state **SUCCESS**, geen fee, geen charge-poging (zoals voorheen). |

### Stroom kaart koppelen
1. `/onderhandel/email` toont (zacht, niet-blokkerend) `FeeMandatePrompt` als
   er nog geen kaart is. Akkoord + "Koppel kaart" → `POST /api/fee-setup` →
   gehoste Stripe Checkout `mode: "setup"` (kaart-only, SCA via Stripe).
2. Stripe `checkout.session.completed` (mode=setup, purpose=fee-mandate) →
   webhook leest de SetupIntent's payment_method, zet 'm als default op de
   customer, en slaat `feePaymentMethodId` + `feeMandateAcceptedAt` op
   (`feeMandateText` is bij akkoord al opgeslagen). Idempotent via
   `ProcessedStripeEvent`.
3. `/account` → `FeeCardSettings`: toont of er een kaart is, knop "Kaart
   koppelen" of "Kaart verwijderen / mandaat intrekken" (`DELETE /api/fee-setup`
   → detach bij Stripe + `feePaymentMethodId/feeMandateAcceptedAt` op null).

## Verwacht % off-session-fail (vangnet-frequentie)

EU-kaarten vallen onder SCA/PSD2. Een opgeslagen kaart met een geaccepteerd
mandaat (MIT — merchant-initiated transaction) is meestal vrijgesteld van
3DS, maar een deel van de issuers eist alsnog authenticatie of weigert
(`authentication_required` / `card_declined`). Reële verwachting: grofweg
**~10–25%** van de off-session charges raakt het vangnet (sterk afhankelijk
van issuer-mix). Die gebruikers krijgen de bestaande handmatige knop + mail —
niemand valt buiten de boot, en we bouwen géén incassosysteem.

## Copy / cap
- Fee-cap €50 → **€500** (`NO_CURE_NO_PAY_FEE_CAP_CENTS = 50000`); model blijft
  eenmalig 20%. Copy bijgewerkt: `/prijs` (3×), `/uitkomst` ("maximum van
  €25,00" → "€500,00"), mandaat-tekst (`FeeMandatePrompt`). Tests
  (fee-calc / stripe-flow / payments / journey-8 e2e) naar €500.

## Verificatie
- `npx tsc --noEmit`: clean.
- `npm test -- --run`: **1712 passed**, 2 failed = bekende pre-existing
  FAQ-failures (`b351a61`, BACKLOG — buiten scope).
- `npm run build`: **EXIT 0** vóór élke commit.
- `npx playwright test tests/e2e/`: v19-relevante e2e (journey-8 fee-bounds,
  inbound-proof 401) **groen**, 62+ passed. **2 multi-round e2e-failures** zijn
  **niet** v19-gerelateerd: die signen de sessie-cookie met een fallback-secret
  die niet matcht met de lokale dev-server `AUTH_SECRET` (→ redirect /login) —
  een env/secret-mismatch in de lokale e2e-harness.
- Migraties (deployed + `prisma generate`): `20260523000000_fee_mandate`
  (User.feePaymentMethodId/feeMandateAcceptedAt/feeMandateText),
  `20260524000000_fee_paid` (NegotiationState.FEE_PAID +
  Negotiation.feePaidAt/feePaymentIntentId).
- **Geen echte/live Stripe-keys aangeraakt** — alles getypt voor sk_test;
  in test-dummy mode geeft `createFeeSetupSession` een fake URL en
  `chargeFeeOffSession` valt netjes terug op het vangnet.

## 🧑 EIGENAAR — handmatige stappen
1. **Stripe Dashboard**: zet off-session / MIT (merchant-initiated
   transactions) aan voor het account, en zorg dat "save card for future use"
   / SetupIntents toegestaan zijn. Test de flow eerst met `sk_test_` +
   een test-kaart (incl. een 3DS-required test-kaart om het vangnet te zien).
2. **Webhook**: zorg dat `checkout.session.completed` op het Stripe-webhook-
   endpoint geabonneerd is (al vereist voor de bestaande flows) — de
   setup-completion gebruikt hetzelfde event.
3. **Voorwaarden-pagina**: neem de exacte mandaat-tekst op (zie
   `FEE_MANDATE_TEXT` in `components/FeeMandatePrompt.tsx`) zodat de
   geaccepteerde tekst en de gepubliceerde voorwaarden 1-op-1 matchen.
4. **Live-mode flip**: pas wanneer de test-flow groen is — vervang de
   `sk_test_`/`whsec_test_` door live-varianten in Vercel. Dit doe je
   handmatig; deze sprint raakt geen live-keys aan.

## Juridisch restpunt
- De voorwaarden + de exacte mandaat-tekst (off-session/MIT-machtiging,
  intrekrecht, cap €500) **laten checken door een jurist** — het off-session
  afschrijven op basis van een vooraf gegeven mandaat is een
  consumenten-incasso en moet juridisch waterdicht zijn (recht op intrekken is
  geïmplementeerd via `DELETE /api/fee-setup`).

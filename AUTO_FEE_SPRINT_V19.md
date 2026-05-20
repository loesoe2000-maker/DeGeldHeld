# DeGeldHeld v19 — Automatische no-cure-no-pay (versimpelde Optie A)

**Draai dit ná v18** (beide raken `lib/payments.ts` + de Stripe-webhook).

**Doel:** de 20%-fee wordt **automatisch** afgeschreven zodra besparing
bewezen is — zonder zelf een kaart-UI, SCA-afhandeling of incassosysteem
te bouwen. We laten Stripe Checkout (gehost) het zware werk doen en
hergebruiken de bestaande handmatige betaalknop als vangnet.

## Kernidee (versimpeling)

1. **Kaart opslaan via Stripe Checkout `mode: "setup"`** — gehoste pagina,
   Stripe doet kaartformulier + SCA/3DS + opslag. Wij bouwen geen
   betaalvelden.
2. **Off-session afschrijven** bij bewijs-verificatie via één
   `paymentIntents.create({ off_session: true, confirm: true })`.
3. **Faalt de off-session charge** (EU-kaart eist authenticatie, saldo,
   etc.) → val terug op de BESTAANDE handmatige betaalknop +
   `BILLED_PENDING_PAYMENT` state. Geen dunning-systeem.
4. **Geen kaart op bestand** → huidige handmatige flow blijft werken
   (degradeert netjes, niks breekt).

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/AUTO_FEE_SPRINT_V19.md en voer alle deeltaken uit in volgorde. Per deeltaak: implementeer, run tests (npm test + npx tsc --noEmit), bij fail fix tot groen, commit + push. Migraties: datum-prefix + `npx prisma migrate deploy` + `npx prisma generate`. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Raak GEEN echte/live Stripe-keys aan; test alles met sk_test_. Bij blocker na 25 min: TODO-commit en door. Eindig met V19_REPORT.md.
```

---

## DEEL 1 — Schema: mandaat + payment-method op User

a. Voeg aan `model User` toe (migratie):
   ```
   feePaymentMethodId   String?    // Stripe PaymentMethod (pm_...) voor fee-incasso
   feeMandateAcceptedAt DateTime?  // wanneer no-cure-no-pay akkoord gegeven
   feeMandateText       String?    // exacte tekst die de user accepteerde (audit)
   ```
   `stripeCustomerId` bestaat al — hergebruik die.

b. Migratie draaien op prod + `npx prisma generate`.

c. Commit: `feat(schema): fee payment-method + mandate consent on User`.

---

## DEEL 2 — Setup-checkout: kaart koppelen (gehost, €0)

a. Nieuwe functie in `lib/payments.ts`:
   `createFeeSetupSession({ userId, userEmail, appUrl, returnTo })` →
   maakt een Stripe Checkout Session met:
   ```ts
   mode: "setup",
   payment_method_types: ["card"],   // ideal kan geen off-session mandaat
   customer: <bestaande of nieuwe stripeCustomerId>,
   customer_creation: "always",       // als nog geen customer
   metadata: { userId, purpose: "fee-mandate" },
   success_url: `${appUrl}${returnTo}?card=ok`,
   cancel_url: `${appUrl}${returnTo}?card=skip`,
   ```
   Test-mode dummy-key → return een fake URL (zoals `createCheckoutSession`
   al doet) zodat e2e zonder echte Stripe kan.

b. Route `POST /api/fee-setup` → start de setup-session, redirect naar
   `session.url`. Auth vereist (alleen ingelogde users met een bill).

c. **Consent-scherm** `components/FeeMandatePrompt.tsx` (client):
   - Toont: "No cure, no pay. Je betaalt nu €0. Alleen áls we besparing
     bewijzen, schrijven we 20% af (max €50, min €2). Je kunt altijd
     opzeggen."
   - Checkbox "Ik ga akkoord" → knop "Koppel kaart & start onderhandeling"
     → POST `/api/fee-setup`.
   - Sla de exacte mandaat-tekst mee als `feeMandateText` (in DEEL 3 via
     webhook of direct na akkoord).

d. **Inbouwen op het juiste moment:** op de onderhandel-mail-stap
   (`/onderhandel/email`) of net ervoor. Als de user al een
   `feePaymentMethodId` heeft → sla dit scherm over. Anders: toon het
   als zachte stap (NIET hard blokkeren — wie skipt, valt terug op de
   huidige handmatige fee-flow).

e. Commit: `feat(fee): hosted setup-checkout + no-cure-no-pay consent`.

---

## DEEL 3 — Webhook: kaart + mandaat opslaan

a. In de Stripe-webhook (`app/api/webhooks/stripe/route.ts` +
   `lib/payments.ts` parsing): handel `checkout.session.completed` met
   `mode === "setup"` af:
   - Lees `setup_intent` → haal de `payment_method` op
   - Sla op de user op: `stripeCustomerId`, `feePaymentMethodId`,
     `feeMandateAcceptedAt = now()`, `feeMandateText`
   - Zet de PaymentMethod als default op de Customer
     (`invoice_settings.default_payment_method`) zodat off-session werkt
   - Idempotent (hergebruik de `ProcessedStripeEvent`-guard uit v18)

b. Tests `tests/fee-setup-webhook.test.ts`: setup-completed event →
   user heeft pm + mandaat-datum; dubbel event → 1× verwerkt.

c. Commit: `feat(fee): persist card + mandate on setup-checkout completion`.

---

## DEEL 4 — Automatische afschrijving bij bewijs (met vangnet)

Dit is de kern. In `lib/outcome-proof.ts` (na `verdict === "verified"`,
waar nu `BILLED_PENDING_PAYMENT` wordt gezet):

a. Nieuwe functie in `lib/payments.ts`:
   `chargeFeeOffSession({ userId, negotiationId, feeCents })`:
   ```ts
   // Vereist: user.stripeCustomerId + user.feePaymentMethodId + mandaat
   const pi = await stripe.paymentIntents.create({
     amount: feeCents, currency: "eur",
     customer: user.stripeCustomerId,
     payment_method: user.feePaymentMethodId,
     off_session: true, confirm: true,
     metadata: { negotiationId, kind: "auto-fee" },
   });
   // → { ok: true, paymentIntentId } bij succes
   // → { ok: false, reason } bij authentication_required / declined
   ```
   Vang `StripeCardError` / `authentication_required` netjes af.

b. In `outcome-proof.ts`, wanneer `shouldChargeVerifiedFee` true is en
   `feeCents > 0`:
   - **Kaart op bestand + mandaat?** → probeer `chargeFeeOffSession`:
     - **Succes** → state `SUCCESS` (of nieuw `FEE_PAID`),
       `feePaidAt = now()`, `feeAmountCents`, `feePaymentIntentId`.
       Geen handmatige knop meer nodig.
     - **Faalt** → state `BILLED_PENDING_PAYMENT` + `feeAmountCents`
       (exact de huidige flow) → user ziet de bestaande betaalknop +
       krijgt een mailtje met de betaallink.
   - **Geen kaart op bestand** → `BILLED_PENDING_PAYMENT` (huidige gedrag).

c. Bij off-session fail: stuur via Resend een korte mail "je
   onderhandeling is gelukt — rond de fee af" met de `/uitkomst`-link.
   Hergebruik bestaande mail-helper.

d. Tests `tests/auto-fee-charge.test.ts`:
   - kaart + mandaat + succes → FEE_PAID, geen pending
   - kaart + mandaat + off-session fail → BILLED_PENDING_PAYMENT + mail
   - geen kaart → BILLED_PENDING_PAYMENT (ongewijzigd)
   - admin / flag-off / sub-floor → geen charge (zoals nu)

e. Commit: `feat(fee): auto off-session charge on verified savings + fallback`.

---

## DEEL 5 — UX, copy-fix, tests, rapport

a. **Copy-bug fixen:** `/uitkomst` zegt nog "maximum van €25,00" — de cap
   is €50 (`NO_CURE_NO_PAY_FEE_CAP_CENTS = 5000`). Vervang door €50,00.
   Zoek ook andere plekken die de oude cap noemen.

b. **/uitkomst statussen:** toon nette tekst per state:
   - `FEE_PAID` → "Fee van €X automatisch voldaan — bedankt!"
   - `BILLED_PENDING_PAYMENT` → bestaande betaalknop (vangnet)
   - geen fee (admin/sub/sub-floor) → gewoon "Gefeliciteerd, je bespaart €X"

c. **/account:** laat zien of er een kaart gekoppeld is + knop "kaart
   wijzigen/verwijderen" (verwijderen = `feePaymentMethodId = null`,
   detach bij Stripe). Recht om mandaat in te trekken (consumentenrecht).

d. Run alles: `npm test -- --run` + `npx tsc --noEmit` +
   `npx playwright test tests/e2e/`. Alles groen.

e. `V19_REPORT.md`:
   - Wat werkt nu automatisch vs vangnet
   - Welk % EU-kaarten verwacht off-session-fail (en dus vangnet raakt)
   - **Sectie "EIGENAAR — handmatige stappen"**: in Stripe Dashboard
     instellingen voor off-session/MIT (merchant-initiated transactions)
     aanzetten + voorwaarden-pagina updaten met de exacte mandaat-tekst
   - Juridisch restpunt: voorwaarden + mandaat-tekst laten checken

f. Commit: `docs(v19): auto no-cure-no-pay verified, copy + account fixes`.

---

## Done-criteria

- [ ] Kaart koppelen via gehoste Stripe Checkout (geen eigen kaart-UI)
- [ ] Mandaat-akkoord opgeslagen met exacte tekst (audit)
- [ ] Bewijs geverifieerd → automatische 20%-afschrijving wanneer kaart op bestand
- [ ] Off-session fail → terugval op bestaande handmatige knop + mail (geen dunning)
- [ ] Geen kaart → huidige flow ongewijzigd (degradeert netjes)
- [ ] Copy-bug €25 → €50 gefixt
- [ ] /account: kaart bekijken + mandaat intrekken
- [ ] `npm test` + `npx tsc --noEmit` + e2e groen
- [ ] V19_REPORT.md met eigenaar-stappen + juridisch restpunt

## Eindrapportage

```
AUTO_FEE_V19 — Final report

DEEL 1  ✓ <hash> — schema mandaat + payment-method
DEEL 2  ✓ <hash> — gehoste setup-checkout + consent
DEEL 3  ✓ <hash> — webhook slaat kaart + mandaat op
DEEL 4  ✓ <hash> — automatische off-session afschrijving + vangnet
DEEL 5  ✓ <hash> — UX/copy/account + rapport
```

**Na deze sprint: de 20%-fee wordt automatisch geïnd zodra besparing
bewezen is, met een net vangnet voor de kaarten die authenticatie eisen —
zonder dat we zelf een kaart-UI of incassosysteem bouwen.**

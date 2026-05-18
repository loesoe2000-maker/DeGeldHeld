# DeGeldHeld v13 — MEGA Sprint: bugs + proof-flow + product features

Combineert v11 (REVENUE_VERIFICATION) en v12 (PRODUCT_BOOST) tot één
samenhangende sprint. Negen deeltaken in logische volgorde. ~10-14 uur.

Volgorde is **bewust** zo gekozen — sommige stappen hangen af van eerdere.
Bv. auto-pingpong leunt op robuuste PDF-OCR, dus PDF eerst.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/MEGA_SPRINT_V13.md en voer alle negen deeltaken uit in volgorde. Per deeltaak: implementeer, schrijf tests, run `npx tsc --noEmit` en `npm test -- --run`, commit + push. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 25 min: TODO-commit met reden en door naar volgende deeltaak. Migraties: lokaal `prisma migrate dev`, daarna `npx prisma migrate deploy` zodat productie meeloopt. Bij externe afhankelijkheden: log in MANUAL_SETUP_REQUIRED.md wat de user nog moet doen.
```

---

## DEEL 1 — Bug-jacht (4 zichtbare productie-bugs uit live test)

a. **Instructie-bleed in counter-mail body**. Live screenshot toonde "Dit is
   ronde 1 van de onderhandeling..." in de geprinte body. Dat is system-prompt
   leakage. Fix in `lib/rounds.ts` heuristic-fallback: `buildCounterFromHeuristic()`
   gebruikt nu de stricte template-vorm zonder instructie-prefix.

b. **Llama 3.3 LLM fallback geactiveerd**. Counter-mail toonde "Heuristische
   analyse (LLM niet beschikbaar)". Onderzoek + fix:
   - `lib/rounds.ts` `analyseProviderResponse()` — log Groq error naar Sentry
   - Check dat `llama-3.3-70b-versatile` niet in Groq block-list staat
   - 3-retry met exponential backoff (1s, 3s, 8s)
   - Bij definitief falen: log + heuristic fallback

c. **Dubbele email in signature**. Counter-mail eindigde met email × 2. Fix in
   `lib/negotiator.ts` fallbackTemplate:
   - `customerName` mag niet auto-zelf `customerEmail` worden
   - Als `user.name` null: gebruik `email.split("@")[0]` capitalize'd
   - Signature: line1 = naam, line2 = email

d. **BE-factuur krijgt ES/FR alternatieven**. `buildComparison()` moet filteren
   op `bill.country`. Verifieer dat de country-filter uit v10 daadwerkelijk
   werkt — als BE bill nog Iberdrola toont, fix het in `lib/comparison.ts` +
   `lib/providers.ts`.

e. Tests:
   - `tests/counter-mail-clean.test.ts` — body bevat geen "Dit is ronde"
   - `tests/counter-mail-signature.test.ts` — geen dubbele regels
   - `tests/counter-mail-country.test.ts` — BE bill → BE provider in counter

f. Commit: `fix(rounds): clean counter-mail body + signature + country-filtered alternatives + Groq retry`.

---

## DEEL 2 — Multi-page PDF support (jaarafrekeningen)

Probleem: huidige PDF-pad rendert alleen pagina 1. Eneco/Vattenfall jaarafrekeningen
hebben totaal-bedrag op pagina 1 en specificatie op pagina 7+.

a. `lib/ocr.ts` PDF-pad uitbreiden:
   - Pak pagina-count via pdfjs-dist
   - Render pagina 1 altijd
   - Render extra pagina's tot max 5 totaal als pagina 1 geen amount geeft
   - Per pagina: render naar PNG (1500px max-breedte) via `@napi-rs/canvas`
   - Stuur alle PNG's tegelijk naar Groq Vision in één multi-image call:
     ```ts
     content: [
       { type: "text", text: SYSTEM_PROMPT + " (multi-page input)" },
       { type: "image_url", image_url: { url: page1DataUrl } },
       { type: "image_url", image_url: { url: page2DataUrl } },
       // ...
     ]
     ```

b. System prompt update: vermeld dat input meerdere pagina's kan zijn van dezelfde
   factuur. AI moet over de pagina's heen het juiste maandbedrag vinden.

c. Test-fixture `tests/fixtures/bills-pdf/eneco-warmte-jaar.pdf` (9 pagina's,
   echte case). Verwacht: provider="Eneco", monthlyCents > 0, period correct.

d. Cost-guard: hard-limit 5 pagina's per request, log warning bij PDF >5 pagina's.

e. Commit: `feat(ocr): multi-page PDF rendering up to 5 pages with multi-image Groq call`.

---

## DEEL 3 — Provider-tone matching + categorie-vocabulary

a. `lib/providers.ts` uitbreiden met `tone?: "formal" | "neutral" | "casual"`:
   - **Formal**: KPN, ABN, Centraal Beheer, Aegon, Allianz, ING, Rabobank, ASR
   - **Neutral**: Vodafone, Eneco, Vattenfall, Univé, FBTO, Ziggo, T-Mobile (zakelijk)
   - **Casual**: Bunq, Knab, Budget Mobiel, Spotify, Netflix, Hollandsnieuwe

b. `lib/negotiator.ts` `buildPrompt()`:
   - Lees provider.tone
   - Override `tonality` parameter waar provider expliciet tone heeft
   - System-prompt: "Stem stijl af op de provider. KPN is formeel, Bunq is informeel."

c. `lib/categories.ts` `negotiationVocabulary` per category:
   - ENERGIE: "kWh-tarief", "vast tarief", "voorschot", "jaarafrekening"
   - VERZEKERING: "premie", "dekking", "eigen risico", "polisvoorwaarden"
   - HYPOTHEEK: "rente", "oversluiten", "rentevaste periode"
   - TELECOM: "abonnement", "bundel", "klantbehoud-team"

d. Negotiator prompt gebruikt deze vocab als hint: "Gebruik bij {category}
   expliciet termen zoals: ..."

e. Tests:
   - `tests/tone-matching.test.ts` — KPN mail bevat "Geachte", Bunq mail bevat "Hoi"
   - `tests/vocab-matching.test.ts` — ENERGIE mail noemt "kWh" of "voorschot"

f. Commit: `feat(negotiator): provider-tone matching + category vocabulary`.

---

## DEEL 4 — Auto-pingpong activeren (Resend inbound webhook)

a. **MANUAL_SETUP_REQUIRED.md** uitbreiden met Resend inbound setup:
   - MX voor `auto.degeldheld.com` → Resend inbound
   - Webhook URL: `https://degeldheld.com/api/inbound/router`
   - HMAC secret: `RESEND_INBOUND_SECRET` in Vercel env

b. `/api/inbound/router/route.ts` discrimineren op subject:
   - `[PROOF-{billId}]` → proof-flow (zie DEEL 5)
   - `[NEGOTIATION-{negotiationId}]` of `In-Reply-To` matching thread → auto-pingpong
   - Anders: log + 200 ack

c. `lib/auto-pingpong.ts`:
   1. Verifieer HMAC
   2. Parse inbound body + attachments
   3. Match `Negotiation` via `providerThreadId`
   4. Run `analyseProviderResponse()` (uit DEEL 1)
   5. Genereer counter via `generateEmail({...input, roundContext: N+1})`
   6. Maak `NegotiationRound` met outcome=AWAITING_USER_CONFIRM
   7. Stuur user notif-mail "Provider antwoordde — bekijk counter"
   8. **NIET zelf versturen** — user moet klikken op /onderhandel/[billId]/ronde/[n]

d. Feature flag `FEATURE_AUTO_PINGPONG=false` default.

e. Tests:
   - `tests/auto-pingpong-flow.test.ts` — 3 mock-replies → juiste counter
   - `tests/auto-pingpong-no-autosend.test.ts` — confirm-gate werkt
   - `tests/inbound-router-discriminate.test.ts` — proof vs negotiation routing

f. Commit: `feat(auto-pingpong): inbound flow with confirm gate behind feature-flag`.

---

## DEEL 5 — Bewijs-flow (proof verification)

Doel: voordat user "€X bespaard" claim kan maken, één bewijsstuk forwarden of
nieuwe factuur uploaden.

a. Prisma migratie `outcome_proof`:
   ```prisma
   model OutcomeProof {
     id              String   @id @default(cuid())
     negotiationId   String
     kind            String   // "forwarded_email" | "new_bill" | "screenshot" | "manual"
     storageUrl      String?
     parsedAmountCents Int?
     verifiedAt      DateTime?
     verificationStatus String @default("pending")
     verifierNote    String?  @db.Text
     createdAt       DateTime @default(now())
     negotiation Negotiation @relation(fields: [negotiationId], references: [id], onDelete: Cascade)
     @@index([negotiationId])
   }
   ```
   Plus op `Negotiation`: `proofRequired Boolean @default(true)`,
   `proofVerifiedAt DateTime?`. Nieuwe state-enum value: `SUCCESS_UNVERIFIED`.

b. `/onderhandel/[billId]/uitkomst` page: bij "Geslaagd" + bedrag, vraag bewijs:
   - "Forward bevestigingsmail naar bewijs@degeldheld.com"
   - Of upload screenshot/PDF
   - Of skip (claim niet geverifieerd, geen fee, niet op /proof)

c. `/api/inbound/proof/route.ts` (via discriminator uit DEEL 4):
   - Resend HMAC verify
   - Match from-address tegen User.email
   - Subject `[PROOF-{negotiationId}]` of In-Reply-To matching
   - Run `extractBill()` op attachments + body
   - Match: nieuw bedrag < oud bedrag met >5% verschil → verified
   - Geen match: rejected, mail user "Bewijs niet herkend"

d. `/api/outcome/[id]/proof/route.ts` POST voor directe upload van bewijs.

e. `actualSavingsCents` alleen gevuld bij `proofVerifiedAt`. Anders state =
   `SUCCESS_UNVERIFIED`.

f. Update `/proof` page: alleen verified savings tellen mee in totalen. Toon
   apart "X claims niet geverifieerd" voor transparantie.

g. Tests:
   - `tests/proof-flow.test.ts` — forward match → verified
   - `tests/proof-rejected.test.ts` — geen match → rejected
   - `tests/proof-skip.test.ts` — skip → SUCCESS_UNVERIFIED

h. Commit: `feat(proof): mandatory verification before claim counts as savings`.

---

## DEEL 6 — 30-dagen recheck cron (voor/na vergelijking)

a. `/api/cron/recheck-savings/route.ts` dagelijks 09:30:
   - Selecteer Negotiations met state=EMAIL_SENT/COUNTER_SENT, 28-35 dagen oud
   - Mail user: "Upload je nieuwe {provider}-factuur — wij verifiëren auto"
   - Link naar `/onderhandel/[billId]/herupload?as=proof`

b. Wanneer user nieuwe factuur uploadt via `?as=proof`:
   - Bestaande upload-flow + OCR
   - Match nieuwe Bill aan oude via provider + user
   - `actualDelta = oldBill.monthlyCents - newBill.monthlyCents`
   - Als `actualDelta > 100` (>€1 verschil): markeer verified
   - Sla op als OutcomeProof kind="new_bill"

c. Update Negotiation: state = SUCCESS, actualSavingsCents = delta × 12.

d. Update `/dashboard`: per Negotiation chip "Verifieer bewijs →" als proof nog
   niet verified.

e. Voeg cron toe in `vercel.json`:
   ```json
   { "path": "/api/cron/recheck-savings", "schedule": "30 9 * * *" }
   ```

f. Tests:
   - `tests/recheck-cron.test.ts` — 30d oude negotiation → reminder
   - `tests/before-after-diff.test.ts` — oude €174 + nieuwe €120 → savings €648

g. Commit: `feat(proof): 30-day recheck cron + before/after invoice diff`.

---

## DEEL 7 — Pricing flow herziening: 20% no-cure-no-pay

a. Update `lib/payments.ts`:
   - `requiresPayment()` returnt false voor analyse-fase (geen paywall daar meer)
   - **Belangrijk**: `feeForVerifiedSavings()` op **20%** (niet 10%!)
   - Cap €50, floor €2
   - Min savings €25/jaar voordat fee
   - Fee getriggerd alleen bij `proofVerifiedAt != null`

b. Nieuwe state `BILLED_PENDING_PAYMENT`:
   - Bij proof-verify trigger Stripe Checkout session
   - Mail: "Je bespaarde €X. Fee €Y. Betaal binnen 14 dagen."
   - 14 dagen geen betaling → state = BILLED_OVERDUE, geen nieuwe negotiations

c. Op `/onderhandel/[billId]/uitkomst` na verify: scherm met fee + Stripe-knop.

d. Optie: abonnement €4,99/mnd voor onbeperkt. User.subscriptionStatus +
   User.subscriptionPlan in schema.

e. Admin bypass (jij) blijft via ADMIN_EMAILS.

f. Tests:
   - `tests/fee-calc.test.ts` — 20% × savings, cap €50, floor €2
   - `tests/charge-on-verify.test.ts` — verified triggers fee
   - `tests/admin-bypass.test.ts` — admin krijgt geen fee

g. Update copy op `/prijs` als die nog 20% zegt → laten staan. Als 'ie 10% zegt
   → naar 20% updaten.

h. Commit: `feat(pricing): 20% no-cure-no-pay fee on verified savings only`.

---

## DEEL 8 — Anti-fraud + audit logging

a. `lib/fraud-detection.ts`:
   ```ts
   export function suspicionScore(user: User): { score: number; reasons: string[] }
   ```
   Factors:
   - >5 negotiations 30d met SUCCESS_UNVERIFIED (+30)
   - Multiple bills met zelfde imageHash maar verschillende provider (+50)
   - 100% claims zonder bewijs (+25)
   - Disposable email-domain (+40)

b. Prisma `FraudFlag`:
   ```prisma
   model FraudFlag {
     id        String @id @default(cuid())
     userId    String
     score     Int
     reasons   String @db.Text
     resolved  Boolean @default(false)
     createdAt DateTime @default(now())
     @@index([userId])
     @@index([resolved])
   }
   ```

c. `/api/cron/fraud-check` dagelijks 11:00 — loop alle users, log FraudFlag
   bij score >50.

d. `/admin/fraud/page.tsx`: lijst flagged users, klik voor detail, manual
   override (unflag of suspend).

e. Nieuw veld `User.suspendedAt`. Bij suspended: kan inloggen maar ziet
   "Account onder review", geen nieuwe uploads.

f. Tests:
   - `tests/fraud-score.test.ts` — 6 test-users met patterns
   - `tests/admin-suspend.test.ts` — admin kan pauzeren

g. Commit: `feat(fraud): suspicion scoring + admin review panel`.

---

## DEEL 9 — Smoke 45 + STATUS_V13 + MANUAL_SETUP

a. `scripts/smoke-prod.ts` → 45 checks:
   - 1-40 bestaande
   - 41. POST `/api/inbound/router` zonder HMAC → 401
   - 42. POST `/api/inbound/router` met `[NEGOTIATION-X]` HMAC OK → 200
   - 43. POST `/api/inbound/proof` met `[PROOF-X]` HMAC OK → 200
   - 44. Upload Eneco multi-page PDF fixture → provider+amount extracted
   - 45. `/admin/fraud` (admin auth) → 200, geen 500

b. Run smoke, plak output in commit.

c. `STATUS_V13.md` per deel commit-hash + 1-regel resultaat.

d. **MANUAL_SETUP_REQUIRED.md** definitieve checklist:
   - Resend inbound MX voor `auto.degeldheld.com` + `bewijs.degeldheld.com`
   - Webhook URLs: `/api/inbound/router` (auto) + `/api/inbound/proof` (bewijs)
   - Env: `RESEND_INBOUND_SECRET`, `RESEND_PROOF_WEBHOOK_SECRET`
   - Stripe Product: "Verified savings fee" (variabel bedrag)
   - Feature-flag activatie wanneer Resend inbound werkt: `FEATURE_AUTO_PINGPONG=true`,
     `FEATURE_PROOF_REQUIRED=true`, `FEATURE_NO_CURE_NO_PAY=true`

e. Commit: `docs(v13): smoke 45 + status + manual setup checklist`.

---

## Done-criteria

- [ ] Counter-mail bevat geen system-prompt instructie meer
- [ ] Counter-mail signature heeft 1 naam + 1 email, geen dubbele
- [ ] BE-bill counter-mail noemt BE-provider (geen Iberdrola)
- [ ] Groq LLM heeft 3-retry + Sentry logging
- [ ] Eneco jaarafrekening (9-pagina PDF) → OCR pakt provider + bedrag
- [ ] KPN-mail gebruikt "Geachte heer/mevrouw" + u-vorm
- [ ] Bunq-mail gebruikt "Hoi" + jij-vorm
- [ ] Energie-mail bevat "kWh" of "voorschot"
- [ ] Auto-pingpong route bestaat + werkt achter feature-flag
- [ ] User claimt succes alleen MET bewijs
- [ ] /proof totaal toont alleen verified savings
- [ ] 30d cron stuurt reminder + verifieert nieuwe factuur auto
- [ ] Fee = 20% bij verified savings >€25/jaar
- [ ] Admin bypass werkt (jij betaalt nooit)
- [ ] /admin/fraud toont flagged accounts
- [ ] Smoke 45/45 groen

## Eindrapportage

```
MEGA_SPRINT_V13 — Final report

DEEL 1  ✓ <hash> — 4 bugs gefixt
DEEL 2  ✓ <hash> — multi-page PDF, Eneco fixture pass
DEEL 3  ✓ <hash> — provider-tone matching + vocab
DEEL 4  ✓ <hash> — auto-pingpong achter feature-flag
DEEL 5  ✓ <hash> — proof-flow + inbound webhook
DEEL 6  ✓ <hash> — 30-day recheck cron
DEEL 7  ✓ <hash> — 20% no-cure-no-pay live
DEEL 8  ✓ <hash> — fraud-scoring + admin panel
DEEL 9  ✓ <hash> — smoke 45/45, MANUAL_SETUP updated
```

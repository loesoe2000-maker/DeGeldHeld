# DeGeldHeld v11 — Revenue verification + bug-jacht

Zes deelfasen. ~6–10 uur. Eén commit per fase.

Lost twee dingen tegelijk op:
- **A. Bug-jacht**: 4 zichtbare bugs in de huidige multi-round flow
- **B. Revenue integrity**: hoe verifiëren we dat een user écht heeft bespaard
  voordat we hen een fee in rekening brengen (zonder bank-login)

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/REVENUE_VERIFICATION_SPRINT.md en voer alle zes deeltaken uit in volgorde. Per deeltaak: implementeer, tests, `npx tsc --noEmit`, `npm test -- --run`, commit + push. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 25 min: TODO-commit en door. Migraties: lokaal `prisma migrate dev`, daarna `npx prisma migrate deploy`.
```

---

## DEEL 1 — Bug-jacht: 4 directe fixes

Vier productie-zichtbare bugs in de multi-round counter-mail flow:

a. **Instructie-bleed in counter-mail body**. Live screenshot toonde dat de tekst
   "Dit is ronde 1 van de onderhandeling. De provider's vorige aanbod was..." in
   de geprinte body terechtkwam. Dat is een system-prompt-instructie die per
   ongeluk in de output zit.

   Locatie: `lib/rounds.ts` heuristic-fallback (gebruikt wanneer Groq LLM faalt).
   Fix: maak `buildCounterFromHeuristic()` die de stricte template-vorm gebruikt
   zonder instructie-prefix. Eindresultaat is leesbare provider-mail, niet meta-tekst.

b. **Llama 3.3 LLM faalt → fallback geactiveerd**. Counter-mail toonde
   "Heuristische analyse (LLM niet beschikbaar)". Onderzoek:
   - `lib/rounds.ts` `analyseProviderResponse()` — log de Groq error
   - Check of `llama-3.3-70b-versatile` in de Groq block-list staat (zou niet
     moeten — model staat als toegestaan op free tier)
   - Voeg betere retry-logic toe: 3 retries met exponential backoff (1s, 3s, 8s)
   - Bij definitieve fail: log naar Sentry zodat we 't zien, val terug op heuristic

   Hint: zoek in commit-history naar het feit dat de Groq-block-list mogelijk 3.3
   per ongeluk includeert. De block-list staat in Groq Console (niet in code), maar
   we kunnen wel een health-check toevoegen die bij startup een ping doet.

c. **Dubbele email in signature**. Counter-mail eindigde met:
   ```
   Met vriendelijke groet,
   basheling@icloud.com
   basheling@icloud.com
   ```
   Beide regels zijn dezelfde value. Fix in `lib/negotiator.ts` fallbackTemplate:
   - `customerName` mag niet automatisch = `customerEmail` zijn
   - Als `user.name` null is: gebruik `email.split("@")[0]` → "basheling"
   - Signature: line1 = naam (of capitalize'd email-prefix), line2 = full email

d. **BE-factuur krijgt ES/FR provider in counter-mail**. Eerdere screenshot toonde
   "Iberdrola biedt momenteel Plan Estable aan voor €95,00 per maand". Iberdrola
   levert niet in BE. Dit is dezelfde bug als CATEGORIES_CLEANUP_SPRINT v10 DEEL 1
   — verplaats die fix naar voren:
   - `buildComparison()` filter op `bill.country`
   - Voor BE energie: minimaal Engie BE, Luminus, TotalEnergies BE in `lib/providers.ts`
   - Voor ALLE landen × categorieën die we ondersteunen: minimaal 3 echte providers,
     verifieer via WebFetch

e. Tests:
   - `tests/counter-mail-clean.test.ts` — counter-mail body bevat geen "Dit is ronde"
   - `tests/counter-mail-signature.test.ts` — geen dubbele regels in signature
   - `tests/counter-mail-country.test.ts` — BE bill → counter noemt BE provider

f. Commit: `fix(rounds): clean counter-mail body + country-filtered alternatives + Groq retry`.

---

## DEEL 2 — Provider-bevestigings-mail forward flow

Doel: voordat een user "€X bespaard" kan claimen, moet hij **één bewijsstuk**
forwarden. Geen bewijs = geen fee = niet op /proof.

a. Prisma migratie `outcome_proof`:
   ```prisma
   model OutcomeProof {
     id              String   @id @default(cuid())
     negotiationId   String
     kind            String   // "forwarded_email" | "new_bill" | "screenshot" | "manual"
     storageUrl      String?
     parsedAmountCents Int?   // wat AI extraheerde uit het bewijs
     verifiedAt      DateTime?
     verificationStatus String @default("pending") // pending | verified | rejected | manual_review
     verifierNote    String?  @db.Text
     createdAt       DateTime @default(now())
     negotiation Negotiation @relation(fields: [negotiationId], references: [id], onDelete: Cascade)
     @@index([negotiationId])
   }
   ```
   Plus op `Negotiation`: `proofRequired Boolean @default(true)`,
   `proofVerifiedAt DateTime?`.

b. Op `/onderhandel/[billId]/uitkomst` page: bij selectie "Geslaagd" en bedrag
   invoeren, **vraag direct om bewijs**:
   - "Forward de bevestigingsmail van je provider naar `bewijs@degeldheld.com`"
   - Of: "Upload screenshot van je nieuwe factuur"
   - Of: "Sla over, claim wordt niet geverifieerd" — disclaimer dat
     besparing niet op /proof verschijnt en geen fee in rekening wordt gebracht

c. `/api/inbound/proof/route.ts`:
   - Resend inbound webhook (HMAC-verified)
   - Match from-address tegen User.email
   - Subject-pattern: `[PROOF-{negotiationId}]` of forward-detection via
     `In-Reply-To` matching Negotiation thread
   - Run `extractBill()` op attachments + tekst
   - Match: nieuwe bedrag in mail < oude `Bill.amountCents` met >5% verschil
   - Bij match: `verificationStatus = "verified"`, set `proofVerifiedAt`
   - Bij geen match: `verificationStatus = "rejected"`, mail user "Bewijs niet
     herkend — upload alternatief"

d. `/api/outcome/[id]/proof/route.ts` (POST):
   - Direct upload van bewijs via formulier (image/pdf)
   - Run extractBill + comparison logic
   - Sla op als OutcomeProof + update Negotiation.proofVerifiedAt

e. Verkrijg `Negotiation.actualSavingsCents` **alleen** uit `proofVerifiedAt`-flow:
   - Als bewijs verified: gebruik parsedAmountCents diff
   - Als geen bewijs: actualSavingsCents blijft `null`, state = "SUCCESS_UNVERIFIED"
   - Nieuwe state-enum value: `SUCCESS_UNVERIFIED` (= user claimt success maar geen bewijs)

f. Update `/proof` page: alleen `state in {SUCCESS, BILLED, ACCEPTED}` (verified) telt
   mee voor `totalSavedCents`. SUCCESS_UNVERIFIED toont apart als
   "X claims niet geverifieerd" voor transparantie.

g. Tests:
   - `tests/proof-flow.test.ts`: forward mail matched → verified
   - `tests/proof-rejected.test.ts`: forward mail zonder match → rejected
   - `tests/proof-skip.test.ts`: user kiest skip → state = SUCCESS_UNVERIFIED

h. Commit: `feat(proof): mandatory verification before claim counts as savings`.

---

## DEEL 3 — Voor-en-na factuur diff + automatisch detection

Doel: één maand na onderhandeling, herinner user om nieuwe factuur te uploaden.
Wij vergelijken bedragen, verifieren automatisch.

a. `/api/cron/recheck-savings/route.ts` (cron, dagelijks 09:30):
   - Selecteer Negotiations met state=EMAIL_SENT of state=COUNTER_SENT, 28-35 dagen oud
   - Stuur user mail: "Hé, ontvang je nu al je nieuwe Eneco-factuur? Upload 'm zodat
     we kunnen verifiëren of je daadwerkelijk bespaard hebt."
   - Link naar `/onderhandel/[billId]/herupload?as=proof`

b. Wanneer user nieuwe factuur uploadt via `?as=proof=1`:
   - Run normale upload-flow + OCR
   - Match nieuwe Bill aan oude Bill via provider + user
   - Bereken `actualDelta = oldBill.monthlyCents - newBill.monthlyCents`
   - Als `actualDelta > 100` (>€1 verschil): markeer als verified savings
   - Sla op als OutcomeProof met kind="new_bill", parsedAmountCents = actualDelta * 12

c. Update Negotiation: state = SUCCESS, actualSavingsCents = delta * 12.

d. Update `/dashboard`: per Negotiation een chip "Verifieer bewijs →" als
   `proofVerifiedAt` null is.

e. Tests:
   - `tests/recheck-cron.test.ts`: 30d oude negotiation → reminder mail
   - `tests/before-after-diff.test.ts`: oude €174 + nieuwe €120 → savings = (174-120)*12 = €648

f. Commit: `feat(proof): before/after invoice diff verifies savings automatically`.

---

## DEEL 4 — Pricing flow herziening: charge-on-verified-success

Huidige: paywall na 1e gratis bill. Probleem: user betaalt voor analyse, geen
correlatie met succes.

Beter: **eerste 3 gratis. Daarna no-cure-no-pay: 10% van geverifieerde besparing.**

a. Update `lib/payments.ts`:
   - `requiresPayment()` returnt nu altijd false voor analyse-fase
   - Nieuwe functie `feeForVerifiedSavings(actualSavingsCents)`:
     - Return 10% van actualSavingsCents, capped op €25, min €2
   - Trigger fee-charge alleen wanneer `Negotiation.proofVerifiedAt` is gezet AND
     `actualSavingsCents > 5000` (= €50/jaar minimum drempel)

b. Nieuwe state `BILLED_PENDING_PAYMENT`:
   - Bij proof-verify trigger Stripe Checkout session
   - Email user: "Je bespaarde €X. Onze fee is €Y. Betaal binnen 14 dagen om je
     onderhandeling officieel af te ronden."
   - 14 dagen geen betaling → state = BILLED_OVERDUE, no future negotiations toegestaan

c. Op `/onderhandel/[billId]/uitkomst` na verify: scherm "Je bespaarde €X. Onze
   bijdrage was €Y. Wil je nu de fee betalen?" met grote Stripe-knop.

d. Optie voor user: **abonnement €4,99/maand voor onbeperkt**. Toon als alternatief.
   Database: User.subscriptionStatus + User.subscriptionPlan.

e. Voor admins (jij): bypass blijft via ADMIN_EMAILS. Geen fee, geen drempel.

f. Tests:
   - `tests/fee-calc.test.ts`: 10% logic + cap + floor
   - `tests/charge-on-verify.test.ts`: verified savings triggers fee
   - `tests/skip-low-savings.test.ts`: <€50/jaar geen fee
   - `tests/admin-bypass.test.ts`: admin krijgt geen fee

g. Commit: `feat(pricing): no-cure-no-pay 10% fee on verified savings only`.

---

## DEEL 5 — Anti-fraud + audit logging

Doel: detect en log verdachte patterns (multiple negotiations met "succes"
zonder bewijs, dezelfde bill 5× ge-upload, etc.)

a. `lib/fraud-detection.ts`:
   ```ts
   export function suspicionScore(user: User): {
     score: number;        // 0-100
     reasons: string[];
   }
   ```
   Factors:
   - >5 negotiations in 30 dagen met state=SUCCESS_UNVERIFIED (+30 punten)
   - Multiple bills met zelfde imageHash maar gemarkeerd als "verschillende provider" (+50)
   - Geen bewijs in 100% van claims (+25)
   - Email-domain in known disposable-list (+40)

b. Cron `/api/cron/fraud-check`: dagelijks loop alle users, log naar
   `FraudFlag` table bij score >50:
   ```
   model FraudFlag {
     id        String @id @default(cuid())
     userId    String
     score     Int
     reasons   String @db.Text
     resolved  Boolean @default(false)
     createdAt DateTime @default(now())
   }
   ```

c. `/admin/fraud/page.tsx`: lijst van flagged users, klik voor detail, manual
   override om unflag of account suspend.

d. Bij suspend (User.deletedAt of nieuwe `User.suspendedAt`): user kan inloggen,
   ziet "Account onder review — neem contact op". Geen nieuwe uploads.

e. Tests:
   - `tests/fraud-score.test.ts`: 6 test-users met verschillende patterns
   - `tests/admin-suspend.test.ts`: admin kan user pauzeren

f. Commit: `feat(fraud): suspicion scoring + admin review panel`.

---

## DEEL 6 — Smoke 40 + STATUS_V11

a. `scripts/smoke-prod.ts` → 40 checks:
   - 1-35 bestaande
   - 36. POST `/api/inbound/proof` zonder HMAC → 401
   - 37. POST `/api/inbound/proof` met geldige HMAC + match → 200 + OutcomeProof created
   - 38. GET `/onderhandel/[id]/uitkomst` (auth) bevat "Forward de bevestigingsmail"
   - 39. POST `/api/outcome/[id]/proof` met fake file → 400 of 200 met rejected status
   - 40. `/admin/fraud` (admin auth) → 200, geen 500

b. Run smoke, plak output.

c. `STATUS_V11.md`:
   - DEEL 1: bugs gefixt — namen X test-fixtures
   - DEEL 2: proof-flow live, feature-flag `FEATURE_PROOF_REQUIRED=true`
   - DEEL 3: before/after diff cron actief
   - DEEL 4: no-cure-no-pay pricing live (achter flag tot 5 echte tests)
   - DEEL 5: fraud-scoring cron + admin panel
   - DEEL 6: smoke 40/40

d. **MANUAL_SETUP_REQUIRED.md** uitbreiden:
   - Resend inbound webhook voor `bewijs@degeldheld.com`
   - MX record voor `bewijs.degeldheld.com`
   - Env: `RESEND_PROOF_WEBHOOK_SECRET`
   - Stripe Product: "Verified savings fee" (variabel bedrag)

e. Commit: `docs(v11): smoke 40 + status + manual setup expanded`.

---

## Done-criteria

- [ ] Counter-mail bevat geen system-prompt instructie meer
- [ ] Counter-mail signature heeft geen dubbele email
- [ ] BE-bill counter-mail noemt BE-provider (geen Iberdrola)
- [ ] Groq LLM heeft 3-retry + Sentry logging, fallback alleen na 3 failures
- [ ] User kan succes claimen alleen MET bewijs (forward of upload)
- [ ] /proof totaalbedrag toont alleen verified savings
- [ ] Cron stuurt 30d-na-onderhandel reminder mail voor nieuwe factuur
- [ ] Fee wordt pas getriggerd bij proofVerifiedAt + savings >€50/jaar
- [ ] Admin bypass werkt (jij betaalt nooit)
- [ ] /admin/fraud toont 0 of meer flagged accounts

## Eindrapportage

```
REVENUE_VERIFICATION_SPRINT v11 — Final report

DEEL 1  ✓ <hash> — 4 bugs gefixt
DEEL 2  ✓ <hash> — proof-flow + inbound webhook
DEEL 3  ✓ <hash> — before/after diff cron live
DEEL 4  ✓ <hash> — no-cure-no-pay pricing
DEEL 5  ✓ <hash> — fraud-scoring + admin panel
DEEL 6  ✓ <hash> — smoke 40/40, manual-setup updated
```

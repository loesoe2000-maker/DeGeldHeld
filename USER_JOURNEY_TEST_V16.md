# DeGeldHeld v16 — User-Journey Test Sprint

Test élke stap die een eerste echte gebruiker doet, vanaf landen op de homepage
tot eerste verifieerbare besparing. Bij élke fout: fix in dezelfde commit.

Doel: **niets stuk wat een new-user tegenkomt**.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/USER_JOURNEY_TEST_V16.md en voer alle acht deeltaken uit in volgorde. Per deeltaak: implementeer test, run het tegen productie (https://degeldheld.com), bij fail: fix de code, run test opnieuw tot groen, commit + push. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 25 min: TODO-commit en door.
```

---

## DEEL 1 — Stap 1: Landen op homepage

Test: `https://degeldheld.com/` laadt voor anonymous user.

a. `tests/e2e/journey-1-landing.spec.ts` (Playwright):
   - GET `/` → status 200
   - Hero-tekst zichtbaar binnen 2s
   - CTA-knop "Probeer met je eigen factuur" of vergelijkbaar aanwezig
   - Activity-feed widget zichtbaar (v15)
   - Geen JS-errors in console

b. Mobiel-test (iPhone viewport): zelfde checks op 375×812.

c. Lighthouse score: ≥85 Performance, ≥95 A11y.

d. Bij fout: fix in `app/page.tsx` of `components/Hero.tsx` tot test groen.

e. Commit: `test(journey): step 1 landing — page loads + CTA + activity feed`.

---

## DEEL 2 — Stap 2: Anonymous upload zonder login

Test: anonymous user upload werkt end-to-end.

a. `tests/e2e/journey-2-anon-upload.spec.ts`:
   - GET `/onderhandel` (geen cookie) → 200, upload-form zichtbaar
   - Upload `tests/fixtures/kpn-sample.png` via `setInputFiles`
   - Wacht max 30s op redirect naar `/onderhandel/analyse?bill=...`
   - Verifieer: anonymousSessionId cookie is gezet (`dgh_anon_session`)
   - Verifieer: Bill in DB heeft `userId=null` en juist `anonymousSessionId`

b. Edge cases testen:
   - 4e upload binnen 1 uur → 429 (rate-limit werkt)
   - Upload zonder file → 400 met heldere foutmelding
   - Upload van 11MB → 400 "Bestand te groot"

c. Bij fout: fix in `app/api/bills/upload/route.ts` of `components/BillUpload.tsx`.

d. Commit: `test(journey): step 2 anonymous upload + edge cases`.

---

## DEEL 3 — Stap 3: Analyse-pagina als anonymous

Test: anonymous user ziet besparing-card maar geen mail-knop.

a. `tests/e2e/journey-3-anon-analyse.spec.ts`:
   - Met anonymousSession cookie + valid billId
   - GET `/onderhandel/analyse?bill={id}` → 200
   - Verifieer: provider-naam zichtbaar
   - Verifieer: besparing-card met €-bedrag
   - Verifieer: markt-range chart
   - Verifieer: 3 alternatieven
   - Verifieer: **email-prompt CTA zichtbaar** (niet "Genereer mail" knop)
   - Verifieer: GEEN actieknop die login vereist

b. Test stale-banner (oude factuur >180 dagen):
   - Upload fixture met period 2024-01
   - Verifieer: amber banner "X maanden oud" verschijnt

c. Test one-time-items banner:
   - Upload KPN-fixture met €4,99 eenmalige post
   - Verifieer: blauwe banner "factuur bevat €4,99 aan eenmalige posten"

d. Bij fout: fix in `app/onderhandel/analyse/page.tsx`.

e. Commit: `test(journey): step 3 anonymous analyse + banners`.

---

## DEEL 4 — Stap 4: Email-prompt → magic-link

Test: anonymous user vult email in → ontvangt magic-link.

a. `tests/e2e/journey-4-email-prompt.spec.ts`:
   - Op `/onderhandel/analyse` met anonymous bill
   - Vul email in: `test+{timestamp}@degeldheld-test.com`
   - Klik "Stuur de mail →"
   - Verifieer: Resend API werd aangeroepen (mock of test-mailbox)
   - Verifieer: success-melding "Check je inbox"
   - Verifieer: anonymousSessionId blijft in cookie staan (voor latere claim)

b. Mock Resend in test-env via `RESEND_API_KEY_TEST=re_test_...`.
   Echte productie-test: gebruik Resend Inbound test-endpoint of MailHog.

c. Edge cases:
   - Email zonder @ → validation error
   - Disposable-email domain → optional reject
   - Bestaande user-email → bestaande user-flow (geen nieuwe user)

d. Bij fout: fix in `app/api/auth/anon-magic-link/route.ts` (of vergelijkbaar).

e. Commit: `test(journey): step 4 email prompt + magic-link dispatch`.

---

## DEEL 5 — Stap 5: Magic-link klikken → signup + claim

Test: klikken op magic-link → automatic signup + anonymous bill geclaimed.

a. `tests/e2e/journey-5-signup-claim.spec.ts`:
   - Genereer magic-link token (via NextAuth helper of direct DB-insert)
   - GET `/api/auth/callback/resend?token=...&email=...`
   - Verifieer: redirect naar `/onderhandel/email?bill={id}`
   - Verifieer: User created in DB
   - Verifieer: Bill heeft nu `userId` gezet + `claimedAt` stempel
   - Verifieer: `anonymousSessionId` is `null` na claim
   - Verifieer: cookie `dgh_anon_session` is verwijderd

b. Edge case: user die al ingelogd is + nog anonymous bill heeft → claim
   gebeurt automatisch bij volgende pageview.

c. Bij fout: fix in NextAuth callbacks of `lib/auth-callbacks.ts`.

d. Commit: `test(journey): step 5 magic-link signup + auto-claim`.

---

## DEEL 6 — Stap 6: Onderhandel-mail genereren

Test: logged-in user op /onderhandel/email krijgt LLM-gegenereerde mail.

a. `tests/e2e/journey-6-email-gen.spec.ts`:
   - Met auth-cookie + valid billId
   - GET `/onderhandel/email?bill={id}` → 200
   - Verifieer: onderwerp aanwezig (>5 chars, bevat provider-naam)
   - Verifieer: body aanwezig (>150 woorden, bevat klantnummer indien aanwezig)
   - Verifieer: GEEN system-prompt instructie in body ("Dit is ronde X..." → fail)
   - Verifieer: GEEN dubbele email in signature
   - Verifieer: tone-matching werkt (KPN = formeel, Bunq = informeel)
   - Verifieer: kopieer-knop werkt, WhatsApp-share-knop werkt
   - Verifieer: "Ik kreeg antwoord →" CTA aanwezig

b. Voor 3 verschillende providers test (KPN, Eneco, Bunq) om tone-variation
   te valideren.

c. Bij fout: fix in `lib/negotiator.ts` of `app/onderhandel/email/page.tsx`.

d. Commit: `test(journey): step 6 email generation + tone matching`.

---

## DEEL 7 — Stap 7: Multi-round counter-mail

Test: user plakt provider-antwoord → AI analyseert → counter-mail.

a. `tests/e2e/journey-7-counter-mail.spec.ts`:
   - Met auth-cookie + valid billId met state=EMAIL_GEN
   - GET `/onderhandel/{billId}/ronde/1` → 200
   - Plak fake KPN-antwoord (constructief, €3 korting bod)
   - Klik "Analyseer + genereer counter"
   - Verifieer: analyse-chips correct (Biedt €X, Tone constructief)
   - Verifieer: counter-mail body bevat het geboden bedrag expliciet
   - Verifieer: counter-mail vraagt om verdere verlaging
   - Verifieer: 3 actie-knoppen (Verstuur counter / Akkoord / Stop)
   - Verifieer: NegotiationRound in DB met juiste data

b. Test alle 3 paden:
   - Constructief antwoord → counter
   - Afwijzend → walk-away advies
   - Stalling → escalate advies

c. Bij fout: fix in `lib/rounds.ts` of `app/onderhandel/[billId]/ronde/[n]/page.tsx`.

d. Commit: `test(journey): step 7 multi-round response analysis + counter`.

---

## DEEL 8 — Stap 8: Uitkomst markeren + bewijs-flow

Test: user markeert success → vraagt bewijs → fee-trigger (in test-mode).

a. `tests/e2e/journey-8-outcome-proof.spec.ts`:
   - Met auth-cookie + valid billId
   - GET `/onderhandel/{billId}/uitkomst` → 200
   - Klik "Geslaagd" knop
   - Vul nieuw maandbedrag in (€22 vs oude €30)
   - Verifieer: Negotiation.state = SUCCESS_UNVERIFIED (proof niet binnen)
   - Verifieer: bewijs-CTA zichtbaar "Forward naar bewijs@degeldheld.com"
   - Verifieer: /proof toont deze NOG niet als verified (correct)

b. Simuleer bewijs-binnenkomst:
   - Mock Resend inbound webhook payload met juiste signature
   - POST `/api/inbound/proof` met match op billId
   - Verifieer: Negotiation.proofVerifiedAt gezet
   - Verifieer: actualSavingsCents gevuld
   - Verifieer: /proof telt deze nu wel mee als verified

c. Bij Stripe-fee in test-mode:
   - Verifieer: feeForVerifiedSavings(savings) returnt juiste bedrag
   - Verifieer: BILLED_PENDING_PAYMENT state na proof verify
   - Verifieer: ADMIN bypass werkt (jij krijgt geen fee)

d. Commit: `test(journey): step 8 outcome + proof verification + fee trigger`.

---

## DEEL 9 — Bonus: dashboard + share-flow

a. `tests/e2e/journey-9-dashboard.spec.ts`:
   - GET `/dashboard` met auth-cookie → 200
   - Verifieer: totale bespaard zichtbaar
   - Verifieer: lijst van bills (met seed-cases als basis)
   - Verifieer: status-badges kloppen (lopend/voltooid/gefaald)
   - Verifieer: "Verifieer bewijs →" chip op niet-verified successes

b. Test share-flow vanaf success:
   - GET `/onderhandel/{billId}/uitkomst` met state=SUCCESS
   - Verifieer: share-kit zichtbaar (WhatsApp, X, LinkedIn, IG Story PNG)
   - Klik IG Story PNG link
   - Verifieer: `/api/og/share?saved=X&provider=Y` returnt 1080×1920 PNG

c. Bij fout: fix dashboard of share-flow.

d. Commit: `test(journey): step 9 dashboard + share kit`.

---

## DEEL 10 — Aggregate smoke + rapport

a. Run alle 9 journey-tests achter elkaar:
   ```bash
   npx playwright test tests/e2e/journey-*.spec.ts
   ```
   Alle moeten groen.

b. Genereer `USER_JOURNEY_REPORT.md`:
   - Per stap: pass/fail
   - Per stap: tijd-tot-completion
   - Per stap: gevonden bugs + commit-hash van fix
   - Totale TTFE (time-to-first-experience): hoe lang van landing naar besparing-zien?
     Doel: <60 seconden voor anonymous user.

c. Update `RUNBOOK.md` met "User-journey verificatie":
   - Hoe deze tests draaien
   - Wat te doen bij regressie
   - Hoe nieuwe journey-stappen toevoegen

d. Commit: `docs(v16): user journey verified, X bugs fixed, TTFE Yms`.

---

## Done-criteria

- [ ] Alle 9 journey-tests groen tegen productie
- [ ] TTFE (anonymous landing → besparing zien) < 60 seconden
- [ ] Geen JS-errors in browser console tijdens hele flow
- [ ] Mobiel viewport: alle stappen werken
- [ ] Lighthouse Performance ≥85, A11y ≥95 op hoofdpaden
- [ ] Bug-count gevonden en gefixt: gerapporteerd in USER_JOURNEY_REPORT.md

## Eindrapportage

```
USER_JOURNEY_TEST_V16 — Final report

DEEL 1  ✓ <hash> — landing + activity feed + Lighthouse ≥85
DEEL 2  ✓ <hash> — anonymous upload + rate limits + edge cases
DEEL 3  ✓ <hash> — anonymous analyse + banners
DEEL 4  ✓ <hash> — email prompt + magic-link dispatch
DEEL 5  ✓ <hash> — magic-link signup + auto-claim
DEEL 6  ✓ <hash> — email generation + tone matching across 3 providers
DEEL 7  ✓ <hash> — multi-round all 3 response types
DEEL 8  ✓ <hash> — outcome + proof verification + fee trigger
DEEL 9  ✓ <hash> — dashboard + share kit
DEEL 10 ✓ <hash> — full journey TTFE = Xs, Y bugs fixed
```

**Productie-staat na deze sprint: élke flow die een echte gebruiker
doorloopt is getest, gemeten en hardened.**

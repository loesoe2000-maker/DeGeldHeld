# DeGeldHeld v8 — Post-v7 Sprint: TIER 1+ selectie

Zes deelfasen — TIER 1 (#1, #2, #3) volledig live + TIER 2 (#5 PSD2) en
TIER 3 (#12 real-time, #13 OCR fine-tuning) als **foundations** zodat ze klaar
zijn voor handmatige externe setup (Tink-account, WhatsApp Business approval,
dataset labeling) zonder dat je dan nog code hoeft te schrijven.

Geschat: 8–12 uur Claude Code + ~2–4 uur handmatige externe accounts/approvals.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/AFTER_V7_SPRINT.md en voer alle zes deeltaken uit in volgorde. Per deeltaak: implementeer, tests, `npx tsc --noEmit`, `npm test -- --run`, commit + push. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 20 min: TODO-commit + door. Migraties: lokaal `prisma migrate dev`, daarna `npx prisma migrate deploy`. Bij externe afhankelijkheden (Tink, WhatsApp Business, training datasets): bouw de code-kant volledig af en log in MANUAL_SETUP_REQUIRED.md wat de user nog handmatig moet aanmaken.
```

---

## Hoofdregels

- Alleen Groq models die je free-tier toestaat: `llama-3.3-70b-versatile` (text)
  en `meta-llama/llama-4-scout-17b-16e-instruct` (vision).
- Alle nieuwe DB-velden optional met sensible default.
- Voor externe services: gebruik **feature-flag in env** (bv `PSD2_ENABLED=false`)
  zodat code niet breekt voor users zonder die service.
- Maak en update een `MANUAL_SETUP_REQUIRED.md` met élke externe stap die de
  user zelf moet doen (account-aanmaken, API-keys, webhook-registratie).

---

## DEEL 1 — Email-forward inbox (`inbox@degeldheld.com`)

**Doel**: user forward factuur via mail → automatisch OCR → analyse-link
terug. Zero-friction upload-vervanger.

a. `/api/inbound/route.ts` (POST):
   - Resend inbound webhook payload (HMAC-verified via `RESEND_WEBHOOK_SECRET`)
   - Extract: from-address, attachments (image of PDF), subject, body-text
   - Identificeer user op from-address:
     - Match in User.email → gebruik die userId
     - Geen match → reply mail "We konden je niet vinden — registreer op
       degeldheld.com en stuur opnieuw"
   - Voor élke attachment: roep bestaande `extractBill()` + `prisma.bill.create()`
   - Stuur reply via Resend met:
     - "We zagen je {provider}-factuur van €{bedrag}"
     - "Bekijk je analyse: degeldheld.com/onderhandel/analyse?bill={id}"
     - "Of klik direct om de onderhandel-mail te genereren: …/email?bill={id}"

b. `lib/inbound.ts` met helpers: `verifyResendSignature`, `parseInboundPayload`,
   `userForFromAddress`, `replyTo`.

c. Resend setup-instructies in `MANUAL_SETUP_REQUIRED.md`:
   - Domain MX record voor `inbox.degeldheld.com` → Resend inbound
   - Webhook URL toevoegen: `https://degeldheld.com/api/inbound`
   - HMAC secret naar Vercel env als `RESEND_WEBHOOK_SECRET`

d. Per user: in `/dashboard` een box "Snelle upload via email" met
   pre-filled mailto-link: `mailto:inbox@degeldheld.com?subject=Mijn%20factuur`.

e. Tests `tests/inbound.test.ts`:
   - Geldige HMAC signature → 200 + Bill created
   - Ongeldige signature → 401
   - Unknown sender → mail-reply met registratie-link, geen DB-write
   - Geen attachments → 400

f. Commit: `feat(inbound): email forward to inbox@degeldheld.com triggers OCR`.

---

## DEEL 2 — Maandelijkse auto re-check + re-engagement mail

**Doel**: 30 dagen na laatste mail: opnieuw markt-check → als er nog €X extra
besparing zit, mail user "we vonden nog meer besparing".

a. Prisma op `Bill`: `lastRecheckAt DateTime?` + `nextRecheckAt DateTime?`
   (default `createdAt + 30 days`). Migratie `bill_recheck_schedule`.

b. `/api/cron/monthly-recheck/route.ts` (GET, vereist CRON_SECRET):
   - Selecteer bills waar `nextRecheckAt <= now()` AND user is actief
     (laatste login < 90 dagen)
   - Voor elke bill:
     1. Re-run buildComparison met huidige markt-data
     2. Bereken nieuwe `yearlySavingsCents`
     3. Als nieuwe > vorige + €60 (5/mnd minimum drempel):
        - Trigger nieuwe Negotiation met state=NIEUW
        - Stuur Resend-mail naar user: "Update: nieuwe markt-check op je
          {provider}-rekening — nu €X besparing mogelijk (was €Y)"
        - Link naar `/onderhandel/email?bill={id}&fromRecheck=1`
     4. Update `lastRecheckAt = now()`, `nextRecheckAt = now() + 30 days`

c. Voeg cron toe in `vercel.json` om 09:00 elke dag (`0 9 * * *`).

d. Resend-template: HTML + plain-text, max 200 woorden.

e. Per user: max 1 re-check mail per 7 dagen (anti-spam guard via DB query).

f. Frontend: op `/dashboard` per actieve bill een chip "Volgende check:
   {nextRecheckAt}" zodat user 't ziet aankomen.

g. Tests `tests/cron-recheck.test.ts`:
   - Bill ouder dan 30 dagen + significante delta → mail verstuurd, lastRecheckAt
     bijgewerkt
   - Bill <30 dagen → geen actie
   - Inactieve user (>90 dagen) → skip
   - Anti-spam guard: 2× run op 1 dag → tweede stuurt geen mail

h. Commit: `feat(recheck): monthly market re-check cron + re-engagement mail`.

---

## DEEL 3 — Bill cleanup + history-view + GDPR data export

**Doel**: user kan bills verwijderen, ziet historie per bill, kan al z'n data
exporteren (GDPR Article 20).

a. `/api/bills/[id]/route.ts` (DELETE):
   - Auth + ownership check
   - Cascade delete: NegotiationRound's + Negotiation + Bill
   - Soft-delete optioneel: zet `deletedAt` ipv echte delete (zo blijft /proof
     aggregaat kloppen, maar user ziet 't niet meer)

b. `/app/dashboard`: bij elke bill een delete-knop met confirm-modal
   "Weet je het zeker? Dit verwijdert ook de onderhandeling en alle rondes."

c. `/app/onderhandel/[billId]/historie/page.tsx`:
   - Toon timeline: bill upload → analyse → email gegen → ronde 1 → ronde 2 → uitkomst
   - Per stap: tijdstempel + samenvatting + (optioneel) link naar detail-view
   - Read-only — geen edits

d. `/api/account/export/route.ts` (GET, auth):
   - Verzamel: user + alle bills + negotiations + rounds + payments + waitlist + referrals
   - Strip imageHash + rawOcr (privacy)
   - Return als JSON download (`Content-Disposition: attachment; filename="dgh-export.json"`)

e. `/account/page.tsx`: pagina met:
   - "Download al je data" knop → /api/account/export
   - "Verwijder mijn account" — 2-step confirm, daarna cascade delete user
   - Lijst van actieve sessies
   - Email-voorkeuren (reminders aan/uit, re-check aan/uit)

f. Prisma op `User`: `notificationsEnabled Boolean @default(true)` +
   `deletedAt DateTime?`. Migratie `user_gdpr`.

g. Tests:
   - `tests/bill-delete.test.ts` — soft-delete cascade
   - `tests/export.test.ts` — JSON heeft alle expected keys, geen imageHash
   - `tests/account-deletion.test.ts` — user wordt soft-deleted, sessies invalid

h. Commit: `feat(gdpr): bill delete, history view, account export, full deletion`.

---

## DEEL 4 — PSD2 bank-integratie foundation (Tink)

**Doel**: code-kant volledig af zodat als user Tink-account aanmaakt het
direct werkt. Tink ondersteunt NL/BE/DE/FR/UK.

a. `npm install @tink/sdk-node --legacy-peer-deps` (of HTTP-client als geen
   officiële SDK).

b. `lib/psd2/tink.ts`:
   - Type `TinkProvider`, `TinkAccount`, `TinkTransaction`
   - `getAuthUrl(userId, redirectUri)` — genereert Tink Link-URL
   - `exchangeCode(code)` → access_token (per user, encrypted opgeslagen)
   - `listAccounts(userToken)` → user's bank accounts
   - `listTransactions(userToken, accountId, fromDate)` → last 90 days

c. `lib/psd2/detect-bills.ts`:
   - Input: array van TinkTransaction
   - Detect recurring monthly debits:
     * Group by counterparty-name + similar amount (±5%)
     * Min 2 occurrences in 90 days = recurring
   - Match counterparty naam met provider-registry (fuzzy)
   - Output: lijst potential `{provider, monthlyCents, category, lastSeen}`

d. Prisma: nieuw model `BankConnection`:
   ```
   model BankConnection {
     id              String   @id @default(cuid())
     userId          String
     bankName        String
     accessTokenEnc  String   @db.Text   // AES-encrypted Tink token
     refreshTokenEnc String?  @db.Text
     expiresAt       DateTime
     lastSyncAt      DateTime?
     status          String   @default("active")  // active | revoked | expired
     createdAt       DateTime @default(now())
     user User @relation(fields: [userId], references: [id], onDelete: Cascade)
   }
   ```
   Plus model `DetectedRecurring` voor gevonden vaste lasten die nog niet als
   Bill zijn geconverteerd.
   Migratie `psd2_foundation`.

e. `/api/psd2/connect/route.ts` (POST): returnt Tink auth-URL
f. `/api/psd2/callback/route.ts` (GET): handles Tink redirect, exchanges code,
   slaat encrypted token op
g. `/api/psd2/sync/route.ts` (POST): pull transacties, run detect-bills,
   sla DetectedRecurring op
h. `/api/cron/psd2-sync/route.ts`: dagelijkse cron die alle BankConnection
   synct (al feature-flag `PSD2_ENABLED=true`)
i. `/account/banks/page.tsx`: lijst gekoppelde banken + "Voeg bank toe" knop.
   Toon DetectedRecurring met "→ Maak hier een onderhandeling van" knop.

j. AES-helper `lib/crypto.ts` voor token-encryption (key uit `TOKEN_ENC_KEY`
   env var).

k. **MANUAL_SETUP_REQUIRED.md** uitbreiden:
   - Tink developer account aanmaken op tink.com
   - App registreren (NL/BE/DE/FR/UK scope)
   - Redirect URI: `https://degeldheld.com/api/psd2/callback`
   - Env vars naar Vercel: `TINK_CLIENT_ID`, `TINK_CLIENT_SECRET`, `TOKEN_ENC_KEY`
   - DPIA opstellen (verwerking financiële data is high-risk onder AVG)
   - Verwerkersovereenkomst met Tink ondertekenen
   - Pas dan `PSD2_ENABLED=true` zetten

l. Tests `tests/psd2/`:
   - `detect-bills.test.ts`: mock transacties, verwacht correct herkende
     KPN €25/mnd + Eneco €120/mnd
   - `crypto.test.ts`: encrypt → decrypt round-trip
   - `mock-tink.test.ts`: integration met mock Tink-response

m. Commit: `feat(psd2): Tink integration foundation — auto-detect recurring bills`.

---

## DEEL 5 — Real-time conversation: WhatsApp Business webhook + AI auto-respond

**Doel**: provider antwoordt via WhatsApp (op een nummer dat user heeft door-
gestuurd of waar wij de oorspronkelijke mail van gestuurd hebben) → wij
detecteren binnen 60s → AI genereert counter → **user krijgt push met
"voorgestelde counter, akkoord om te versturen?"** → na confirmation: verzonden.

Belangrijk: **AI mag NOOIT autonoom versturen.** Altijd user-confirmation
om juridische redenen.

a. `/api/inbound/whatsapp/route.ts`:
   - Verify Twilio/360dialog HMAC signature
   - Payload: from-number, body, optional media
   - Match from-number met `WhatsAppThread`-table (negotiationId → providerNumber)
   - Als match: append message naar `WhatsAppMessage` table
   - Trigger `analyzeProviderResponse()` (zelfde logic als ronde-flow)
   - Genereer counter via Llama 3.3
   - Push notification naar user (Resend mail + later: real WebPush)
   - **NIET versturen** — user moet expliciet bevestigen

b. Prisma: nieuwe modellen:
   ```
   model WhatsAppThread {
     id             String   @id @default(cuid())
     negotiationId  String   @unique
     providerNumber String
     ourNumber      String
     userPhoneNumber String  // user's nummer (voor doorsturen)
     status         String   @default("active")
     createdAt      DateTime @default(now())
     negotiation Negotiation @relation(fields: [negotiationId], references: [id])
     messages    WhatsAppMessage[]
   }
   model WhatsAppMessage {
     id        String   @id @default(cuid())
     threadId  String
     direction String   // inbound | outbound
     body      String   @db.Text
     mediaUrl  String?
     receivedAt DateTime @default(now())
     thread    WhatsAppThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
   }
   ```
   Migratie `whatsapp_conversations`.

c. `/onderhandel/[billId]/whatsapp/page.tsx`:
   - Activeer-knop: "Activeer WhatsApp tracking" → genereer thread, geef
     instructies "stuur deze mail naar provider als je hun nummer kent"
   - Live-view van messages
   - Per inbound: AI-counter preview met grote knop "Akkoord, verstuur"
   - Klik "Akkoord" → /api/outbound/whatsapp → verstuur via Twilio/360dialog

d. `/api/outbound/whatsapp/route.ts`:
   - Auth + thread ownership check
   - Verstuur message via Twilio API
   - Sla outbound message op
   - Vereist user-confirmation (dubbel-check via re-auth of CSRF-token).

e. **MANUAL_SETUP_REQUIRED.md** uitbreiden:
   - Twilio account + WhatsApp Business sandbox approval (1-2 weken)
   - Phone number registration via Meta Business
   - Webhook URL: `https://degeldheld.com/api/inbound/whatsapp`
   - Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`,
     `WHATSAPP_WEBHOOK_SECRET`
   - Compliance check: AI-genererde counter MOET user-confirmation hebben
     voordat verstuurd

f. Feature-flag: `WHATSAPP_ENABLED=false` default. Pas aan na Twilio-approval.

g. Tests `tests/whatsapp/`:
   - `inbound.test.ts`: HMAC verify + thread match + counter generation
   - `confirmation-required.test.ts`: outbound zonder user-token → 401
   - `analyze-response.test.ts`: 3 mock-replies → correct counter

h. Commit: `feat(whatsapp): provider conversation tracking + AI counter (user-confirm gate)`.

---

## DEEL 6 — OCR fine-tuning foundation: dataset collection pipeline

**Doel**: bouw de pipeline om geanonimiseerde NL-facturen te verzamelen voor
toekomstige fine-tuning. Trainen zelf doe je later handmatig op Replicate.

a. Prisma: nieuw model `OcrTrainingSample`:
   ```
   model OcrTrainingSample {
     id              String   @id @default(cuid())
     imageStorageUrl String              // S3/R2 URL of base64 in DB
     anonymizedJson  String   @db.Text   // ground-truth labels (geanonimiseerd)
     reviewed        Boolean  @default(false)
     reviewerUserId  String?
     billCategory    String
     country         String
     createdAt       DateTime @default(now())
   }
   ```
   Migratie `ocr_training`.

b. `lib/anonymizer.ts`:
   - Input: raw OCR text + structured extract
   - Strip: name, address, customerNumber, IBAN, phone, email (regex + replacements)
   - Replace met placeholders: `<NAME>`, `<ADDRESS>`, `<IBAN>`, etc.
   - Return: anonymized version

c. Bij élke succesvolle OCR (in `app/api/bills/upload/route.ts`):
   - Vraag user **opt-in toestemming** in `/account/page.tsx` (één checkbox:
     "Mag DeGeldHeld mijn geanonimiseerde facturen gebruiken voor AI-verbetering?")
   - Als opt-in: na OCR success → `OcrTrainingSample.create()` met anonymized data
   - Image niet opslaan in DB (te groot). Optie:
     1. **Recommended**: Vercel Blob Storage (free tier 1GB), URL opslaan
     2. **Fallback**: skip image, alleen ground-truth labels — minder
        bruikbaar voor vision fine-tuning maar wel voor text

d. `/admin/training/page.tsx` (basic auth via `ADMIN_TOKEN` env):
   - Lijst pending samples
   - Per sample: image preview + extracted JSON + edit-form om labels te
     corrigeren
   - "Mark reviewed" knop
   - Export-knop: dump reviewed samples als JSONL voor training

e. `scripts/export-training-dataset.ts`:
   - Query alle `reviewed=true` samples
   - Output JSONL bestand in formaat dat Replicate/HuggingFace accepteert:
     `{"image": "...", "messages": [{"role": "user", "content": [{"type": "image_url", ...}, {"type": "text", "text": "Extract..."}]}, {"role": "assistant", "content": "{...json...}"}]}`
   - Print instructie: "Upload dit bestand naar Replicate fine-tune endpoint
     voor llama-4-scout vision"

f. **MANUAL_SETUP_REQUIRED.md** uitbreiden:
   - Vercel Blob Storage activeren (free tier)
   - `BLOB_READ_WRITE_TOKEN` env var
   - Wacht tot je 500+ reviewed samples hebt (3-6 maanden organisch)
   - Pas dan exporten + uploaden naar Replicate ($200 training cost)
   - Resulting model → set als `GROQ_VISION_MODEL` env

g. Tests `tests/ocr-training/`:
   - `anonymizer.test.ts`: 10 inputs met PII → 100% gestript
   - `sample-collection.test.ts`: opt-in user → sample created; opt-out → niets
   - `export-format.test.ts`: JSONL klopt voor 5 samples

h. Commit: `feat(ocr-train): dataset collection pipeline with opt-in + anonymizer`.

---

## DEEL 7 — Smoke uitbreiding + MANUAL_SETUP_REQUIRED.md afronden

a. `scripts/smoke-prod.ts` uitbreiden naar 25 checks:
   - 1-20: bestaande
   - 21. `/account` (auth) → 200 met "Download al je data"
   - 22. `/account/banks` → 200 (toont "PSD2 nog niet geactiveerd" als flag uit)
   - 23. `/onderhandel/[billId]/historie` → 200 met timeline
   - 24. `/api/cron/monthly-recheck` zonder CRON_SECRET → 401
   - 25. GET `/api/account/export` (auth) → 200 met `Content-Disposition: attachment`

b. `MANUAL_SETUP_REQUIRED.md` definitief afronden met **prioritized lijst**:
   - **Direct activeerbaar (1 uur werk)**:
     1. Resend inbound webhook + MX record (#1 email-forward)
     2. Vercel Blob Storage activeren (#6 dataset collection)
   - **1-2 weken externe approval (begin nu)**:
     3. Twilio + WhatsApp Business approval (#5 real-time conv)
     4. Tink developer account + DPIA (#4 PSD2)
   - **Wacht op data, niet nu doen**:
     5. OCR fine-tune training (na 500+ samples, ~6 mnd)

c. Run smoke, plak output. Bij rood: STOP + fix in extra commit.

d. Update RUNBOOK met:
   - Nieuwe crons (`monthly-recheck`, `psd2-sync`)
   - Feature flags overzicht (`PSD2_ENABLED`, `WHATSAPP_ENABLED`)
   - Inbound webhook URLs voor Resend + Twilio
   - Incident response: wat te doen bij Tink-token expiry, WhatsApp ban,
     dataset deletion request

e. Commit: `docs(v8): smoke 25, manual setup guide, runbook with new ops`.

---

## Done-criteria

- [ ] Email naar `inbox@degeldheld.com` triggert OCR + reply (test met je eigen
  mail-adres)
- [ ] Op `/dashboard` chip "Volgende check: {datum}" op elke bill
- [ ] Bill verwijderen werkt + GDPR export download werkt
- [ ] `/account/banks` rendert (zonder Tink-account toont "nog niet geactiveerd")
- [ ] `/onderhandel/[id]/whatsapp` rendert + toont activate-knop
- [ ] `/account` heeft opt-in checkbox "AI-verbetering toestaan"
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Smoke 25/25 groen
- [ ] `MANUAL_SETUP_REQUIRED.md` heeft 5 duidelijke stappen met checkbox-status

## Eindrapportage

```
AFTER_V7_SPRINT v8 — Final report

DEEL 1  ✓ <hash> — email-forward live, Resend webhook ready
DEEL 2  ✓ <hash> — monthly recheck cron + re-engagement mail
DEEL 3  ✓ <hash> — GDPR delete + export + history-view
DEEL 4  ✓ <hash> — Tink PSD2 foundation, feature-flagged
DEEL 5  ✓ <hash> — WhatsApp inbound + user-confirm outbound
DEEL 6  ✓ <hash> — OCR training pipeline + anonymizer
DEEL 7  ✓ <hash> — smoke 25, manual setup guide

Skipped: <leeg of korte lijst>
Open issues: <bekende limitations>
Wat-jij-nog-moet-doen: zie MANUAL_SETUP_REQUIRED.md
```

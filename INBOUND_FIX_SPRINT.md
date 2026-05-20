# DeGeldHeld — Inbound E-mail Fix Sprint

**Probleem:** de inbound-webhook code matcht Resend's échte signatuur niet.
`lib/inbound.ts` verwacht een `resend-signature` header met **hex HMAC**,
maar Resend ondertekent webhooks via **Svix** (`svix-id`, `svix-timestamp`,
`svix-signature`, base64). Gevolg: élke inbound-webhook wordt geweigerd
met 401, ook met een correcte secret. De DNS/MX-kant is al goed; alleen
de code moet kloppen.

**Belangrijk principe voor deze sprint:** NIET aannemen. Verifieer élke
aanname tegen de **actuele Resend-documentatie** (WebFetch
`https://resend.com/docs/dashboard/webhooks/introduction` +
`https://resend.com/docs/dashboard/emails/inbound` of de huidige
inbound-docs). De hele bug ontstond door aannames over het formaat.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/INBOUND_FIX_SPRINT.md en voer alle deeltaken uit in volgorde. Verifieer EERST het echte Resend-inbound-webhook-formaat (signing + payload-schema) via WebFetch op de actuele Resend-docs — neem niks aan. Per deeltaak: implementeer, run tests (npm test + npx tsc --noEmit), bij fail fix tot groen, commit + push. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 25 min: TODO-commit en door. Eindig met INBOUND_FIX_REPORT.md inclusief de exacte EIGENAAR-stappen (welke webhook-URL in Resend, welke secret naar Vercel).
```

---

## DEEL 0 — Verifieer het echte formaat (eerst!)

a. WebFetch de actuele Resend-docs voor:
   - **Webhook signing** — bevestig dat het Svix is: headers `svix-id`,
     `svix-timestamp`, `svix-signature`; secret-formaat `whsec_<base64>`;
     signed content = `${svix-id}.${svix-timestamp}.${rawBody}`.
   - **Inbound e-mail** — het exacte event-type (bv `email.received` /
     `inbound.email.received`) en het `data`-schema: `from`, `to[]`,
     `subject`, `text`, `html`, `attachments[]` (welke velden:
     `filename`, `content`/`content_type`, base64 vs download-URL?),
     `headers`, `message_id`, `in_reply_to`.
b. Schrijf de bevindingen kort bovenaan `INBOUND_FIX_REPORT.md` zodat de
   implementatie traceerbaar is.

---

## DEEL 1 — Svix signature-verificatie

a. `npm install svix` (officiële verificatie-lib — robuuster dan
   handmatige HMAC, handelt timestamp-tolerantie + multi-sig af).

b. Maak één gedeelde helper `lib/inbound-verify.ts`:
   ```ts
   import { Webhook } from "svix";
   export function verifyResendWebhook(rawBody: string, headers: Headers): boolean {
     const secret = process.env.RESEND_WEBHOOK_SECRET;
     if (!secret) return false;            // nooit unsigned accepteren
     try {
       new Webhook(secret).verify(rawBody, {
         "svix-id": headers.get("svix-id") ?? "",
         "svix-timestamp": headers.get("svix-timestamp") ?? "",
         "svix-signature": headers.get("svix-signature") ?? "",
       });
       return true;
     } catch {
       return false;
     }
   }
   ```

c. Vervang de oude `verifyResendSignature` (hex `resend-signature`) in
   `lib/inbound.ts`, `lib/inbound-router.ts` en `lib/proof-inbound.ts`
   door deze gedeelde Svix-helper. Verwijder de dode hex-HMAC code.

d. **Consolideer de secrets:** Resend stuurt alle inbound naar één
   webhook met één secret. Gebruik overal `RESEND_WEBHOOK_SECRET`.
   `RESEND_PROOF_WEBHOOK_SECRET` + `RESEND_INBOUND_SECRET` worden
   overbodig — verwijder ze of laat ze als alias vallen op de ene
   secret. Documenteer dit in het rapport.

e. Commit: `fix(inbound): verify Resend webhooks via Svix, single secret`.

---

## DEEL 2 — Payload-parser uitlijnen op Resend's schema

a. Pas `parseInboundPayload` (lib/inbound.ts) + `parseInboundRouterPayload`
   (lib/inbound-router.ts) aan zodat ze het **echte** Resend inbound-
   event lezen (uit DEEL 0), niet een verzonnen vorm. Let op:
   - recipient (`to`) — nodig om op adres te routeren
   - `subject` — nodig voor `[PROOF-<billId>]` / `[NEGOTIATION-<negId>]`
   - `attachments` — hoe levert Resend ze? Base64 inline → direct naar
     `extractBill()`. Download-URL → eerst fetchen (respecteer 10MB cap).
   - `in_reply_to` / `references` — voor auto-pingpong thread-matching.

b. Behoud alle bestaande business-logica (OCR, `recordProof`, `dispatch`
   in auto-pingpong) — alleen de parse/entry-laag verandert.

c. Tests met realistische Resend-inbound-payloads (mock op basis van het
   gedocumenteerde schema): bill-attachment → bill-branch; subject
   `[PROOF-x]` → proof; `[NEGOTIATION-x]` → pingpong.

d. Commit: `fix(inbound): align payload parser with Resend inbound schema`.

---

## DEEL 3 — Eén canonieke endpoint

Resend stuurt **alle** inbound voor het domein naar **één** webhook-URL.
De code kan dus niet leunen op aparte URLs per adres.

a. Maak `/api/inbound` de canonieke ontvanger:
   - Svix-verificatie (DEEL 1) → 401 bij ongeldig
   - Parse (DEEL 2)
   - **Route** op recipient + subject:
     - `inbox@degeldheld.com` → factuur-OCR + reply met analyse-links
     - subject `[PROOF-<billId>]` of `bewijs@…` → proof-verificatie
     - subject `[NEGOTIATION-<negId>]` / `In-Reply-To` matcht thread →
       auto-pingpong
     - anders → `200 { ok:true, reason:"no match" }` (NOOIT 500, anders
       blijft Resend retryen)
b. Laat `/api/inbound/proof` en `/api/inbound/router` ofwel delegeren naar
   de gedeelde routeer-logica, ofwel verwijder ze en wijs alles naar
   `/api/inbound`. Houd de business-functies intact.
c. Tests: junk-mail → 200 no-op; geldige branches → juiste handler;
   ongeldige signature → 401.
d. Commit: `refactor(inbound): single canonical webhook endpoint + routing`.

---

## DEEL 4 — Aggregate + rapport

a. `npm test -- --run` + `npx tsc --noEmit` groen.
b. `INBOUND_FIX_REPORT.md`:
   - DEEL 0-bevindingen (echte Svix + payload-schema)
   - Wat veranderd is + commit-hashes
   - **EIGENAAR — handmatige stappen:**
     1. Resend → Webhooks → Add endpoint → URL
        `https://www.degeldheld.com/api/inbound` → subscribe op het
        inbound-event → kopieer de `whsec_…` signing secret
     2. Vercel → `RESEND_WEBHOOK_SECRET` = die `whsec_…` → redeploy
     3. (oude `RESEND_PROOF_WEBHOOK_SECRET` / `RESEND_INBOUND_SECRET`
        mogen weg)
     4. Test: mail een factuur-JPG naar `inbox@degeldheld.com` vanaf je
        geregistreerde account → reply binnen ~10s. En een mail met
        subject `[PROOF-<billId>]` naar `bewijs@…` → `proofVerifiedAt`
        wordt gezet.
c. Commit: `docs(inbound): Svix fix verified + owner setup steps`.

---

## Done-criteria

- [ ] DEEL 0: echte Resend-formaat geverifieerd tegen docs (geen aannames)
- [ ] Svix-verificatie live op alle inbound-paden, één secret
- [ ] Payload-parser matcht Resend's echte inbound-schema
- [ ] Eén canonieke `/api/inbound` endpoint met adres/subject-routing
- [ ] Ongeldige signature → 401, junk → 200 no-op, geldig → juiste handler
- [ ] `npm test` + `npx tsc --noEmit` groen
- [ ] INBOUND_FIX_REPORT.md met exacte eigenaar-stappen

**Na deze sprint sluit jij in Resend één webhook aan + zet één secret in
Vercel, en werkt inbound meteen — geen stille 401 meer.**

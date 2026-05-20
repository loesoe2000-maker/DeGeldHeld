# INBOUND_FIX_REPORT — Resend inbound webhook fix

**Probleem:** de inbound-code verwachtte een hex-HMAC `resend-signature`
header, maar Resend ondertekent met **Svix**. Gevolg: élke inbound-webhook
werd 401 geweigerd, óók met een correcte secret. Tijdens het fixen bleek er
nog een tweede, grotere aanname fout: de webhook-payload bevat **geen**
body/attachments — alleen metadata.

## DEEL 0 — Geverifieerd echte formaat (tegen de actuele Resend-docs)

WebFetch op `resend.com/docs/webhooks/verify-webhooks-requests`,
`/webhooks/emails/received`, `/api-reference/emails/retrieve-received-email`
+ `/…/retrieve-received-email-attachment`:

### Signing = Svix (niet hex HMAC)
- Headers: **`svix-id`**, **`svix-timestamp`**, **`svix-signature`**.
- Secret: **`whsec_…`** (base64), env `RESEND_WEBHOOK_SECRET`.
- Signed content: `${svix-id}.${svix-timestamp}.${rawBody}`, HMAC-SHA256.
- Verificatie via de officiële `svix`-lib (`new Webhook(secret).verify(...)`)
  — handelt timestamp-tolerantie (replay) + key-rotation af.

### Inbound event = `email.received`
- Payload `data`: `email_id`, `from`, `to[]`, `cc[]`, `bcc[]`,
  `message_id`, `subject`, `attachments[]` (metadata: `id`, `filename`,
  `content_type`, `content_disposition`, `content_id`).
- **KRITISCH:** "Webhooks do not include the email body, headers, or
  attachments, only their metadata." → géén `text`/`html`/`headers`/
  `in_reply_to`/attachment-content in de webhook.

### Volledige content via de Received-Emails API (Bearer `RESEND_API_KEY`)
- `GET https://api.resend.com/emails/receiving/{id}` → `from`, `to[]`,
  `subject`, `text`, `html`, `headers{}` (In-Reply-To/References zitten
  hierin), `message_id`, `raw.download_url`, `attachments[]`.
- `GET …/emails/receiving/{id}/attachments/{attId}` → `download_url`
  (gesigneerde, 1-uur-geldige CDN-URL) + `content_type` + `size`.

## Wat veranderd is + commit-hashes

| Deel | Commit | Wat |
|------|--------|-----|
| 1 | `6f47301` | `lib/inbound-verify.ts` (svix `Webhook.verify`, fail-closed). Oude hex-HMAC verifiers verwijderd uit `lib/inbound.ts`, `lib/inbound-router.ts`, `lib/proof-inbound.ts`. Eén secret: `RESEND_WEBHOOK_SECRET`. |
| 2 | `ce28921` | `lib/resend-receiving.ts`: `parseReceivedEvent` (metadata) + `fetchReceivedEmail` (body/headers + In-Reply-To/References uit de headers-map) + `fetchAttachmentBuffer` (download_url → Buffer, 10 MB cap). |
| 3 | `9634162` | `lib/inbound-handler.ts` = de canonieke `handleInbound(req)`. `/api/inbound` is de enige ontvanger; `/proof` + `/router` delegeren ernaar. Routing op subject-token / In-Reply-To thread / recipient. AUTO_PINGPONG-gate verplaatst naar `dispatch()` (no-op als uit). Junk → 200 no-op, nooit 500. |
| 4 | `<dit commit>` | RUNBOOK bijgewerkt + dit rapport. |

### Routing (canonieke handler)
1. Svix-verificatie → **401** bij ongeldig/ontbrekend.
2. Parse `email.received` → metadata. Ander event → 200 no-op.
3. Hydrate volledige mail via de Resend API (body + headers + attachments).
   Fetch-fout → **502** (transient, Resend retried).
4. Route:
   - `[PROOF-<id>]` / `bewijs@` → proof (`dispatch`, daarna from-fallback).
   - `[NEGOTIATION-<id>]` / In-Reply-To thread / `auto@` → auto-pingpong
     (`dispatch`, gated achter AUTO_PINGPONG).
   - `inbox@` (of mail mét attachments) → factuur-OCR + analyse-reply.
   - anders → **200 no-op**.

### Tests
- `tests/inbound-verify.test.ts` — echte Svix-handtekeningen: geldig
  accepteert, getamperd / verkeerd secret / ontbrekende headers / geen
  secret weigeren.
- `tests/inbound-signature.test.ts` — `parseReceivedEvent` op het echte
  `email.received`-schema.
- `tests/inbound.test.ts` — `handleInbound` routing (401 / proof /
  bewijs-fallback / bill / unknown-sender / junk-noop / 502).
- Bestaande inbound/proof/router/no-autosend/confirm/xss tests bijgewerkt
  naar de nieuwe Svix + single-endpoint structuur.

### Test-totaal
- `npx tsc --noEmit`: **clean**.
- `npm test -- --run`: **1656 passed**, 2 failed = de bekende pre-existing
  FAQ-failures (commit `b351a61`, BACKLOG — buiten scope).

---

## 🧑 EIGENAAR — handmatige stappen

1. **Resend → Webhooks → Add endpoint**
   - URL: `https://www.degeldheld.com/api/inbound`
   - Subscribe op het **`email.received`** event (inbound).
   - Kopieer de **`whsec_…`** signing secret.

2. **Vercel env**
   - `RESEND_WEBHOOK_SECRET` = die `whsec_…` → redeploy.
   - Zorg dat **`RESEND_API_KEY`** gezet is (nodig om de body +
     attachments op te halen — zonder dit werkt inbound niet).
   - **Verwijder** de oude `RESEND_PROOF_WEBHOOK_SECRET` en
     `RESEND_INBOUND_SECRET` (niet meer gebruikt).

3. **Resend → Inbound (domein-ontvangst)**
   - Activeer inbound voor `degeldheld.com` en voeg de MX-record(s) toe die
     Resend toont in Cloudflare. Alle inbound (`inbox@`, `bewijs@`,
     `auto@`, of apex) landt op de ene endpoint — routing gebeurt in code op
     recipient + subject.

4. **Test**
   - Mail een factuur-JPG naar `inbox@degeldheld.com` vanaf je
     geregistreerde account → analyse-reply binnen ~10s.
   - Mail met subject `[PROOF-<billId>]` naar `bewijs@degeldheld.com` →
     `Negotiation.proofVerifiedAt` wordt gezet (de fee-trigger).
   - In Resend → Webhooks → het endpoint: deliveries moeten **2xx** tonen
     i.p.v. 401.

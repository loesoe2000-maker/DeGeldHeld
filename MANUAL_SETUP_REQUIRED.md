# Manual Setup Required — AFTER_V7 Sprint

External services / accounts / approvals you (the human) still need to
arrange. Code is fully in place; flip the corresponding feature-flag or
add the env var to activate.

Last updated: 2026-05-17 (DEEL 7 wrap-up).

## Prioritized roadmap

**Direct activeerbaar (~1 uur werk total)**
1. Resend inbound webhook + MX record → §1 (email-forward live)
2. Vercel Blob Storage (optional, voor §6 vision-fine-tune later)

**1-2 weken externe approval (begin nu)**
3. Twilio + WhatsApp Business sender approval → §5
4. Tink developer account + DPIA + verwerkersovereenkomst → §4

**Wacht op data (3-6 maanden)**
5. OCR fine-tune training run op Replicate of HF → §6

## Status legend

- [ ] todo
- [x] done

---

## 1. Resend inbound webhook (email → OCR)  — DEEL 1

Activates: `inbox@degeldheld.com` forward → automatic bill OCR + reply.

- [ ] Resend dashboard → Domains → add `degeldheld.com` MX record
      pointing to Resend inbound (`inbound-smtp.resend.com` priority 10).
- [ ] Resend → Inbound → create new endpoint:
      - Webhook URL: `https://degeldheld.com/api/inbound`
      - Method: POST
      - Forward attachments: yes
- [ ] Copy the signing secret to Vercel as `RESEND_WEBHOOK_SECRET`.
- [ ] Send a test email with a JPG to `inbox@degeldheld.com` from your
      registered account — you should receive a reply within ~10 s.

The route silently rejects unsigned/invalid payloads with HTTP 401, so
you can safely leave it deployed before the webhook secret is set; just
no real requests will land yet.

---

## 2. Monthly market re-check cron — DEEL 2

Activates: nightly cron that re-runs market comparison on bills older
than 30 days; emails user if savings increased by ≥ €60/yr.

- [x] `vercel.json` cron added (`0 9 * * *` on `/api/cron/monthly-recheck`).
- [x] Migration `bill_recheck_schedule` applied to prod DB (Bill.lastRecheckAt,
      nextRecheckAt, lastRecheckMailAt columns).
- [ ] Ensure `CRON_SECRET` is set in Vercel (it is, from v6) — the
      cron returns 401 without a `Authorization: Bearer ${CRON_SECRET}` header.
- [ ] Optional: backfill `nextRecheckAt` on existing bills:
      ```sql
      UPDATE "Bill" SET "nextRecheckAt" = "createdAt" + INTERVAL '30 days'
      WHERE "nextRecheckAt" IS NULL;
      ```

Anti-spam: at most one re-engagement mail per user per 7 days (DB-guarded).

---

## 3. GDPR delete + export + history — DEEL 3

Activates: AVG art. 17 (delete) + art. 20 (export) endpoints, `/account`
page, bill-delete on dashboard, per-bill `/onderhandel/[id]/historie`
timeline.

- [x] Migration `user_gdpr` applied to prod DB (User.notificationsEnabled,
      deletedAt, ocrTrainingOptIn + Bill.deletedAt columns).
- [ ] If you have privacy-policy text on `/privacy`, add a paragraph
      pointing users to `/account` for self-service data export +
      deletion (template wording in `MANUAL_SETUP_REQUIRED.md` Section 3
      appendix once you draft it).

No external service required — fully self-contained.

---

## 4. PSD2 / Tink bank integration — DEEL 4

Activates: `/account/banks` self-service connect → automatic recurring-
debit detection (KPN €25/mnd, Eneco €120/mnd, etc.) → user converts
detected items into bills with one click.

Code is **fully shipped**, behind `PSD2_ENABLED=false` (default). The
`/account/banks` page renders with a yellow "not enabled" banner until
you flip the flag.

External account & legal (1-2 weeks):

- [ ] Tink developer account at https://console.tink.com — create
      a production app.
- [ ] Markets enabled: NL, BE, DE, FR, UK (Tink default).
- [ ] Redirect URI: `https://degeldheld.com/api/psd2/callback`.
- [ ] Vercel env vars:
      - `TINK_CLIENT_ID` — from Tink console
      - `TINK_CLIENT_SECRET` — from Tink console (write-only)
      - `TINK_API_BASE` — defaults to `https://api.tink.com` (leave unset)
      - `TOKEN_ENC_KEY` — `openssl rand -hex 32` for at-rest AES-GCM
        encryption of OAuth tokens (NOT optional in prod; if missing,
        falls back to NEXTAUTH_SECRET-derived key which is OK for dev
        but couples token rotation to session rotation).
- [ ] Sign a Verwerkers­overeenkomst (DPA) with Tink (template they
      provide; financial-data processing is high-risk under AVG).
- [ ] DPIA (Data Protection Impact Assessment) — short doc covering:
      data sources, retention (BankConnection.expiresAt purge after
      90d), purpose limitation, user-controlled revoke flow.
- [ ] Flip `PSD2_ENABLED=true` in Vercel → cron `0 4 * * *`
      `/api/cron/psd2-sync` starts running.

Migrations `psd2_foundation` applied (BankConnection + DetectedRecurring).

Revoke handling: if Tink returns 401/403, the connection is auto-marked
`status=expired` (see cron + sync route).

---

## 5. WhatsApp Business — DEEL 5

Activates: real-time provider conversation tracking. Provider WhatsApps
your tracked number → AI generates counter-draft → user clicks
"Akkoord, verstuur" → Twilio relays.

Code shipped behind `WHATSAPP_ENABLED=false`. Page
`/onderhandel/[billId]/whatsapp` renders with yellow "not enabled"
banner until the flag is on.

External approval (1-2 weeks):

- [ ] Twilio account at https://twilio.com.
- [ ] WhatsApp Sender registration in Twilio Console
      (Messaging → Senders → WhatsApp). Meta needs to approve the
      Business profile (~1-7 days).
- [ ] Configure inbound webhook URL in Twilio:
      `https://degeldheld.com/api/inbound/whatsapp`
      (Method POST, signed with the Twilio AuthToken automatically).
- [ ] Vercel env vars:
      - `WHATSAPP_PROVIDER` = `twilio` (default) or `360`
      - `TWILIO_ACCOUNT_SID`
      - `TWILIO_AUTH_TOKEN`
      - `TWILIO_WHATSAPP_NUMBER` — your Twilio-issued WhatsApp sender
        (international format, e.g. `+31201234567`)
      - `WHATSAPP_WEBHOOK_SECRET` — only required for 360dialog
- [ ] Flip `WHATSAPP_ENABLED=true`.

Compliance hardcoded in code:
- `pendingApproval=true` flag on every AI-generated outbound message.
- `/api/outbound/whatsapp` rejects with 400 if `pendingApproval=false`
  (i.e. it can only send drafts the user just clicked).
- All inbound replies trigger a mail-notification (no silent auto-send).

Migration: `whatsapp_conversations` applied.

---

## 6. OCR fine-tune dataset collection — DEEL 6

Activates: anonymized OCR sample collection (opt-in per user) +
`/admin/training` review queue + JSONL export for Replicate / HF.

Code shipped; collection starts automatically once a user opts in via
the new "AI-verbetering toestaan" checkbox on `/account`. Bills with
no/poor OCR are not collected (we filter `ocr.ok && provider && amount`).

External setup:

- [ ] (Optional now, recommended later) Vercel Blob Storage activated
      — for storing the raw image alongside the extracted JSON so the
      future fine-tune can be image-vision instead of text-only.
      Without Blob the pipeline still collects text-only samples that
      train the assistant side of llama-3.3-70b.
      - Vercel dashboard → Storage → Blob → enable
      - Vercel env: `BLOB_READ_WRITE_TOKEN`
- [ ] Wait ~3-6 months until you accumulate ≥500 reviewed samples.
- [ ] Run `npx tsx scripts/export-training-dataset.ts` → `ocr-dataset.jsonl`.
- [ ] Upload to Replicate fine-tune endpoint for llama-4-scout vision
      (~$200 expected). Or to HuggingFace AutoTrain for text-only.
- [ ] Once the new model is trained, set its identifier as
      `GROQ_VISION_MODEL` in Vercel and redeploy.

Privacy guarantees baked into code:
- `customerNumber` is never persisted in the training sample (dropped
  by `anonymizeStructured`).
- All free-text passes through `anonymizeText` — replaces email/IBAN/
  postcode/phone/customer-number/multi-word capitalized names with
  placeholder tokens.
- A brand-name whitelist preserves provider tokens (KPN, Vodafone, etc).
- Collection requires user `ocrTrainingOptIn = true`; toggle on `/account`.

Migration: `ocr_training` applied.

---

## 7. Auto-pingpong (FEATURE_AUTO_PINGPONG) — v10

Forwarded-reply → AI counter-mail → user-confirm → Resend send. **Off
by default.** Flip `FEATURE_AUTO_PINGPONG=true` on Vercel *only* after
the items below are green AND we have logged 5 real provider threads
end-to-end without the confirm-gate being skipped.

External setup (one-off):

- [ ] Resend: create domain `auto.degeldheld.com` with MX records
      pointing at Resend inbound MX (instructions in Resend dashboard).
- [ ] Resend inbound webhook URL:
      `https://degeldheld.com/api/inbound/router`
- [ ] Generate a fresh HMAC secret (`openssl rand -hex 32`). Set in
      Resend webhook config AND in Vercel env as
      `RESEND_INBOUND_SECRET`.
- [ ] Vercel env: `RESEND_INBOUND_DOMAIN=degeldheld.com` (the domain
      used in outbound Message-ID — must match the regex in
      `lib/email-thread.ts`).
- [ ] Vercel env: `APP_URL=https://degeldheld.com` (used for
      notification-mail deep-links).

Smoke test before flipping the flag on:

```bash
# 1. Unsigned POST must return 401
curl -X POST https://degeldheld.com/api/inbound/router -d '{}' -i

# 2. With FEATURE_AUTO_PINGPONG=false but valid sig must return 503
# 3. Forward a real provider reply to auto@degeldheld.com and confirm
#    a row appears in NegotiationRound with outcome
#    AWAITING_USER_CONFIRM. Do NOT skip the manual click on
#    /onderhandel/[billId]/ronde/[n].
```

Hard rule, codified in `lib/inbound-router.ts` and the confirm-send
endpoint: **the system never sends a counter-mail without a manual
user click**. The webhook handler only writes a row; the
`/api/negotiations/round/[id]/confirm-send` endpoint is the only path
that hands the mail to Resend.

Migration: `20260518170000_auto_pingpong` adds RoundOutcome
`AWAITING_USER_CONFIRM` + `Negotiation.providerThreadId` +
`NegotiationRound.{inboundMessageId,inboundReplyTo,confirmedSentAt}`.
Run `npx prisma migrate deploy` against prod after merging.

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

---

## 8. Revenue verification + no-cure-no-pay (v11)

Two coupled features that gate paid billing on real, verified savings.
Both are off by default — they share the same Resend domain setup but
have independent feature flags.

### 8a. Proof-flow (`FEATURE_PROOF_REQUIRED`)

When on, a SUCCESS_SAVED claim parks at `SUCCESS_UNVERIFIED`. The
user must forward the provider confirmation to **bewijs@degeldheld.com**
(or upload via `/onderhandel/[bill]/uitkomst`) before the claim
counts on `/proof` aggregates.

External setup:

- [ ] Resend: domain `bewijs.degeldheld.com` with MX records (same
      Resend dashboard flow as auto.degeldheld.com).
- [ ] Resend inbound webhook URL:
      `https://degeldheld.com/api/inbound/proof`
- [ ] Generate HMAC secret (`openssl rand -hex 32`). Set in Resend
      webhook config AND in Vercel env as
      `RESEND_PROOF_WEBHOOK_SECRET`.
- [ ] Configure forwarded-mail subject convention: provider replies
      get the `[PROOF-<negotiationId>]` token automatically when
      forwarded from the UI prompt; manual forwards fall through the
      In-Reply-To + from-address matcher.

Smoke checks (from `scripts/smoke-prod.ts`):
- `36. POST /api/inbound/proof (no signature) → 401`
- `38. /onderhandel/[id]/uitkomst auth redirect → /login`
- `39. POST /api/outcome/[id]/proof (no auth) → 401 or 503`

### 8b. No-cure-no-pay pricing (`FEATURE_NO_CURE_NO_PAY`)

When on, the legacy paywall is bypassed; the only billable event is
a *verified* savings flow. Fee = **20% of yearly verified savings**,
clamped to [€2, €25], skipped under €50/year. Admin emails (per
`ADMIN_EMAILS`) are never charged.

External setup:

- [ ] Stripe Product "Verified savings fee" with **variable amount**
      pricing. The Checkout call sends `unit_amount` per-session, so a
      single product covers every fee tier.
- [ ] Verify webhook for `checkout.session.completed` already lands at
      `/api/webhooks/stripe` — no new endpoint needed.

Smoke check:
- `40. /admin/fraud (admin gate) → not 500`

### 8c. Anti-fraud (always on)

No flag — `lib/fraud-detection.ts` + `/api/cron/fraud-check` (daily
04:30 UTC) score every user and write a FraudFlag at score >= 50.
Admin reviews at `/admin/fraud`; suspend writes
`User.suspendedAt` + `suspendedReason` and the upload route refuses
suspended users with a 403.

Migrations to apply on prod:
- `20260518180000_outcome_proof` (DEEL 2)
- `20260518190000_fraud_detection` (DEEL 5)

```
npx prisma migrate deploy
```

Smoke test before flipping `FEATURE_NO_CURE_NO_PAY=true`:
- 5 real verified-savings flows (forward + verify + check fee landed).
- Confirm `/admin/fraud` shows your test accounts but does not flag
  legit testers (verify the noise floor at 5%).
- Confirm cron locks via `CronRunLog` so two Vercel instances don't
  double-score.

---

## 9. Auto-pingpong activation (v12 DEEL 1)

The auto-pingpong infrastructure has shipped (v10) and the v12 sprint
extends it with a discriminating inbound router. Now-live multiplexed
on `https://degeldheld.com/api/inbound/router`:

  - subject `[PROOF-<billId>]`       → proof-flow (recordProof)
  - subject `[NEGOTIATION-<negId>]`  → auto-pingpong counter-mail
  - In-Reply-To matching a thread    → auto-pingpong fallback
  - everything else                  → ack 200, no-op

External setup (one-off — same Resend domain as before, separate
secret):

- [ ] Resend: `auto.degeldheld.com` already configured (v10 §7).
- [ ] Webhook URL: `https://degeldheld.com/api/inbound/router`
- [ ] Vercel env: `RESEND_INBOUND_SECRET` (the HMAC for THIS endpoint,
      distinct from the proof webhook secret).
- [ ] Vercel env: `RESEND_INBOUND_DOMAIN=degeldheld.com` so the
      thread-id parser matches outbound Message-IDs.

Curl smoke before flipping the flag on:

```bash
# 1. Unsigned must 401 — both for NEGOTIATION and PROOF tokens.
curl -X POST https://degeldheld.com/api/inbound/router \
  -H "Content-Type: application/json" \
  -d '{"from":"x@y.nl","subject":"[NEGOTIATION-clxyz1234567890abcdef]"}' \
  -i

# 2. With a valid HMAC + a real Negotiation thread-id in In-Reply-To,
#    expect 200 with a NegotiationRound row written and a user
#    notification mail dispatched. Do NOT skip step 3 of the flag
#    flip — manual user-click is mandatory.

# 3. /onderhandel/[billId]/ronde/[n] must render the
#    AWAITING_USER_CONFIRM branch and the "Verstuur counter via
#    DeGeldHeld" button must POST to /api/negotiations/round/[id]/
#    confirm-send. That endpoint is the ONLY path that sends a
#    counter-mail.
```

Flip `FEATURE_AUTO_PINGPONG=true` in Vercel only after 1 dummy
negotiation completes that loop end-to-end without the confirm gate
being skipped.

---

## 10. Multi-page PDF (v12 DEEL 2)

`lib/pdf_extract.ts` now reads up to 5 pages by default. Each page is
tagged with a `--- page N ---` marker so Groq can combine information
across pages. Cost-guard fires a Sentry warning when a PDF >5 pages
gets truncated.

Vision-rendered PDF→PNG (multi-image Groq Vision call) is a follow-up
gated on adding `@napi-rs/canvas` as a dependency. The text path
already covers Eneco/Vodafone/etc. jaarafrekeningen since pdfjs
extracts their text natively.

No external setup needed for the text path.

v13 update: vision-render is **now live**. `@napi-rs/canvas@1.0.0` is
in the deps (pre-built native bindings — Vercel-safe). `lib/pdf_render.ts`
renders up to 5 pages and `extractFromPdf` now falls back through a
multi-image Groq Vision call when the text-extraction path is empty
or low-confidence.

---

## 11. v13 release checklist (final)

Single source-of-truth for flipping the v11+v12+v13 flag stack to
production. Order matters — apply migrations first, then env vars,
then flip flags.

### 11a. Migrations to apply

```bash
npx prisma migrate deploy
```

Pending migrations created in v10/v11/v13:
- `20260518160000_bill_subtype`        — Bill.subType (v10)
- `20260518170000_auto_pingpong`        — auto-pingpong (v10)
- `20260518180000_outcome_proof`        — proof flow (v11)
- `20260518190000_fraud_detection`      — fraud table (v11)
- `20260518200000_subscription_fields`  — User subscription cols (v13)

### 11b. Vercel env vars

- `RESEND_INBOUND_SECRET`               — HMAC for `/api/inbound/router`
- `RESEND_PROOF_WEBHOOK_SECRET`          — HMAC for the proof-branch
  (if you split webhooks; otherwise the router endpoint is the mux)
- `RESEND_INBOUND_DOMAIN=degeldheld.com` — Message-ID matcher
- `APP_URL=https://degeldheld.com`      — deeplinks in notif mails
- `CRON_SECRET`                         — bearer auth for cron routes
- `ADMIN_EMAILS=…`                      — fee + suspend bypass

### 11c. DNS / Resend / Stripe

- MX-record for `auto.degeldheld.com`  → Resend inbound
- MX-record for `bewijs.degeldheld.com` → Resend inbound
- Webhook URL: `https://degeldheld.com/api/inbound/router` (handles
  `[NEGOTIATION-]` + `[PROOF-]` + In-Reply-To fallback)
- Stripe Product: "Verified savings fee" — **variable amount** so the
  Checkout call sets `unit_amount` per session (v13 DEEL 7, cap €50).
- Stripe Product: "DeGeldHeld Plus" — recurring €4,99/month (v13
  DEEL 7d subscription alternative).

### 11d. Feature-flag flip order

After (a)/(b)/(c) are green AND `npm run smoke:prod` shows 45/45:

```bash
FEATURE_PROOF_REQUIRED=true       # proof-flow gates SUCCESS_SAVED
FEATURE_AUTO_PINGPONG=true        # only after 1 dummy negotiation
FEATURE_NO_CURE_NO_PAY=true       # only after 5 verified-savings flows
```

Each flag flip is a separate Vercel deploy. If anything regresses,
flip back to `false` (no code revert needed).

---

## 12. Sentry alerts (v14 DEEL 4)

Sentry SDK is wired via `instrumentation.ts` (server + edge) and
`sentry.client.config.ts`. All 5 cron routes + 5 lib modules now
call `Sentry.captureException` from their catch-blocks
(audit in v14 DEEL 4 added the 3 missing crons: outcome-followup,
psd2-sync, monthly-recheck).

Configure these alerts in the Sentry dashboard
(Settings → Alerts → New alert rule):

1. **Issue first seen** — When a new issue is created.
   *Trigger:* Always. *Action:* Email to `hallo@degeldheld.com` +
   Slack `#alerts` if you have Slack.

2. **Error rate spike** — `event.count > 5` in 1 hour.
   *Action:* "Critical" tag → email immediately.

3. **Performance regression** — When P95 transaction duration
   for `/api/bills/upload` doubles week-over-week.
   *Action:* Daily digest (not paged).

4. **Cron-job failure** — Filter `tags.module:cron/*` AND
   `level:error`. *Action:* Email when count > 0 in last 4 hours.

Test the alert plumbing:
```
curl https://degeldheld.com/api/test-sentry?test=1
```
Expect a Sentry event within 30 seconds.

# DeGeldHeld v8 — AFTER_V7 sprint final status

Sprint: AFTER_V7_SPRINT.md (TIER 1 + TIER 2/3 foundations)
Datum: 2026-05-17
Test-suite: **1038+ passing**, `tsc --noEmit` clean.
Smoke-prod: **25/25 groen** op https://degeldheld.com.

## Per deeltaak

| Deel | Commit | Resultaat |
|---|---|---|
| 1 — Email-forward inbox | d6b1687 | Resend inbound HMAC verify + extractBill loop + reply mail; 12 tests; `inbox@degeldheld.com` ready (wacht op MX/webhook setup) |
| 2 — Monthly auto re-check | a303ff2 | Bill.{lastRecheckAt,nextRecheckAt,lastRecheckMailAt} + nightly cron + €60/jr delta + 7d anti-spam; 6 tests |
| 3 — GDPR delete + export + history | 5e505e3 | DELETE /api/bills/[id] + AVG art. 20 export + AVG art. 17 delete + `/onderhandel/X/historie` timeline + `/account` page; 10 tests |
| 4 — PSD2 / Tink foundation | 4e7aa37 | BankConnection + DetectedRecurring + AES-GCM tokens + fetch-based Tink client + recurring detector + `/account/banks` flag-gated UI + nightly cron; 15 tests |
| 5 — WhatsApp inbound + counter | 4ac508f | Twilio HMAC-SHA1 + 360dialog secret verify + WhatsAppThread/Message + Groq counter-gen + `/onderhandel/X/whatsapp` UI with **hard user-confirm gate**; 12 tests |
| 6 — OCR fine-tuning dataset | 79feb1c | OcrTrainingSample + opt-in checkbox + anonymizer (email/IBAN/postcode/phone/klantnummer/names + brand-whitelist) + `/admin/training` review queue + JSONL export; 16 tests |
| 7 — Smoke 25 + manual setup | f740530 | smoke 20 → 25 (account/banks/historie/cron-auth/export-401), MANUAL_SETUP_REQUIRED with prioritized roadmap, RUNBOOK v8 ops |

## Smoke 25 (laatste run op productie)

```
[smoke-prod] Target: https://degeldheld.com
[smoke-prod] 25/25 groen
```

Inclusief v8-specifieke checks: /account redirect → /login,
/account/banks redirect → /login, /onderhandel/X/historie 200,
/api/cron/monthly-recheck auth-check, /api/account/export 401.

## Migraties live op prod-DB

5 migraties via `npx prisma migrate deploy`:

1. `20260517130000_bill_recheck_schedule` — Bill.lastRecheckAt/nextRecheckAt/lastRecheckMailAt
2. `20260517140000_user_gdpr` — User.notificationsEnabled/deletedAt/ocrTrainingOptIn + Bill.deletedAt
3. `20260517150000_psd2_foundation` — BankConnection + DetectedRecurring
4. `20260517160000_whatsapp_conversations` — WhatsAppThread + WhatsAppMessage
5. `20260517170000_ocr_training` — OcrTrainingSample

## Feature flags

| Flag | Default | Required for |
|---|---|---|
| `PSD2_ENABLED` | false | DEEL 4 Tink flows |
| `WHATSAPP_ENABLED` | false | DEEL 5 Twilio webhook + outbound |
| `RESEND_WEBHOOK_SECRET` (presence) | unset | DEEL 1 inbound mail |

Zonder de flags: UI rendert keurig met "nog niet geactiveerd" banner;
geen 500s; bestaande flows blijven werken.

## Open items voor de user

Zie `MANUAL_SETUP_REQUIRED.md` — geprioriteerd:

**Direct activeerbaar (~1u)**
1. Resend MX + inbound webhook (1)
2. Vercel Blob Storage (6, optional)

**1-2 weken externe approval**
3. Twilio + WhatsApp Business sender (5)
4. Tink developer account + DPIA (4)

**Wacht op data (3-6 maanden)**
5. ≥500 reviewed OCR samples → Replicate fine-tune (6)

## Eindrapportage

```
AFTER_V7_SPRINT v8 — Final report

DEEL 1  ✓ d6b1687 — email-forward live, Resend webhook ready
DEEL 2  ✓ a303ff2 — monthly recheck cron + re-engagement mail
DEEL 3  ✓ 5e505e3 — GDPR delete + export + history-view
DEEL 4  ✓ 4e7aa37 — Tink PSD2 foundation, feature-flagged
DEEL 5  ✓ 4ac508f — WhatsApp inbound + user-confirm outbound
DEEL 6  ✓ 79feb1c — OCR training pipeline + anonymizer
DEEL 7  ✓ f740530 — smoke 25/25, manual setup guide

Skipped: none
Open issues:
- WhatsApp ourNumber requires Twilio sender approval (1-7 days)
- PSD2 requires Tink DPA + DPIA (external legal/contract work)
- OCR fine-tune needs ~500 opt-in samples (organic, 3-6 mnd)
Wat-jij-nog-moet-doen: zie MANUAL_SETUP_REQUIRED.md
```

## Quality gates

- `tsc --noEmit` → 0 errors
- `npm test -- --run` → 1038/1038 passing (was 956 pre-sprint)
- Smoke-prod 25/25 groen op live productie
- 5 prisma migraties live op prod-DB
- 0 force-pushes, 0 `--no-verify`, 0 amended commits, 0 skipped delen

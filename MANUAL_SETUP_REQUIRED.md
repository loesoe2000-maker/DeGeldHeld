# Manual Setup Required — AFTER_V7 Sprint

External services / accounts / approvals you (the human) still need to
arrange. Code is fully in place; flip the corresponding feature-flag or
add the env var to activate.

Last updated by sprint: DEEL 1 (more sections appended later).

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

# CLAUDE.md — DeGeldHeld (read me first)

> Auto-loaded into every session. This is the **operating map**: what DeGeldHeld
> is, which services power it, and how Bas runs it. Deep detail lives in
> `RUNBOOK.md`, `.env.example`, the `*_REPORT.md` files, and the sprint `*.md`.

## What it is
AI bill-negotiation web app for Dutch consumers. **No-cure-no-pay: 20% of
verified yearly savings, cap €500, floor €2, threshold €25/yr.** Owner: **Bas**
— solo founder, `basheling@icloud.com`. His **father is a jurist** (reviewed +
approved the relay volmacht). Domain: **degeldheld.com**.

## Tech
Next.js 14 (App Router) + TypeScript + Tailwind · Prisma + Neon Postgres ·
NextAuth v5 (Resend magic-link) · Groq AI (Llama 4 Scout vision OCR + Llama 3.3
negotiation) · Stripe · Sentry · PostHog. Full env var list: **`.env.example`**.

## Services Bas uses (all FREE tier by design — upgrades to paid only after 10 paying users)
| Service | Plan | Purpose | Managed where | Key env vars |
|---|---|---|---|---|
| **GitHub** | — | repo `loesoe2000-maker/DeGeldHeld` | github.com | — |
| **Vercel** | Hobby (free) | hosting; **auto-deploys from `main`** | vercel.com · acct `loesoe2000-maker` · project `de-geld-held` | **all env vars live here** |
| **Neon** | Free | Postgres `degeldheld-db` (created via Vercel→Storage). Free = scale-to-zero → cold-start 500/slow on first hit after ~5 min idle | **Vercel → Storage** | `DATABASE_URL`, `DIRECT_URL` |
| **Stripe** | **SANDBOX/test** | no-cure-no-pay off-session charging + webhook | stripe.com | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Groq** | Free | OCR + negotiation AI (rate-limited on free → 429s under load) | console.groq.com | `GROQ_API_KEY` |
| **Resend** | — | magic-link auth + **inbound** (`bewijs@`, `inbox@`, `onderhandel+<token>@` → `/api/inbound`) | resend.com | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` (svix) |
| **Cloudflare** | Free | DNS (SPF/DKIM/DMARC/MX) + **Turnstile** CAPTCHA on anon upload | cloudflare.com | `TURNSTILE_*` |
| **Sentry** | Free | **error/crash monitoring** (alerts) | sentry.io | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` |
| **PostHog** | Free (EU) | **funnel/product analytics** (cookieless) | eu.i.posthog.com | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |
| **Vercel Analytics** | included | traffic/pageviews | Vercel dashboard | — |

Monitoring map: **errors → Sentry · funnel → PostHog · traffic → Vercel Analytics.**
(No need for Vercel Pro anomaly-alerts; Sentry covers errors.)

## How Bas runs it (workflow)
- **Deploy:** push to `main` → Vercel auto-deploys `degeldheld.com`.
- **Big features = sprint files:** Bas pastes `Lees <SPRINT>.md en voer uit` into
  Claude Code (often overnight w/ `caffeinate`). Each sprint ends with a
  `V*_REPORT.md`. Small/urgent fixes are done inline.
- **HARD GATE before every commit:** `npx tsc --noEmit` + `npm test` +
  **`npm run build` (EXIT 0)**. No `--no-verify`, no `--force`.
- **Commit trailer (always):** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## Guardrails (NEVER weaken)
- **No hallucinated prices/addresses** — WebFetch-sourced (with URL) or omit.
- **No PII in analytics** — mask invoice/financial content with `.ph-no-capture`.
- **AFM gate:** hypotheek + verzekering NOT supported (no compare/negotiate) until an AFM licence.
- **No-cure-no-pay:** full negotiation email is gated behind a linked card
  (`EmailPreviewLocked`); fee only on `proofVerifiedAt` + savings ≥ €25.
- **Relay (negotiate-on-behalf):** consent-first (`canRelaySend`), **card
  required**, **NEVER auto-accept a deal** (human approves every commitment),
  only mails a verified/confirmed provider address.

## Feature flags (`lib/feature-flags.ts`, env `FEATURE_<FLAG>`)
- `FEATURE_NO_CURE_NO_PAY=true` → **ON** (20% model live).
- `FEATURE_RELAY_ENABLED` → **OFF** (relay built+tested in V25/V26, jurist-approved;
  flip to `true` in Vercel only when launching the relay to real users).
- `AUTO_PINGPONG`, `PSD2_ENABLED`, `WHATSAPP_ENABLED` → off (legacy/experimental).

## ⚠️ Current state & sequencing (read before planning anything)
- **Money path works** — off-session 20% charge proven end-to-end (test mode).
- **Stripe = SANDBOX.** Real users **cannot link real cards** in sandbox. To
  charge real users → **Stripe LIVE**, which needs **KvK + father's account
  (KYC)** (Bas is 16, can't pass KYC solo). **This is the gate to revenue** — no
  paying user is possible before it.
- **Neon free cold-starts** → first hit after idle may 500. Fine on free; upgrade for a big launch.
- **Relay** needs a provider email; NL telecom publishes none → manual customer entry.

## Owner (Bas) does manually — NOT in code
Vercel env vars + feature flags · Neon (via Vercel→Storage) · Stripe dashboard +
live-flip · Groq console · Cloudflare DNS · KvK + legal. Never touch live Stripe
keys / switch Stripe to live in code — Bas does that by hand.

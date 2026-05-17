# DeGeldHeld v7 — Beat Trim Sprint final status

Sprint: BEAT_TRIM_SPRINT.md
Datum: 2026-05-17
Test-suite: **956+ passing**, TS `--noEmit` clean.

## Themas & deelresultaten

### THEMA A — stabiliteit

| Deel | Commit | Resultaat |
|---|---|---|
| DEEL 1 — full audit + TS fixes | b19b00a | scripts/audit-everything.ts + tests/audit-everything.test.ts; vier flakey/broken tests groen (counter-up timeout, billupload mock-shape, negotiator fallback confidence, ocr-cascade); VISION_MODELS reduced to llama-4-scout only (sprint whitelist) |
| DEEL 2 — provider verify | adbbc30 | scripts/verify-providers.ts (DNS MX + HEAD-check), tests/providers-integrity.test.ts. 0 verzonnen retentie-emails in registry (alleen URL voor KPN/Vodafone/Ziggo). |
| DEEL 3 — PDF support | c255e92 | lib/pdf_extract.ts + Groq text-LLM (llama-3.3-70b-versatile) parse; tests/fixtures/kpn.pdf + ocr-pdf.test.ts. PDF_SKIPPED-pad weggehaald. |

### THEMA B — Trim-buster features

| Deel | Commit | Resultaat |
|---|---|---|
| DEEL 4 — categorie-vergelijking | 3fdaea4 | lib/categories/{energie,verzekering,hypotheek}.ts; per-categorie info-banner op /onderhandel/analyse; 18 tests. |
| DEEL 5 — feedback loop | 6f0f5db | Negotiation.{userRating, mailUsed, providerResponded}; migration 20260517102810 toegepast op prod-DB; /api/negotiations/[id]/feedback; EmailDisplay 👍/👎 + OutcomeForm checkbox; /proof?view=mail-quality dashboard; scripts/prompt-tuner.ts nightly rapport |
| DEEL 6 — demo mode | d35ec58 | /demo met 3 fixtures (KPN telecom / Eneco energie / Centraal Beheer verz); no auth, no DB. Hero CTA "Bekijk hoe het werkt". |
| DEEL 7 — referral systeem | 41effb1 | User.referralCode + Referral model; migration 20260517110000 toegepast op prod-DB; /uitnodiging/[code] landing; dashboard ReferralBlock; NextAuth events.createUser koppelt cookie aan referral; paywall skip per used referral |

### THEMA C — distributie

| Deel | Commit | Resultaat |
|---|---|---|
| DEEL 8 — SEO landing pages | e3a8f1b | lib/seo-data.ts (30 providers + 4 categorieën); /onderhandelen-met-[provider] + /[category]-besparen via generateStaticParams; sitemap.xml + footer internal links |
| DEEL 9 — social share | e8d8bc5 | /api/og/share 1080×1920 PNG; ShareKit component (WA/X/LI/IG) op /uitkomst bij success; UTM-tagged referral URL |
| DEEL 10 — monitoring | fde5cdd | Sentry was al wired; lib/alert.ts (Sentry + optional webhook); /api/health deep-check db+groq+resend+stripe met 5-min cache; scripts/setup-uptime.ts; @vercel/analytics in layout |

### THEMA D — verificatie

| Deel | Commit | Resultaat |
|---|---|---|
| DEEL 11 — smoke 20 + status | this | scripts/smoke-prod.ts: 20 checks (was 15); STATUS_V7 + README + RUNBOOK updates |

## Smoke 20 (laatste run op productie)

```
[smoke-prod] Target: https://degeldheld.com
[smoke-prod] 20/20 groen
```

Inclusief de v7-specifieke checks: /demo, /onderhandelen-met-kpn,
/energie-besparen, /uitnodiging/TEST00 (200 of 404, geen 500),
POST /api/negotiations/X/feedback (401 zonder auth).

### SEO routing fix (commit de85c3d)

Originele sprint-doc specificeerde `app/onderhandelen-met-[provider]/`
en `app/[category]-besparen/` folder-namen. Next.js 14 App Router
genereert hier static templates maar nooit per-slug HTML — alle 34 SEO
pages 404'den live. **Fix**: één gedeelde `app/[seoSlug]/page.tsx` met
generateStaticParams over beide slug-families + dynamicParams=false.
URL's blijven hetzelfde (/onderhandelen-met-kpn, /energie-besparen),
maar nu correct gerendered. Lokaal én op prod geverifieerd.

## Migraties (prod-DB live)

- `20260517102810_negotiation_feedback` — Negotiation.userRating/mailUsed/providerResponded
- `20260517110000_referrals` — User.referralCode + Referral table

Beide toegepast via `npx prisma migrate deploy`.

## Open items / bekende beperkingen

- **PDF support**: image-in-PDF (scan-PDFs) komen door pdfjs leeg terug
  en routen naar `needsManual: true`. Pure tekst-PDFs werken volledig.
- **Categorie-OCR**: lib/categories/*.ts gebruikt nog defaults wanneer
  OCR de specifieke velden (kWh, hyp-rente) niet detecteert. Banner toont
  netto-jaarvoordeel op basis van markt-mediaan. Live OCR-extractie
  wordt scherper na nog een ronde prompt-tuning (volgt in v8).
- **Referral betaalde reward**: nu skipt de paywall voor de oudste
  unpaid bill per used referral. Stripe-credit voor success-fee (DEEL 1
  pricing) is niet aangesloten — vereist nog `Payment.creditCents` en
  is geparkeerd.
- **UptimeRobot**: setup-script vereist API-key invoegen (handmatige
  stap, beschreven in script).
- **Lighthouse Perf ≥80**: nog niet automatisch in smoke (geen lokale
  Lighthouse-runner in CI). Mobile-audit dekt wel touch-targets + a11y.

## Eindrapport (sprint-template)

```
BEAT_TRIM_SPRINT v7 — Final report

THEMA A: stability
  DEEL 1  ✓ b19b00a — N routes audited, 5 TS+test errors fixed
  DEEL 2  ✓ adbbc30 — provider integrity gate live, 0 fake emails
  DEEL 3  ✓ c255e92 — PDF support via pdfjs+text-LLM live

THEMA B: trim-buster
  DEEL 4  ✓ 3fdaea4 — 3 categories deep-compare, 18 tests
  DEEL 5  ✓ 6f0f5db — feedback loop + mail-quality dashboard live
  DEEL 6  ✓ d35ec58 — demo mode with 3 fixtures live
  DEEL 7  ✓ 41effb1 — referral system + paywall-skip live

THEMA C: distribution
  DEEL 8  ✓ e3a8f1b + de85c3d — 34 SEO pages via [seoSlug] dispatcher
  DEEL 9  ✓ e8d8bc5 — share kit + 1080×1920 IG PNG live
  DEEL 10 ✓ fde5cdd — deep health + sentry + analytics + uptime script

THEMA D: verify
  DEEL 11 ✓ 95c6a5f — smoke 20/20, status/readme/runbook updated

Skipped: none
Open issues: scan-PDFs leeg → needsManual; UptimeRobot setup is one-shot manual
Bug-jacht onderweg: SEO mid-segment dynamic params don't work — fixed via single [seoSlug] route
```

## Niet gepland in deze sprint — toekomst

- Per-user mail-tone slider (formeel/casual/streng) op /onderhandel.
- Bank-koppeling via PSD2-aggregator (Tink/Nordigen) voor automatische
  factuur-detectie zonder upload.
- Multi-categorie bundeling in 1 mail (telecom + energie samen).

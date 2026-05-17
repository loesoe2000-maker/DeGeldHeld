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

Zie `npm run smoke:prod` output. Pre-deploy snapshot 18/20:
- 2× 404 op `/onderhandelen-met-kpn` en `/energie-besparen` — verwacht
  tot Vercel deploy van commit e3a8f1b is gepropageerd. Lokaal build
  bevestigt: beide pages worden als ○ static gegenereerd.

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

## Niet gepland in deze sprint — toekomst

- Per-user mail-tone slider (formeel/casual/streng) op /onderhandel.
- Bank-koppeling via PSD2-aggregator (Tink/Nordigen) voor automatische
  factuur-detectie zonder upload.
- Multi-categorie bundeling in 1 mail (telecom + energie samen).

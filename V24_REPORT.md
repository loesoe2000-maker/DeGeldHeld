# V24_REPORT — Growth Sprint V24

**Datum:** 2026-05-21
**Branch:** main
**Commits:** `229e1bc` (analytics) · `67a6dbb` (ocr) · `17ea57f` (seo) · `<dit report>` (docs)
**Co-author trailer:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` op elke commit.

---

## QA-gate (per deeltaak gedraaid, allemaal EXIT 0)

| Gate | Resultaat |
|------|-----------|
| `npm test` (vitest) | **1771 passed** / 190 files |
| `npx tsc --noEmit` | **EXIT 0** |
| `npm run build` | **EXIT 0** — alle routes prerenderen |
| `npx playwright test` (DEEL 4 aggregate) | **64 passed / 2 failed** — zie noot hieronder |

> **Geen** `--no-verify`, **geen** `--force` gebruikt. Pre-commit hook draaide op elke commit.

### Noot over de 2 e2e-failures (pre-existing, niet V24)
`tests/e2e/multi-round.spec.ts` heeft 2 falende tests:
- `multi-round: plak provider-response, krijg counter-mail`
- `outcome: token-link werkt zonder login`

Beide falen op een **server-side redirect naar `/login`** die plaatsvindt vóór
enige V24-code rendert. Oorzaak: de Playwright `webServer` krijgt in
`playwright.config.ts` alleen `GROQ_VISION_MOCK` + `NODE_ENV` mee — **niet**
`OUTCOME_TOKEN_SECRET` of `NEXTAUTH_SECRET`. De test-process tekent het
HMAC-outcome-token / de sessie-cookie met een fallback-secret die niet
overeenkomt met wat de dev-server gebruikt → token/cookie afgewezen → redirect.

**Bewijs dat dit niet door V24 komt:** dezelfde 2 tests falen identiek met de
*pre-V24* `components/OutcomeForm.tsx` (teruggezet naar commit `caf1ed4` en
opnieuw gedraaid → 2 failed, exact dezelfde asserts). De enige V24-wijziging in
deze flow zijn client-side `track()`-calls in `OutcomeForm`, die no-op zijn
zonder PostHog-key en pas ná auth renderen.

**TODO (EIGENAAR / los van V24):** geef de e2e-`webServer` in
`playwright.config.ts` ook `OUTCOME_TOKEN_SECRET` + `NEXTAUTH_SECRET` mee (zelfde
fallback-waarden als de specs gebruiken), zodat token-link + sessie-cookie
geaccepteerd worden.

---

## DEEL 1 — PostHog funnel-analytics (privacy-safe, EU)

**Commit:** `229e1bc feat(analytics): PostHog funnel events (privacy-safe, EU)`

Wat gebouwd:
- **`lib/analytics.ts`** — getypte `track(event, props)` / `identify(userId)` /
  `setAnalyticsEnabled()`. `AnalyticsEvent`-union dekt de hele funnel
  (`landing_view`, `upload_started/succeeded/failed`, `analyse_viewed`,
  `ocr_corrected`, `email_generated`, `fee_card_linked`, `relay_authorized`,
  `email_copied`, `email_sent`, `outcome_marked`, `proof_submitted`).
  `AnalyticsProps` accepteert alleen primitives. `track`/`identify` no-op zonder
  `window` of zonder ingeschakelde analytics.
- **`components/PostHogProvider.tsx`** — init **alleen** met
  `NEXT_PUBLIC_POSTHOG_KEY` (anders complete no-op, dus dev/preview falen nooit).
  EU-host default `https://eu.i.posthog.com`, `persistence: "memory"`
  (cookieless tot er een consent-banner is), `person_profiles: "identified_only"`.
- **`components/AnalyticsIdentify.tsx`** — `identify(userId)` op het dashboard.
  **Nooit het e-mailadres** — alleen de opaque userId.
- **`components/TrackEvent.tsx`** — vuurt één event op mount (useRef-guard) zodat
  server components funnel-stappen kunnen loggen.

**Privacy / geen PII:**
- Factuur-/analyse-content gemaskeerd met **`.ph-no-capture`**: de hele
  `<main>` van de analyse-pagina + de e-mail-content-div. Autocapture/heatmaps/
  session-recording vangen daar dus geen persoonlijke data.
- `session_recording: { maskAllInputs: true, maskTextSelector: ".ph-no-capture" }`.
- `sanitize_properties` strips query-strings + redact `$current_url`/`$referrer`/
  `$pathname` (geen billId/token-lek via de URL).
- Events bevatten alleen niet-identificeerbare props (bv. `category`,
  `hasAmount: boolean`, `reason: "http_500"`) — nooit bedrag, naam of klantnummer.

**AVG / sub-processor (guardrail #3):** PostHog toegevoegd als sub-processor in
`app/privacy/page.tsx` + `docs/VERWERKERSOVEREENKOMSTEN.md` (incl. EIGENAAR-actie:
DPA accepteren). Cookieless-modus → geen consent-banner vereist voor de huidige
config.

Tests: `tests/analytics.test.ts` (no-op zonder key, sanitizers, masking aanwezig
op analyse-/email-pagina + PostHogProvider-config + identify lekt geen `.email`).

---

## DEEL 2 — OCR inline-correctie

**Commit:** `67a6dbb feat(ocr): inline correction for misread provider/amount/category`

Wat gebouwd:
- **`app/api/bills/[id]/correct/route.ts`** — `POST`, owner-only
  (`findFirst {id, userId}` → 404 als niet van de caller, 401 zonder sessie).
  Zod-validatie (provider ≤80, `monthlyCents` positief int ≤100000, category);
  vereist ≥1 veld. Onbekende category **én** AFM-gegate category (HYPOTHEEK/
  VERZEKERING via `isSupportedCategory`) → 400. Correctie van het bedrag zet
  zowel `monthlyCents` als `amountCents` (fixt `amountCents=0`-OCR-fails die de
  vergelijking platlegden).
- **`components/OcrCorrectionForm.tsx`** — provider (datalist), bedrag, category
  (alleen supported opties, geen hyp/verz). POST naar `/correct`, `track("ocr_corrected")`
  per gewijzigd veld, `router.refresh()`. Getoond in de OCR-failed-fallback én op
  de geslaagde analyse-render.

Tests: `tests/ocr-correct.test.ts` (401 / owner-scope 404 / lege body 400 /
bedrag-correctie / provider+category / gated-category-rejectie / unknown-category +
non-positief bedrag).

---

## DEEL 3 — SEO landing pages: verbreed + verdiept

**Commit:** `17ea57f feat(seo): broaden + deepen provider/category landing pages`

**Verwijderd (guardrail #4 — AFM/Wft-gegate):** alle hypotheek- en
verzekering-SEO-pagina's uit `lib/seo-data.ts` (`SEO_PROVIDERS` + `SEO_CATEGORIES`).
De `SeoCategoryKey`-union is versmald tot supported categorieën.
Footer-links naar `/hypotheek-besparen` + `/verzekering-besparen` vervangen.
Build bevestigt: **0 hyp/verz-pagina's** in `.next/server/app`.

**Verbreed naar supported categorieën:**
- **STREAMING** → 8 providers (Netflix, Spotify, Disney+, HBO Max + nieuw
  Videoland, Viaplay, Amazon Prime, Apple TV+).
- **GYM / sportabonnement** (nieuw) → Basic-Fit, SportCity, Fit For Free,
  Anytime Fitness, TrainMore.
- TELECOM (10) + ENERGIE (8) blijven.
- **4 category-pagina's:** `telecom`, `energie`, `streaming`, `sportschool`.
- Totaal **31 provider- + 4 category-pagina's = 35 SEO-pagina's**, allemaal
  statisch geprerenderd (geverifieerd in de build).

**Verdiept (elke pagina):**
- Provider-pagina: bespaartip-blok + concrete besparingsrange uit
  `CATEGORY_RULES.typicalSavingPct` + mini-FAQ (3 vragen).
- Category-pagina: jaarvoordeel-cijfer + mini-FAQ (3 vragen).
- Interne links provider ↔ category ↔ `/onderhandel`-CTA.

**Geen gehallucineerde content/prijzen (guardrail #4):** bedragen zijn
generiek-veilige richtbedragen; de stale "€4,99 per bill" is vervangen door het
echte model (**eerste 3 onderhandelingen gratis, daarna 20% no-cure-no-pay**).

`app/sitemap.ts` genereert automatisch mee uit `SEO_PROVIDERS` + `SEO_CATEGORIES`
— bevat dus exact de 35 nieuwe pagina's en geen gated pagina's.

Tests: `tests/seo-pages.test.ts` (≥30 providers, exact 4 supported categories
`energie/sportschool/streaming/telecom`, expliciete assert dat hyp/verz **niet**
voorkomen, slug round-trip, generateStaticParams-shape).

---

## DEEL 4 — Aggregate + dit rapport

**Commit:** `docs(v24): analytics + ocr-correction + seo verified`

Volledige suite opnieuw gedraaid (zie QA-gate boven). `V24_REPORT.md`
geproduceerd met EIGENAAR-stappen hieronder.

---

## EIGENAAR-stappen voor PostHog (handmatig, buiten de codebase)

De code is **volledig no-op zonder key** — analytics doet pas iets nadat jij dit
hebt gedaan:

1. **Account + EU-hosting**
   - Maak een account op [eu.posthog.com](https://eu.posthog.com) (EU-region,
     niet US — vereist voor AVG).
   - Maak een Project aan voor DeGeldHeld.

2. **Keys ophalen**
   - Project Settings → kopieer de **Project API Key** (begint met `phc_…`).
   - Host = `https://eu.i.posthog.com`.

3. **Vercel env-vars zetten** (Production + Preview)
   - `NEXT_PUBLIC_POSTHOG_KEY` = `phc_…`
   - `NEXT_PUBLIC_POSTHOG_HOST` = `https://eu.i.posthog.com`
   - **Redeploy** (env-vars met `NEXT_PUBLIC_`-prefix worden in de build gebakken).

4. **DPA / sub-processor afhandelen** (AVG, guardrail #3)
   - Accepteer in PostHog de **Data Processing Agreement** (Settings → Legal/DPA).
   - PostHog staat al vermeld in `app/privacy/page.tsx` +
     `docs/VERWERKERSOVEREENKOMSTEN.md` — controleer dat de tekst klopt met je
     account.
   - Huidige config is **cookieless** (`persistence: "memory"`) → geen
     consent-banner vereist. Wil je later session-recording met cookies of
     cross-session identificatie? Dán eerst een consent-banner bouwen.

5. **Funnel opbouwen in PostHog** (Insights → Funnels)
   Aanbevolen funnel op de events die de code al stuurt:
   ```
   upload_started  →  analyse_viewed  →  email_generated  →  fee_card_linked
   ```
   Aanvullende events om op te dashboarden: `landing_view` (top-of-funnel),
   `upload_failed` (met `reason`), `ocr_corrected` (OCR-kwaliteit),
   `email_copied` / `email_sent`, `relay_authorized`, `outcome_marked`
   (met `result`), `proof_submitted` (met `verdict`).

6. **Verifieer privacy in productie**
   - Open de analyse- en e-mail-pagina, check in PostHog dat session-recordings
     de factuur-/analyse-content **gemaskeerd** tonen (`.ph-no-capture`).
   - Check dat events **geen** bedrag/naam/klantnummer en **geen** query-string
     in `$current_url` bevatten.

7. **SEO-pagina's die nu live gaan** (sitemap genereert ze automatisch)
   - 4 category-pagina's: `/telecom-besparen`, `/energie-besparen`,
     `/streaming-besparen`, `/sportschool-besparen`.
   - 31 provider-pagina's: `/onderhandelen-met-{kpn,vodafone,…,basic-fit,…}`.
   - **Geen** `/hypotheek-besparen` of `/verzekering-besparen` meer — dien een
     **removal-request** in Google Search Console in voor die oude URL's (ze
     geven nu 404), zodat ze uit de index verdwijnen.

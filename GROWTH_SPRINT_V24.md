# DeGeldHeld v24 — Funnel-analytics + OCR-correctie + SEO-uitbreiding

Drie groei-verbeteringen: (#1) funnel-analytics om te zien wáár bezoekers
afhaken (urgent vóór de TikTok-traffic), (#2) OCR-correctie zodat misgelezen
uploads niet doodlopen, (#5) de bestaande SEO-landingspagina's uitbreiden.

**Draai dit ná v23** (v23 raakt de email/relay-flow; #2 raakt de analyse-flow).

## ⚠️ GUARDRAILS
1. **`npm run build` (EXIT 0) vóór élke commit.**
2. **Analytics privacy-veilig:** GEEN PII in events (geen factuurtekst, e-mail,
   naam, klantnummer). Alleen stappen + categorie/provider/bedragen. EU-hosting.
3. **PostHog = nieuwe sub-verwerker** → toevoegen aan privacyverklaring +
   `docs/VERWERKERSOVEREENKOMSTEN.md` + DPA. Cookie/consent: gebruik PostHog's
   cookieless/anonieme modus tenzij een banner bestaat.
4. **Geen gehallucineerde SEO-content/prijzen** — sourced of generiek-veilig.
   Geen hypotheek/verzekering SEO-pagina's (AFM-gegate).
5. Geen `--no-verify`/`--force`; co-author trailer.

## START
```
Lees /Users/bdb/alpharadar-pro/degeldheld/GROWTH_SPRINT_V24.md en voer alle deeltaken in volgorde uit. Per deel: npm test + npx tsc --noEmit + npm run build (EXIT 0) groen voor je commit. Geen PII in analytics-events; geen gehallucineerde SEO-content. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force. Bij blocker na 30 min: TODO-commit en door. Eindig met V24_REPORT.md inclusief EIGENAAR-stappen voor PostHog.
```

---

## DEEL 1 — Funnel-analytics (PostHog)

a. `npm install posthog-js`. Init in een client-provider (in `app/layout.tsx`)
   met env: `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST`. Als de key
   ontbreekt → no-op (geen crash, geen errors in dev/preview).
b. Maak een getypte helper `lib/analytics.ts` met `track(event, props)` zodat
   event-namen consistent zijn. **Nooit PII meesturen.**
c. Instrumenteer de funnel (deze events):
   - `landing_view`
   - `upload_started`, `upload_succeeded` {category, provider, hasAmount},
     `upload_failed` {reason}
   - `analyse_viewed` {category, supported, expectedSavingsCents}
   - `ocr_corrected` {field}  (koppelt aan DEEL 2)
   - `email_generated`, `fee_card_linked`, `relay_authorized`
   - `email_copied` / `email_sent`
   - `outcome_marked` {result}, `proof_submitted`
d. Anonieme bezoekers tracken; bij login `posthog.identify(userId)` (geen
   e-mail). Respecteer de bestaande anonieme flow.
e. **EIGENAAR-stappen** (zet in V24_REPORT.md):
   1. posthog.com → account (kies **EU-hosting**, eu.i.posthog.com — AVG)
   2. Project "DeGeldHeld" → Project Settings → kopieer **Project API Key**
      (`phc_…`) + **Host**
   3. Vercel env: `NEXT_PUBLIC_POSTHOG_KEY` = `phc_…` ·
      `NEXT_PUBLIC_POSTHOG_HOST` = `https://eu.i.posthog.com` → redeploy
   4. PostHog → DPA accepteren; PostHog toevoegen aan privacyverklaring +
      sub-verwerker-lijst
   5. Na traffic: bouw in PostHog een funnel
      `upload_started → analyse_viewed → email_generated → fee_card_linked`
f. Tests: `track()` no-op zonder key; events bevatten geen PII-velden.
g. Commit: `feat(analytics): PostHog funnel events (privacy-safe, EU)`.

---

## DEEL 2 — OCR-correctie (misgelezen uploads redden)

Wanneer de OCR een veld misleest, mag de gebruiker het **inline corrigeren**
i.p.v. doodlopen. Bill heeft: `provider`, `category`, `monthlyCents`,
`amountCents`, `subType`.

a. Op de analyse-pagina (en de "konden niet uitlezen"-fallback): een knop
   **"Klopt dit niet? Pas aan"** → een formpje om **provider** (dropdown uit
   de registry), **bedrag** (maandbedrag) en **categorie** te corrigeren.
b. `POST /api/bills/[id]/correct` (auth + ownership): valideert + schrijft de
   correctie naar de Bill, her-draait de comparison met de nieuwe waarden.
   Scope: alleen ondersteunde categorieën (geen hyp/verz).
c. Na correctie → terug naar de analyse met de bijgewerkte besparing. Track
   `ocr_corrected` {field}.
d. Edge: lege/onzin-invoer → nette validatie-fout, geen crash.
e. Tests: correctie van bedrag/categorie/provider → Bill bijgewerkt +
   comparison herberekend; niet-eigenaar → 403.
f. Commit: `feat(ocr): inline correction for misread provider/amount/category`.

---

## DEEL 3 — SEO-landingspagina's uitbreiden (#5)

De `[seoSlug]`-pagina's bestaan (`lib/seo-data.ts`: SEO_PROVIDERS +
SEO_CATEGORIES). Verbreed + verdiep — alleen ondersteunde categorieën.

a. **Verbreed** `SEO_PROVIDERS` met de grote NL-providers per ondersteunde
   categorie (telecom, energie, streaming, gym, internet) en
   `SEO_CATEGORIES` waar zinvol. Geen hyp/verz.
b. **Verdiep** elke pagina: een korte echte-bespaartip-sectie, een mini-FAQ
   (2-3 vragen), de verwachte besparing-range, en een duidelijke CTA naar
   `/onderhandel`. Generiek-veilige content (geen verzonnen specifieke prijzen).
c. **Interne links** tussen provider- en categorie-pagina's + naar de app.
d. **Indexering:** bevestig dat `app/sitemap.ts` alle seoSlug-pagina's bevat +
   correcte `<title>`/meta/OG-tags per pagina (voor Google + deelbaarheid).
e. Tests: `generateStaticParams` levert de nieuwe slugs; elke pagina rendert
   met titel + CTA; sitemap bevat ze.
f. Commit: `feat(seo): broaden + deepen provider/category landing pages`.

---

## DEEL 4 — Aggregate + rapport
a. `npm test -- --run` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** +
   `npx playwright test tests/e2e/`. Alles groen.
b. `V24_REPORT.md`: wat per deel gebouwd is + de **EIGENAAR-stappen voor
   PostHog** (account/key/Vercel/DPA/funnel) + welke SEO-pagina's toegevoegd.
c. Commit: `docs(v24): analytics + ocr-correction + seo verified`.

---

## Done-criteria
- [ ] PostHog funnel-events live, privacy-veilig (geen PII), no-op zonder key
- [ ] OCR-correctie: gebruiker fixt provider/bedrag/categorie → her-analyse
- [ ] SEO-pagina's verbreed + verdiept + in sitemap, geen hyp/verz
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] V24_REPORT.md met PostHog-eigenaar-stappen

## Eindrapportage
```
GROWTH_V24 — Final report
DEEL 1  ✓ <hash> — PostHog funnel-analytics
DEEL 2  ✓ <hash> — OCR inline-correctie
DEEL 3  ✓ <hash> — SEO-pagina's uitgebreid
DEEL 4  ✓ <hash> — rapport + eigenaar-stappen
```

**Na deze sprint zie je wáár bezoekers afhaken (analytics), verlies je geen
misgelezen uploads (correctie), en vang je meer organisch zoekverkeer (SEO).**

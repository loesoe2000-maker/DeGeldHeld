# V22_REPORT — Legal Compliance + Real Provider Prices

Twee dingen: (A) juridische compliance + AFM-risico weg (hyp/verz uit), en
(B) échte, gesourcete NL-markt-prijzen voor de ondersteunde categorieën.
`PRICES_AS_OF = 2026-05-20`.

## Eindrapportage

```
LEGAL_PRICING_V22 — Final report

DEEL 1  ✓ f60bcf6 — hyp/verz gated (AFM-risico weg)
DEEL 2  ✓ c53c5cb — privacyverklaring + register + DPA-lijst + datalek
DEEL 3  ✓ ed78ffa — voorwaarden + disclaimers + footer
DEEL 4  ✓ e656bdf — MarketPlan-type met verplichte bron
DEEL 5  ✓ 10b69b0 — echte prijzen (streaming/software/opslag) gesourcet
DEEL 6  ✓ 892387f — prijzen doorgevoerd in vergelijking
DEEL 7  ✓ <dit commit> — build groen + rapport + eigenaar-actielijst
```

## Compliance

### Gated: hypotheek + verzekering (Wft / AFM)
Eén bron van waarheid: `lib/market-coverage.ts` → `UNSUPPORTED_CATEGORIES` +
`isSupportedCategory()`. Gevolgen:
- **Analyse-pagina**: hyp/verz krijgen een nette "niet ondersteund"-staat —
  geen vergelijking, geen besparing, geen onderhandel-mail-CTA. De oude
  VERZEKERING/HYPOTHEEK-renderblokken zijn verwijderd.
- **E-mail-pagina**: redirect hyp/verz terug naar analyse vóór er een
  negotiation wordt aangemaakt.
- **Comparison-laag**: `getCheaperAlternatives` + `getMarketRange` geven niets
  terug voor hyp/verz (defence in depth).
- **CategoryUploadGrid**: VERZEKERING-tegel weg (hypotheek was alleen een
  WONEN-subtype; WONEN blijft voor water/gemeente).
- `lib/categories/{hypotheek,verzekering}.ts` + de enum-waarden blijven
  bestaan (gemarkeerd INACTIVE) → geen dangling imports.

### Juridische documenten (allemaal CONCEPT — jurist/DPO-review nodig)
- **`/privacy`** herschreven: 7 sub-verwerkers (Vercel, Neon, Resend, Groq,
  Stripe, Cloudflare, Sentry) met doel + locatie; per gegevenscategorie het
  doel + de AVG-grondslag; bewaartermijnen incl. anonieme bills (24u-cron);
  rechten → /account (export + verwijderen).
- **`docs/VERWERKINGSREGISTER.md`** (art. 30) — 7 verwerkingen, afgeleid uit
  het echte schema + de sub-verwerkers.
- **`docs/VERWERKERSOVEREENKOMSTEN.md`** — DPA-checklist per sub-verwerker.
- **`docs/DATALEK_PROTOCOL.md`** — detectie→indammen→AP-melding <72u→loggen.
- **`/voorwaarden`** herschreven: geen financieel advies (Wft) + hyp/verz
  niet aangeboden; no-cure-no-pay fee + betaalmandaat; geen besparingsgarantie.
- **`LegalFooter`** in de root-layout → privacy + voorwaarden op élke pagina.

## Prijzen — dekking per categorie (met bronnen)

Alle prijzen via WebFetch op de officiële publieke pagina's, geverifieerd op
**2026-05-20**, elk met `source`-URL + `verifiedAt` in `SOURCED_MARKET_PLANS`
(`lib/market-prices.ts`). Het `MarketPlan`-type heeft een **verplichte
`source`** → een prijs zonder bron compileert niet.

| Categorie | # plannen | Bronnen |
|-----------|-----------|---------|
| **STREAMING** | 10 | Spotify (4) — spotify.com/nl/premium · Netflix (3) — help.netflix.com/nl/node/24926 · Disney+ (3) — disneyplus.com/nl-nl |
| **SOFTWARE** | 2 | Microsoft 365 Personal/Family — microsoft.com/nl-nl/microsoft-365/buy/compare-all-microsoft-365-products |
| **OPSLAG** | 9 | iCloud+ (5) — support.apple.com/nl-nl/108047 · Google One (3) — one.google.com/about/plans · Dropbox Plus — dropbox.com/plans |

**Totaal: 21 gesourcete plannen.** De analyse-vergelijking gebruikt deze
échte prijzen voor STREAMING/SOFTWARE/OPSLAG-facturen; energie/water blijven
op de gedateerde tarief-medians; telecom houdt de bestaande seed-data.

### Categorieën met weinig/geen verifieerbare data deze run (bewust weggelaten)
- **TELECOM**: sim-only/internet-prijzen zijn component-gebaseerd
  (los data- + bel-bundeltje) en promo-beladen (bv. Simyo "€6,50 → €11 na
  6 mnd") → geen schone, vergelijkbare maandprijs te sourcen. Bestaande
  indicatieve seed-data blijft staan; **TODO** voor een gerichte refresh.
- **ENERGIE / WATER**: bewust op de gedateerde tarief-medians gehouden
  (`ENERGY_MEDIANS`/`WATER_MEDIANS`, binnen de door het script genoemde
  ranges). Een ACM-gesourcete refresh is een **TODO**.
- **GYM / OV**: provider-pagina's waren niet schoon fetchbaar deze run
  (Basic-Fit 404, NS niet gehaald) → **niets verzonnen, weggelaten**.
- **HYPOTHEEK / VERZEKERING**: buiten scope (gated).
- **BANK**: geen schone publieke maandprijzen gesourcet deze run.

> Guardrail gerespecteerd: **nul gehallucineerde prijzen.** Een ontbrekende
> prijs is oké; een verzonnen prijs niet. De maandelijkse refresh-procedure
> staat boven `SOURCED_MARKET_PLANS`.

## Verificatie

- `npx tsc --noEmit`: **clean**.
- `npm test -- --run`: **1700 passed**, 2 failed = de bekende pre-existing
  FAQ-failures (commit `b351a61`, BACKLOG — buiten scope).
- **`npm run build`: EXIT 0** vóór élke commit (de harde guardrail).
- `npx playwright test tests/e2e/`: de v22-relevante e2e (analyse-categorie-
  gating) **groen**; 62+ passed. **2 e2e-failures** in `multi-round.spec.ts`
  zijn **niet** v22-gerelateerd: die signen de sessie-cookie met een
  fallback-secret die niet matcht met de `AUTH_SECRET` van de lokale
  dev-server (→ redirect naar /login) — een env/secret-mismatch in de lokale
  e2e-harness, los van deze sprint (TELECOM-pad, geen gating).

## 🧑 EIGENAAR — actielijst

1. **DPA's tekenen** bij elke sub-verwerker — zie
   `docs/VERWERKERSOVEREENKOMSTEN.md` (Vercel, Neon, Resend, Groq, Stripe,
   Cloudflare, Sentry; + MailerLite/Twilio indien ingezet). Vink af in dat
   bestand zodra getekend.
2. **Privacyverklaring + voorwaarden door een jurist laten checken** (beide
   gemarkeerd als concept). Idem het verwerkingsregister + datalek-protocol.
   Stel zo nodig een echt `privacy@degeldheld.com` in + beoordeel of een FG/DPO
   verplicht is.
3. **AFM**: hyp/verz zijn nu uit. Wil je die ooit aanbieden → eerst de
   AFM-vergunning regelen, dán de gating in `lib/market-coverage.ts` opheffen.
4. **Markt-prijzen maandelijks verversen** volgens de procedure boven
   `SOURCED_MARKET_PLANS` (en RUNBOOK "Markt-prijzen verversen"): controleer de
   `source`-URLs, werk `priceCents` + `verifiedAt` bij, bump `PRICES_AS_OF`,
   verwijder niet-meer-verifieerbare prijzen.
5. **Vervolg-research** (optioneel): telecom (schone maandprijzen of
   component-model), energie/water (ACM-gesourcet), gym/OV/bank.
6. **Marketing-copy 15% → 20%**: de fee is in de voorwaarden nu 20%, maar
   sommige marketing-teksten/metadata noemen nog "15%". Buiten scope van deze
   sprint — aanrader om dat consistent te trekken.

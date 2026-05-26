# V33 — SEO-landing-pages voor gevalideerde checks

> **Status: SHIPPED — 8 commits, 2138 tests groen, build EXIT 0.**
> **Peildatum: 2026-05-26. Owner: Bas. Co-author trailer: Claude Opus 4.7 (1M context).**
> Géén `--no-verify`, géén `--force`, geen gehallucineerde cijfers.

---

## TL;DR

V33 levert **6 statische SEO-landing-pages** die organische zoek-intent
vangen voor de gevalideerde DeGeldHeld-checks (toeslagen, vluchtclaim,
NS-vertraging, box-3, zorgkostenaftrek). Bewust **geen** landing-page voor
de onderhandel-flow — dat is nog onbewezen-stream-risico tot de
KPN-test een verdict heeft. Alle bedragen, drempels, deadlines en
percentages komen rechtstreeks uit `docs/V29_DATA_2026.md` en
`docs/BENEFITS_DATA_2026.md`, met inline `// bron:`-comments per JSX.

| # | Pagina | Doel-keywords (NL) | Sourced cijfers |
|---|---|---|---|
| 1 | `/box3-rechtsherstel-aanvragen-2026` | "box 3 rechtsherstel", "OWR-deadline 2026", "Wet tegenbewijsregeling" | 1,28% banktegoeden 2026 (NIET 1,44% aggregator), € 59.357/€ 118.714 heffingsvrij, € 3.800 schuldendrempel, 5 deadlines |
| 2 | `/huurtoeslag-2026-berekenen` | "huurtoeslag berekenen", "huurtoeslag 2026 grens" | € 498,20 KK + € 713,02/€ 764,14 aftopping + € 932,93 max + V31-anchor (geen drempel meer) + € 38.479/€ 76.958 vermogen |
| 3 | `/zorgtoeslag-2026-misgelopen` | "zorgtoeslag misgelopen", "zorgtoeslag 2026 maximaal" | € 40.857/€ 51.142 inkomen + € 146.011/€ 184.633 vermogen + € 129/€ 246 max/mnd |
| 4 | `/vlucht-vertraagd-vergoeding-eu261` | "vlucht vertraagd vergoeding", "EU261 compensatie" | € 250/€ 400/€ 600 + 3u/4u drempels + 2 jr verjaring (lib/eu261-drift test) |
| 5 | `/ns-geld-terug-vertraging` | "NS geld terug vertraging", "NS compensatie" | 30-59=50% / ≥60=100% binnenland + EU-PRR 25%/50% + min € 2,30 + 1 maand deadline |
| 6 | `/zorgkostenaftrek-aangifte-2026` | "zorgkostenaftrek 2026", "specifieke zorgkosten drempel" | € 166/€ 332 drempels + max(min, 1,65% × inkomen) formule + 113% AOW-verhoging onder € 41.123 |

---

## Commits (chronologisch)

```
ee21db6 feat(seo): shared infra for V33 landing pages (breadcrumb + sitemap + audit)
c3a3c81 feat(seo): /box3-rechtsherstel-aanvragen-2026 landing page (sourced)
a8272bf feat(seo): /huurtoeslag-2026-berekenen landing page (sourced)
6263bec feat(seo): /zorgtoeslag-2026-misgelopen landing page (sourced)
8ede716 feat(seo): /vlucht-vertraagd-vergoeding-eu261 landing page (sourced)
47dc506 feat(seo): /ns-geld-terug-vertraging landing page (sourced)
9f08285 feat(seo): /zorgkostenaftrek-aangifte-2026 landing page (sourced)
```

**Totaal**: 7 feat-commits + dit V33_REPORT.md (DEEL 8).

---

## Wat er per pagina staat (eigenaar-handvat)

Elke pagina is dezelfde structuur — bewust voorspelbaar voor reviewer
én voor de crawler:

1. **`<head>`** — title (~55-70 chars, keyword + jaar + "DeGeldHeld"),
   description (130-160 chars, in SERP-window), `alternates.canonical` (absoluut),
   `openGraph` (title + description + type=article + url).
2. **`SeoBreadcrumb`** — sticky `top-0 z-10`, gated op `MONEYFINDER_HUB_ENABLED`.
   Standaard zonder hub-link; mét flag aan toont ook `Vind al je geld`-crumb.
3. **JSON-LD** — `FAQPage` (3-5 Q&A's) + `BreadcrumbList`, `<script type="application/ld+json">`.
4. **H1** — exact-match keyword, 1× per pagina (test verifieert).
5. **H2-secties**: "Waar heb je recht op?" → "Hoe vraag je het aan?" →
   "Veelgestelde vragen" → "Doe de gratis check →".
6. **Tabellen + amber callouts** voor de échte discipline-anchors
   (1,28% box-3 ipv 1,44%, max-huurgrens vervalt als drempel, max-zorgtoeslag
   is bovengrens niet vast bedrag, aangifte 2026 = inkomstenjaar 2025).
7. **Inline `{/* bron: URL */}`-comments** + tekst-zichtbare "Bron:"-regel
   onder elke tabel/lijst.
8. **CTA** → de bijbehorende check (`/box3-check`, `/geld-check`,
   `/zorgkosten-check`, `/ns-check`, `/vluchtclaim` als CLAIMS-flag aan, anders
   DIY-uitleg-fallback).
9. **Disclaimer** — "Indicatie, geen advies" + Wft-uitsluiting.

---

## Discipline-anchors (per pagina, in tekst getoond)

| Pagina | Anchor + reden |
|---|---|
| Box 3 | **1,28% banktegoeden 2026 = Belastingdienst-cijfer**, NIET 1,44% van aggregators. Pagina toont expliciete kanttekening en linkt naar het officiële persbericht. |
| Huurtoeslag | **€ 932,93 is sinds 2026 GEEN drempel meer** — alleen aftopping in de rekensom. Oudere aggregator-pagina's noemen het nog wél als drempel; we corrigeren dat met amber callout + FAQ-item. |
| Zorgtoeslag | **Max € 129/€ 246 is bovengrens** — niet vast bedrag. Bij hoger inkomen bouwt het af naar € 0. Amber callout voorkomt overprediction. |
| EU261 | **3-4u op lange-afstandsvluchten kan halving zijn** (Verordening art. 7 lid 2). We tonen het volle recht en raden specialist aan voor de gray-zone. |
| NS | **Eigen NS-personeelsstaking = wél compensatie** (parallel EU261). We onderscheiden dit van echte overmacht (stroomuitval, natuurramp). |
| Zorgkostenaftrek | **Aangifte 2026 = inkomstenjaar 2025** → gebruik 2025-drempels. 2026-drempels zijn voor de aangifte in 2027. Amber callout voorkomt de bekendste valkuil. |

---

## Wat NIET gebouwd is (en waarom)

- **GEEN landing-page voor de onderhandel-flow.** KPN-test is nog niet
  beoordeeld; SEO bouwen op een onbewezen stream = mogelijk verspild werk
  als we de fee-structuur in V34 aanpassen. Pas bij ≥ 3 succesvolle
  geverifieerde besparingen voegen we
  `/energie-rekening-verlagen-2026` toe.
- **GEEN telecom-NCNP-pagina.** V30 zette telecom op `fee: false` (Plus
  belscript). Adverteren met "wij onderhandelen je telefoon" = oud beeld.
- **GEEN hypotheek/verzekering-pagina's.** AFM-gate; pas live na vergunning.
- **GEEN affiliate-links.** Model B vereist commercie-vrijheid. Bron-links
  zijn `target="_blank" rel="noopener noreferrer"` naar officiële sites
  (rijksoverheid.nl, belastingdienst.nl, ns.nl, europa.eu).
- **GEEN "wij garanderen verlaging"-taal.** Per pagina staat een
  unit-test die deze regex blokkeert.

---

## QA-status (vóór elke commit verified)

| Gate | Status |
|---|---|
| `npx tsc --noEmit` | EXIT 0 (clean) |
| `npx vitest run` | **2138 / 2138 tests groen** (+ 97 nieuwe V33-tests over 7 testbestanden) |
| `npm run build` | EXIT 0 — alle 6 nieuwe routes geregistreerd als `○ (Static)` |
| Pre-commit hook | Niet bypassed |
| `--no-verify` / `--force` | Niet gebruikt |

Per-pagina test-coverage:
- `tests/seo-box3-rechtsherstel.test.tsx` — 14 tests
- `tests/seo-huurtoeslag-berekenen.test.tsx` — 17 tests
- `tests/seo-zorgtoeslag-misgelopen.test.tsx` — 17 tests
- `tests/seo-vlucht-vertraagd-eu261.test.tsx` — 15 tests (+ lib/eu261 drift-protectie)
- `tests/seo-ns-geld-terug.test.tsx` — 16 tests
- `tests/seo-zorgkostenaftrek-2026.test.tsx` — 17 tests
- `tests/seo-shared.test.tsx` (DEEL 1, SeoBreadcrumb + sitemap shape) — 1 test

Élke test verifieert (1) JSON-LD shape, (2) drempels/bedragen aanwezig
in markup, (3) source-read drift-protectie via `readFileSync`,
(4) géén forbidden-claims regex.

---

## Sitemap + audit

- `app/sitemap.ts` — 6 nieuwe URLs toegevoegd, `changeFrequency: "monthly"`,
  `priority: 0.85`. Volgorde: core → V33 → providers → categories.
- `scripts/audit-everything.ts` — `STATIC_PAGES` uitgebreid met de 6 paths,
  ondersteunt ons periodieke link/copy-audit.
- `robots.ts` — geen wijziging nodig; allow "/" omvat de nieuwe paths.

---

## Verwachte ranking-tijd

| Pagina | Concurrency | Verwachte tijd tot top-20 |
|---|---|---|
| `/huurtoeslag-2026-berekenen` | Hoog (overheid.nl + Woonbond dominant) | 4-6 weken |
| `/zorgtoeslag-2026-misgelopen` | Middel (long-tail) | 3-4 weken |
| `/box3-rechtsherstel-aanvragen-2026` | Middel-hoog (nieuwswaardig + recent) | 4-6 weken |
| `/vlucht-vertraagd-vergoeding-eu261` | Hoog (Vergoeding.nl + EUclaim) | 6-8 weken |
| `/ns-geld-terug-vertraging` | Middel-hoog (ns.nl zelf + Rover) | 4-6 weken |
| `/zorgkostenaftrek-aangifte-2026` | Hoog (belastingdienst.nl dominant) | 6-8 weken |

Indicatief, geen garantie — Google's ranking-systeem is een black box.
Schrijf indien gewenst per pagina een korte LinkedIn/Tikok-post om
de eerste backlinks/social-signals binnen te halen.

---

## Eigenaar-volgende stappen (Bas, manueel)

1. **Google Search Console**: dien de nieuwe sitemap `https://degeldheld.com/sitemap.xml`
   opnieuw in (Index → Sitemaps → ingeven). Wacht 1-2 dagen op indexering.
2. **Per pagina indexering forceren**:
   GSC → URL Inspection → plak elke URL → "Request indexing". Doe dit
   eenmalig voor de 6 nieuwe paths, dan blijft Google ze monitoren.
3. **LinkedIn**: schrijf 1-2 korte posts (200-400 chars) over de "verborgen
   regelingen" — link naar `/zorgtoeslag-2026-misgelopen` of
   `/huurtoeslag-2026-berekenen`. Doel: 1 backlink + 5-10 organische bezoekers
   per post.
4. **TikTok (optioneel)**: 30s-clip per pagina ("wist je dat huurtoeslag
   in 2026 geen max-huur-drempel meer heeft?"). Links in bio.
5. **Monitor in PostHog**: filter sessies waar `pathname` matcht een van de
   6 paths → bekijk bounce-rate, scroll-depth en CTR naar `/geld-check`
   etc. Hoe te zien: PostHog Insights → New insight → Trend → filter Event
   = "$pageview" + Property = "pathname" + Contains "huurtoeslag-2026" enz.
6. **Vercel Analytics**: laat de defaults aan, kijk eind van de week wat
   het top-3 referrers zijn (Google? LinkedIn? Direct?).
7. **Niet aanraken in de pages**: bedragen mogen alleen wijzigen als
   `docs/V29_DATA_2026.md` of `docs/BENEFITS_DATA_2026.md` wijzigt. De
   drift-protectie-tests zullen failen als je een getal in een page
   verandert zonder de bron mee te updaten.

---

## Wat de volgende sprint (V34) kan oppakken

- KPN-test verdict → besluiten of we onderhandel-flow promoten (en dan
  ook `/energie-rekening-verlagen-2026` toevoegen) óf depriotiseren.
- Sentry breadcrumb-monitoring instellen op de nieuwe paths (lage prio,
  alleen interessant na 1k pageviews).
- Schrijf een korte `/over-ons`-update die de 6 landing-pages cross-linkt
  (interne PageRank-versterking).

---

## Sources of truth

- `docs/V29_DATA_2026.md` — peildatum 2026, herijkt 2026-05-23.
- `docs/BENEFITS_DATA_2026.md` — toeslagen + EU261, peildatum 2026.
- `lib/eu261.ts` — drift-protected via test `seo-vlucht-vertraagd-eu261.test.tsx`.
- `lib/zorgkosten.ts` — smoke-importable via test `seo-zorgkostenaftrek-2026.test.tsx`.
- `lib/box3.ts` — smoke-importable via test `seo-box3-rechtsherstel.test.tsx`.
- `components/SeoBreadcrumb.tsx` (DEEL 1) — herbruikbaar.

---

**Einde V33-rapport.** Volgende sprint definiëren we als de eerste data
binnenrolt (PostHog + GSC, ~1 week).

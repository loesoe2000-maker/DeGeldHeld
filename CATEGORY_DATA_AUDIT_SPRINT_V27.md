# DeGeldHeld v27 — Categorie-dekking + actuele data audit (alle categorieën)

Tot nu toe is vooral **telecom** getest. Deze sprint controleert **élke
ondersteunde categorie** op twee dingen, en vult de gaten:
1. **Provider-dekking** — zitten de grote NL-providers voor die categorie écht
   in de registry (vergelijking + SEO + relay)?
2. **Actuele markt-data** — is er huidige, **gesourcete** prijsdata (niet stale,
   niet verzonnen) met een recente as-of-datum?

**Ondersteunde categorieën** (uit `lib/categories.ts` + `lib/market-coverage.ts`):
**TELECOM · ENERGIE · WATER · STREAMING · GYM · ABONNEMENT.**
**NIET** hypotheek/verzekering — die blijven AFM-gegate (niet toevoegen).

---

## ⚠️ GUARDRAILS
1. **`npm run build` (EXIT 0) + `npx tsc --noEmit` + `npm test` groen vóór élke commit.**
2. **GÉÉN gehallucineerde prijzen of providers.** Alleen data die je via
   **WebFetch** op een officiële/betrouwbare bron bevestigt, met een
   `// bron: <URL>` + as-of-datum. Niet zeker → **weglaten**, niet gokken.
   (Dit is dezelfde regel als `PRICE_REFRESH_PLAYBOOK.md` — volg die.)
3. **AFM-gate:** voeg GEEN hypotheek/verzekering toe; raak de
   `UNSUPPORTED_CATEGORIES` niet aan.
4. **WATER is een regionaal monopolie** — "providers" = de regionale
   waterbedrijven (Vitens, PWN, Dunea, Brabant Water, Evides, WML, Waternet,
   Oasen, WMD). Besparing komt uit verbruik, niet overstappen. Behandel het zo
   (geen "goedkoper alternatief"-claims).
5. **Additief + correcties** — bestaande correcte data niet weggooien; alleen
   ontbrekende providers toevoegen + stale/foute prijzen corrigeren.
6. Geen `--no-verify`/`--force`. Co-author trailer:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## START
```
Lees /Users/bdb/alpharadar-pro/degeldheld/CATEGORY_DATA_AUDIT_SPRINT_V27.md en voer alle deeltaken in volgorde uit. Per deel: npm test + npx tsc --noEmit + npm run build (EXIT 0) groen vóór de commit. GÉÉN gehallucineerde prijzen/providers — alleen WebFetch-geverifieerd met // bron: + as-of-datum, twijfel = weglaten. Geen hypotheek/verzekering toevoegen (AFM-gegate). Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force. Bij blocker na 30 min: TODO-commit en door. Eindig met V27_REPORT.md: per categorie de provider-dekking + prijs-actualiteit + wat toegevoegd/gecorrigeerd is + resterende gaten.
```

---

## DEEL 1 — Audit (inventariseer + maak een gat-lijst, nog niets wijzigen)
a. Lees de bron-files: `lib/categories.ts`, `lib/providers.ts`, `lib/market_db.ts`,
   `lib/market-prices.ts`, `lib/market-coverage.ts`, `lib/seo-data.ts`,
   `lib/relay-providers.ts`.
b. Maak per **ondersteunde categorie** (TELECOM/ENERGIE/WATER/STREAMING/GYM/ABONNEMENT)
   een inventaris:
   - Welke providers staan er nu in `lib/providers.ts` (per land, NL)?
   - Is er markt-prijsdata (`MARKET_PLANS`/market-prices) + wat is de **as-of-datum**?
     Is die **stale** (zie `pricesAreStale`)?
   - Staan ze in SEO (`SEO_PROVIDERS`) en — waar e-mail bestaat — in de
     relay-registry (`lib/relay-providers.ts`)?
c. WebFetch per categorie de **echte huidige NL-marktlijst** (de grote spelers)
   en vergelijk met wat er in de code staat → een concrete **gat-lijst**
   (ontbrekende providers, stale/ontbrekende prijzen). Bewaar de bron-URL's.
d. Commit (alleen een markdown-werkdocument `docs/CATEGORY_AUDIT_WORKSHEET.md`
   met de gat-lijst): `docs(audit): per-category coverage gap-list (sourced)`.

## DEEL 2 — Provider-dekking aanvullen (sourced)
a. Voeg de ontbrekende **grote NL-providers** per categorie toe aan
   `lib/providers.ts` (canonieke naam, netwerk/kenmerk waar relevant), elk met
   `// bron: <URL>`. Niet betrouwbaar te verifiëren → weglaten.
b. Voeg ze waar zinvol ook toe aan `SEO_PROVIDERS` (sourced, generiek-veilige
   content — geen verzonnen specifieke prijzen) en aan de relay-registry als de
   provider een **publiek e-mailadres** heeft (anders niet — zie v26).
c. WATER: zorg dat de regionale waterbedrijven gedekt zijn als monopolie
   (geen overstap-claim).
d. Tests: provider-lookup per categorie vindt de toegevoegde namen;
   anti-hallucinatie-regextest (elke nieuwe entry heeft een `// bron:`).
e. Commit: `feat(providers): broaden NL provider coverage per category (sourced)`.

## DEEL 3 — Markt-prijzen verversen/verifiëren (sourced + as-of)
a. Per categorie: WebFetch de huidige NL-markt-tarieven (mediaan/typische
   prijzen) en werk `MARKET_PLANS`/market-prices bij met **gesourcete** waarden +
   een verse **as-of-datum**. Volg `PRICE_REFRESH_PLAYBOOK.md`.
b. Niet betrouwbaar te sourcen → laat de oude waarde staan en **markeer als
   "te verifiëren"** in het rapport (niet gokken).
c. Bevestig dat `hasMarketData` per categorie klopt en dat de analyse-pagina
   voor élke ondersteunde categorie een zinnige vergelijking toont (geen lege
   of nep-data).
d. Tests: prijs-data heeft een geldige as-of-datum; geen prijs zonder bron;
   `pricesAreStale` false na de refresh.
e. Commit: `chore(prices): refresh + source market prices per category`.

## DEEL 4 — Rapport
a. `npm test -- --run` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** +
   `npx playwright test tests/e2e/`. Alles groen.
b. `V27_REPORT.md` — een **dekkings-tabel per categorie**:
   | Categorie | # providers (was → nu) | grote NL-providers gedekt? | prijs as-of | stale? | toegevoegd | resterende gaten |
   Plus de bron-URL's en welke categorieën nog "te verifiëren" data hebben.
c. Commit: `docs(v27): per-category coverage + price-freshness audit`.

---

## Done-criteria
- [ ] Élke ondersteunde categorie geïnventariseerd (providers + prijs-as-of)
- [ ] Grote NL-providers per categorie gedekt (sourced) of expliciet als gat benoemd
- [ ] Markt-prijzen vers + gesourcet (of "te verifiëren" gemarkeerd) — niets verzonnen
- [ ] WATER correct als monopolie behandeld
- [ ] Geen hypotheek/verzekering toegevoegd (AFM-gate intact)
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] `V27_REPORT.md` met de dekkings-tabel + bronnen + resterende gaten

## Eindrapportage
```
CATEGORY_DATA_AUDIT_V27 — Final report
DEEL 1 ✓ <hash> — audit + gat-lijst (sourced)
DEEL 2 ✓ <hash> — provider-dekking aangevuld
DEEL 3 ✓ <hash> — markt-prijzen vers + gesourcet
DEEL 4 ✓ <hash> — dekkings-tabel + rapport
```

**Na deze sprint weet je per categorie zwart-op-wit: welke NL-providers gedekt
zijn en of de prijsdata actueel + gesourcet is — geen blinde vlekken meer
buiten telecom, en niets verzonnen.**

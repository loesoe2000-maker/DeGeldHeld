# PRICE_REFRESH_PLAYBOOK — maandelijkse markt-prijs-refresh

Doel: één keer per maand alle markt-prijzen verversen, **navolgbaar en zonder
gokken**. De `price-staleness` cron mailt de eigenaar wanneer `PRICES_AS_OF`
te oud wordt — dán draai je dit playbook.

> **GUARDRAIL — nooit gokken.** Een prijs komt er alleen in/blijft staan als
> 'm via WebFetch uit de `source`-URL is bevestigd. Niet te verifiëren → laat
> de oude waarde staan, zet `needsManualCheck: true`, en vermeld 'm in het
> diff-overzicht. Verzin NOOIT een prijs of een URL.

## Wat je bijwerkt
- `lib/market-prices.ts` → `SOURCED_MARKET_PLANS` (elke `MarketPlan` heeft een
  verplichte `source` + `verifiedAt`).
- `lib/market-prices.ts` → de medians (`ENERGY_MEDIANS`, `WATER_MEDIANS`) +
  hun `MEDIAN_SOURCES`-metadata.
- `PRICES_AS_OF` → de run-datum.

## Paste-baar in Claude Code

```
Lees PRICE_REFRESH_PLAYBOOK.md en voer de maandelijkse prijs-refresh uit.

Voor ELKE entry in SOURCED_MARKET_PLANS (lib/market-prices.ts):
  1. WebFetch de `source`-URL.
  2. Lees de huidige prijs voor dat exacte plan.
  3. - Prijs gewijzigd  → update priceCents + zet verifiedAt op vandaag.
     - Prijs onveranderd → zet alleen verifiedAt op vandaag.
     - Bron onbereikbaar / prijs niet schoon te vinden → LAAT priceCents
       staan, verander verifiedAt NIET, en noteer 'm als needsManualCheck
       in het diff-overzicht. NOOIT gokken.

Voor ELKE median-groep in MEDIAN_SOURCES (ENERGY_MEDIANS, WATER_MEDIANS):
  1. WebFetch de `source`-URL.
  2. Vergelijk met de opgeslagen waarde. Gewijzigd → update de median +
     MEDIAN_SOURCES.verifiedAt + needsManualCheck:false. Niet te verifiëren →
     needsManualCheck:true laten en noteren.

Daarna:
  - Probeer de nog-ontbrekende categorieën opnieuw via WebFetch (telecom
    SIM-only, gym, OV, bank). Voeg toe WAAR cleanly verifieerbaar (met
    source + verifiedAt), sla over waar niet — gedocumenteerd, geen gok.
  - Bump PRICES_AS_OF naar vandaag.
  - npm test -- --run + npx tsc --noEmit + npm run build (EXIT 0).
  - Commit: "feat(prices): monthly refresh <datum>" (met co-author trailer).
  - Print een diff-overzicht (oud → nieuw per plan + welke needsManualCheck).
```

## Diff-overzicht (template per run)

```
PRIJS-REFRESH <datum>
- <provider> <plan>: <oud>c → <nieuw>c   (gewijzigd | onveranderd | needsManualCheck)
...
PRICES_AS_OF: <oud> → <nieuw>
needsManualCheck: <lijst categorieën/plannen + reden>
```

## Bron-status (per 2026-05-21)
| Categorie | Status | Bron |
|-----------|--------|------|
| STREAMING (Spotify/Netflix/Disney+) | ✅ fetchbaar | publieke prijspagina's |
| SOFTWARE (Microsoft 365) | ✅ fetchbaar | microsoft.com/nl-nl |
| OPSLAG (iCloud+/Google One/Dropbox) | ✅ fetchbaar | support.apple.com / one.google.com / dropbox.com |
| ENERGIE / WATER (medians) | ⚠️ needsManualCheck | acm.nl / vewin.nl — deep-page niet schoon fetchbaar |
| TELECOM SIM-only | ⚠️ niet schoon fetchbaar | component/promo-bundels (Simyo), 403 (Lebara) |
| GYM (Basic-Fit) | ⚠️ 404 op tarievenpagina | basic-fit.com |
| OV (NS) | ⚠️ geen schone prijs op de pagina | ns.nl |

Niet-fetchbare categorieën: **niets verzinnen** — laat staan/over, documenteer
in PRICE_REFRESH_REPORT.md.

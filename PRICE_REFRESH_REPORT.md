# PRICE_REFRESH_REPORT — fee-copy + prijs-refresh-tooling

Twee dingen: (1) de fee-copy consistent op **20%**, en (2) een herhaalbaar
prijs-refresh-playbook + een initiële refresh. `PRICES_AS_OF = 2026-05-21`.

## Eindrapportage

```
PRICE_REFRESH — Final report

DEEL 1   ✓ 11e7808 — fee-copy 20% (was 15% legacy) + tests
DEEL 2   ✓ b74deeb — refresh-playbook + traceable medians + initiële refresh
DEEL 2B  ✓ 0dfb497 — DPA-register gevuld (geverifieerde links)
DEEL 3   ✓ <dit commit> — aggregate + rapport
```

## DEEL 1 — Fee-copy 15% → 20%

De echte no-cure-no-pay fee is **20%** (`NO_CURE_NO_PAY_FEE_PCT`). Aangepast
(alleen **fee**-referenties):

| Plek | Was | Nu |
|------|-----|----|
| `lib/payments.ts` `SUCCESS_FEE_PCT` (legacy) | 0.15 | **0.20** (verzoend met no-cure-no-pay) |
| `lib/payments.ts` checkout-description | "15% van jaarlijkse besparing" | "20% …" |
| `lib/email_templates.ts` (welkomstmail) | "15% van wat we besparen" | "20% …" |
| `lib/i18n.ts` hero_subtitle (nl/en/de/fr) | "15%" | "20%" |
| `app/layout.tsx` metadata (3×) | "15% van wat je bespaart" | "20% …" |
| `components/Hero.tsx` | "15% van wat we besparen" | "20% …" |
| `components/HowItWorks.tsx` | "15% van de jaarbesparing" | "20% …" |
| `app/pay/[id]/page.tsx` (2× label) | "fee (15%)" / "success-fee (15%)" | "(20%)" |

**Bewust NIET aangeraakt** (geen fee): `lib/category-info.ts` "5-15%" /
"0,15%" (TER) / "10-15% korting"; `lib/negotiator.ts` `* 0.15`
(savings-schatting); negotiation-discount-teksten in tests/fixtures
("korting van 15%").

Tests bijgewerkt naar 20% (payments, stripe-flow, email_templates).

## DEEL 2 — Refresh-playbook + traceability + initiële refresh

- **`PRICE_REFRESH_PLAYBOOK.md`** — paste-bare maandelijkse procedure: per
  prijs de `source`-URL WebFetchen, vergelijken, bijwerken. Gewijzigd →
  prijs + `verifiedAt`; onveranderd → alleen `verifiedAt`; **niet te
  verifiëren → `needsManualCheck`, nooit gokken**. Bevat een bron-status-tabel.
- **Traceability**: élke `MarketPlan` had al `source` + `verifiedAt`; nu ook
  `MEDIAN_SOURCES` voor de tarief-medians (energie/water/hypotheek/verzekering)
  met `source` + `verifiedAt` + `needsManualCheck`.
- **RUNBOOK** "Markt-prijzen verversen" verwijst nu naar het playbook.

### Initiële refresh — diff (2026-05-21)
```
Spotify Premium Individual : 1299c → 1299c   onveranderd → verifiedAt 2026-05-21
Spotify Premium Student    :  699c →  699c   onveranderd → verifiedAt 2026-05-21
Spotify Premium Duo        : 1799c → 1799c   onveranderd → verifiedAt 2026-05-21
Spotify Premium Family     : 2199c → 2199c   onveranderd → verifiedAt 2026-05-21
iCloud+ 50GB/200GB/2TB/6TB/12TB : onveranderd → verifiedAt 2026-05-21
(overige 12 plannen: verifiedAt 2026-05-20 — gisteren geverifieerd, binnen tolerantie)
PRICES_AS_OF: 2026-05-20 → 2026-05-21
```
Geen enkele prijs is gewijzigd t.o.v. de v22-verificatie van gisteren.

### needsManualCheck (deze run niet automatisch te verifiëren — GEEN gok)
| Categorie | Reden |
|-----------|-------|
| **ENERGIE-medians** | ACM deep-tariefpagina gaf 404 via WebFetch → `MEDIAN_SOURCES.ENERGY_MEDIANS.needsManualCheck=true` (waarden ongewijzigd gelaten, binnen de bekende range €0,23–0,30/kWh, €1,28–1,58/m³). |
| **WATER-medians** | Vewin/regionale waterbedrijven — regionaal verschillend, niet schoon fetchbaar → `needsManualCheck=true`. |
| **TELECOM SIM-only** | Component-/promo-bundels (Simyo) + 403 (Lebara) → geen schone maandprijs. Niet toegevoegd. |
| **GYM (Basic-Fit)** | tarievenpagina 404. Niet toegevoegd. |
| **OV (NS)** | Geen schone prijs op de pagina (alleen navigatie). Niet toegevoegd. |
| **HYPOTHEEK / VERZEKERING** | Gated (v22, AFM) — medians blijven herleidbaar maar inactief. |

## DEEL 2B — DPA-register
Zie `docs/VERWERKERSOVEREENKOMSTEN.md` (gecontroleerd 2026-05-21):
- **Auto-geïncorporeerd** (geverifieerd): Vercel, Stripe, Resend.
- **Eigenaar-actie**: Sentry (los accepteren), Cloudflare (bevestigen),
  Neon→Databricks (verifiëren welke DPA na overname geldt), Groq (DPA
  aanvragen — geen publieke URL bevestigd, niet verzonnen).

## Verificatie
- `npx tsc --noEmit`: clean.
- `npm test -- --run`: **1700 passed**, 2 failed = bekende pre-existing
  FAQ-failures (commit `b351a61`, BACKLOG — buiten scope).
- `npm run build`: **EXIT 0** vóór élke commit.

## Hoe draait de maandelijkse refresh
`price-staleness` cron mailt de eigenaar bij verouderde `PRICES_AS_OF` →
plak het blok uit `PRICE_REFRESH_PLAYBOOK.md` in Claude Code → het loopt elke
`source`-URL langs, werkt bij, markeert wat niet te verifiëren is, en commit
met een diff-overzicht. Geen gok, alles herleidbaar.

## Restpunten voor de eigenaar
1. DPA's afronden: Sentry accepteren, Cloudflare/Neon-Databricks verifiëren,
   Groq-DPA aanvragen.
2. `needsManualCheck`-medians (energie/water) handmatig tegen ACM/Vewin
   checken en `MEDIAN_SOURCES.verifiedAt` + `needsManualCheck:false` zetten.
3. Telecom/gym/OV-prijzen: gerichte refresh wanneer er schoon fetchbare
   bronnen zijn (of handmatig invoeren met `source`).

# DeGeldHeld — Price-Refresh Tooling + Fee Copy Fix

Twee dingen: (1) een **herhaalbaar prijs-refresh-playbook** zodat het
maandelijks bijwerken van alle providers makkelijk + betrouwbaar is, en
(2) de **"15%"→"20%" fee-copy** consistent trekken (de echte fee is 20%).

**Daarna** draait de fee-inning (`AUTO_FEE_SPRINT_V19.md`) — zie de
gecombineerde START hieronder.

## ⚠️ GUARDRAILS (streng — geen debug-nacht)
1. **`npm run build` (EXIT 0) vóór élke commit.** tsc + tests vangen het
   Next.js route-contract niet.
2. **GÉÉN gehallucineerde prijzen.** Alleen via WebFetch uit de bron-URL;
   niet verifieerbaar → laat staan/markeer, nooit gokken.
3. **Niet élke "15%" vervangen** — alleen waar het de **fee** betreft (zie
   DEEL 1 lijst). Laat besparings-ranges (5-15%), TER (0,15%), korting
   (10-15%) en savings-schattingen met rust.
4. Geen `--no-verify`, geen `--force`; co-author trailer in elke commit.

## START (gecombineerd — refresh-tooling + fee-inning)

```
Voer twee sprints achter elkaar uit. EERST: lees /Users/bdb/alpharadar-pro/degeldheld/PRICE_REFRESH_SPRINT.md en voer 'm volledig uit (alle delen, npm run build EXIT 0 vóór elke commit, geen gehallucineerde prijzen, alleen fee-"15%" naar 20%). DAARNA: lees /Users/bdb/alpharadar-pro/degeldheld/AUTO_FEE_SPRINT_V19.md en voer 'm volledig uit. Per deel: npm test + npx tsc --noEmit + npm run build groen voor je commit. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force. Bij blocker na 30 min: TODO-commit en door. Eindig met PRICE_REFRESH_REPORT.md en V19_REPORT.md.
```

---

## DEEL 1 — Fee-copy consistent op 20%

De echte fee is **20%** (`NO_CURE_NO_PAY_FEE_PCT`, in de voorwaarden). De
publieke copy zegt nog "15%". Trek dat recht — **alleen de fee-referenties**.

a. **Vervang "15%" → "20%" op deze fee-plekken:**
   - `lib/email_templates.ts` (~r53): "15% van wat we besparen"
   - `lib/i18n.ts` hero_subtitle in **nl/en/de/fr** (4×): "15% van wat we besparen"
   - `app/layout.tsx` metadata (3×): "15% van wat je bespaart"
   - `lib/payments.ts`: `createCheckoutSession` description "15% van
     jaarlijkse besparing" + de legacy `SUCCESS_FEE_PCT = 0.15`.

b. **Legacy reconciliatie (voorzichtig):** er bestaan twee fee-systemen —
   legacy `computeSuccessFeeCents` (15%) en het actieve
   no-cure-no-pay (20%, `feeForVerifiedSavings`). Maak de legacy gelijk aan
   20% (of laat 'm verwijzen naar `NO_CURE_NO_PAY_FEE_PCT`). Pas de tests
   aan die 15% verwachtten. Raak de bedragen-logica zorgvuldig aan —
   `npm test` + `npm run build` groen.

c. **NIET aanraken** (zijn geen fee): `lib/category-info.ts` "5-15%" /
   "0,15%" / "10-15% korting"; `lib/negotiator.ts` `* 0.15`
   (savings-schatting, geen fee).

d. Commit: `fix(copy): fee consistent op 20% (was 15% legacy)`.

---

## DEEL 2 — Herhaalbaar prijs-refresh-playbook + bronnen compleet

Doel: maandelijks bijwerken = één commando, betrouwbaar, geen gok.

a. **Bron per prijs verplicht + dateerbaar.** Bevestig dat élke
   `MarketPlan` (v22) een `source`-URL + `verifiedAt` heeft. Vul ook de
   energie/water-medians (`lib/market-prices.ts`) aan met een `source` +
   `verifiedAt` per waarde, zodat álles herleidbaar is.

b. **Maak `PRICE_REFRESH_PLAYBOOK.md`** — een paste-baar maandelijks
   Claude-Code-procedure:
   - Voor élke `MarketPlan` + median: WebFetch de `source`-URL → lees de
     huidige prijs → vergelijk met opgeslagen waarde.
   - Gewijzigd → update prijs + `verifiedAt`. Onveranderd → alleen
     `verifiedAt` bumpen. **Bron onbereikbaar / prijs niet te vinden →
     markeer `needsManualCheck`, NOOIT gokken.**
   - Bump `PRICES_AS_OF`. Run `npm run build` (EXIT 0). Commit.
   - Print een diff-overzicht (oude → nieuwe prijs per plan) in het rapport.
   Schrijf de playbook zo dat 'm puur door plakken in Claude Code werkt.

c. **Doe nu een initiële refresh:**
   - Her-verifieer de bestaande ~21 plannen via hun `source`-URL.
   - **Probeer** de categorieën die v22 oversloeg (telecom SIM-only,
     gym, OV) opnieuw via WebFetch — voeg toe wáár cleanly verifieerbaar,
     sla over (gedocumenteerd) waar niet. Geen gok.
   - Energie/water: check de medians tegen de actuele bron, update + date.

d. **Update `RUNBOOK.md`** met "Markt-prijzen verversen" → verwijst naar
   `PRICE_REFRESH_PLAYBOOK.md` + de maandelijkse cadans (de
   `price-staleness` cron waarschuwt al wanneer 't tijd is).

e. Commit per logische stap (`feat(prices): refresh playbook` /
   `feat(prices): initial refresh <datum> + telecom sourced`).

---

## DEEL 2B — DPA-register automatisch invullen

Vul `docs/VERWERKERSOVEREENKOMSTEN.md` met de actuele DPA-gegevens per
sub-verwerker, zodat het AVG-register compleet is.

a. WebFetch de DPA-pagina van élke sub-verwerker en leg vast: **Vercel**
   (vercel.com/legal/dpa), **Stripe** (stripe.com/legal/dpa), **Cloudflare**
   (cloudflare.com/cloudflare-customer-dpa), **Sentry** (sentry.io/legal/dpa),
   **Resend**, **Neon**, **Groq** (zoek hun actuele DPA/legal-pagina).
b. Per provider in de tabel: wat ze verwerken · **DPA-URL** · **status**
   (`auto-geïncorporeerd` óf `eigenaar-actie: expliciet accepteren/aanvragen`)
   · gecontroleerd-op-datum. Markeer **Cloudflare** + **Groq** als
   "eigenaar bevestigt/vraagt aan" (de rest is auto via de voorwaarden).
c. **Geen verzonnen URLs** — alleen wat via WebFetch bevestigd is; niet
   gevonden → markeer `te verifiëren door eigenaar`.
d. Commit: `docs(privacy): fill DPA register with verified sub-processor links`.

---

## DEEL 3 — Aggregate + rapport

a. `npm test -- --run` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)**.
b. `PRICE_REFRESH_REPORT.md`:
   - Fee-copy: welke plekken van 15%→20% (en welke 15%'en bewust gelaten).
   - Refresh: prijs-diff per plan, nieuwe `PRICES_AS_OF`, welke categorieën
     nog `needsManualCheck` zijn + waarom.
   - Hoe de maandelijkse refresh draait (verwijzing naar de playbook).
c. Commit: `docs(prices): refresh tooling + fee-copy verified`.

---

## Done-criteria
- [ ] Alle **fee**-copy op 20% (publiek + voorwaarden + checkout), niet-fee 15%'en ongemoeid
- [ ] Legacy 15%-fee-pad verzoend met 20% + tests groen
- [ ] Élke prijs/median heeft `source` + `verifiedAt`
- [ ] `PRICE_REFRESH_PLAYBOOK.md`: paste-baar, WebFetch-gebaseerd, geen gok
- [ ] Initiële refresh gedaan (bestaande her-geverifieerd + telecom geprobeerd)
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** groen
- [ ] PRICE_REFRESH_REPORT.md met diff + restpunten
- [ ] (chained) AUTO_FEE_SPRINT_V19 daarna volledig uitgevoerd

**Na deze sprint: één publiek fee-percentage (20%), elke prijs herleidbaar
+ maandelijks met één commando te verversen, en de fee-inning (v19) staat.**

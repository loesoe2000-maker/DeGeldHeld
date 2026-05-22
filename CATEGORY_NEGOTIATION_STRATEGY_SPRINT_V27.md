# DeGeldHeld v27 — Category-specifieke onderhandel-strategie (op echte retentie-dynamiek)

**Lees eerst `docs/RETENTION_PER_CATEGORY.md`** — dat is het (gesourcete)
onderzoek waarop deze sprint is gebouwd. Kern: providers verlagen alléén waar een
echte **retentie-lever** bestaat, en dat verschilt per categorie. Eén generiek
"stuur-een-mail"-script werkt dus niet en kan zelfs misleidend zijn.

De categorieën splitsen in 3 types:
- **TYPE A — échte onderhandeling** (TELECOM, ENERGIE, KRANT/TIJDSCHRIFT): er ís een
  lever → DeGeldHeld onderhandelt → **hier verdien je de 20%-fee.**
- **TYPE B — self-service** (STREAMING, GYM-ketens): de klant downgrade/opzegt zelf
  → DeGeldHeld geeft **advies**, géén onderhandeling, **géén fee**.
- **TYPE C — monopolie** (WATER): verbruik + kwijtschelding, **géén fee**.

Deze sprint maakt de onderhandeling (en het fee-model) per type correct.

---

## ⚠️ GUARDRAILS
1. **`npm run build` (EXIT 0) + `npx tsc --noEmit` + `npm test` groen vóór élke commit.**
2. **GÉÉN gehallucineerde prijzen/providers** — alleen WebFetch-geverifieerd met
   `// bron: <URL>` + as-of-datum; twijfel = weglaten. (Volg `PRICE_REFRESH_PLAYBOOK.md`.)
3. **Fee-integriteit (KERN):** de 20% no-cure-no-pay mag **alleen** triggeren op
   **TYPE A** (telecom/energie/krant) bij een bewezen verlaging die DeGeldHeld
   onderhandelde. **TYPE B/C nooit** — anders reken je voor iets dat de klant zelf
   deed of dat niet kan. Verzwak dit niet.
4. **Eerlijkheid:** beloof bij TYPE B/C geen "onderhandeling". Toon advies + zeg
   duidelijk dat de klant het zelf doet.
5. **AFM-gate** intact (geen hypotheek/verzekering).
6. **WATER = monopolie**; kwijtschelding alleen op het **waterschapsbelasting**-deel
   (niet het drinkwaterbedrijf zelf).
7. Geen `--no-verify`/`--force`. Co-author trailer:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## START
```
Lees /Users/bdb/alpharadar-pro/degeldheld/CATEGORY_NEGOTIATION_STRATEGY_SPRINT_V27.md én docs/RETENTION_PER_CATEGORY.md, en voer alle deeltaken in volgorde uit. Per deel: npm test + npx tsc --noEmit + npm run build (EXIT 0) groen vóór de commit. Fee alleen op TYPE A; TYPE B/C geven advies zonder fee. GÉÉN gehallucineerde prijzen/providers (sourced met // bron: of weglaten). Geen hyp/verz. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify/--force. Bij blocker na 30 min: TODO-commit en door. Eindig met V27_REPORT.md.
```

---

## DEEL 0 — Category-strategy-map (de basis in code)
a. Maak `lib/category-strategy.ts`: per categorie een **type** (`"A_NEGOTIATE" |
   "B_SELF_SERVICE" | "C_MONOPOLY"`) + de **lever** + het **kanaal** + de
   **fee-eligibility** (alleen A). Baseer de inhoud op `docs/RETENTION_PER_CATEGORY.md`.
   - TELECOM → A · lever: opzeg-intentie + concurrent/nieuwe-klant-prijs · kanaal:
     retentie-afdeling (telefonisch primair) · fee: ja
   - ENERGIE → A · lever: contract-einde/boetevrij-window + markt-kWh/m³ + overstapbonus ·
     kanaal: overstap/retentie · fee: ja
   - ABONNEMENT (krant/tijdschrift-subtype) → A · lever: opzeg → win-back · fee: ja
   - STREAMING → B · advies: downgrade tier/student/bundel/win-back · fee: nee
   - GYM → B · advies: contract-keuze/downgrade/opzeg-actie · fee: nee
   - WATER → C · advies: verbruik + kwijtschelding (waterschap-deel) · fee: nee
b. `categoryStrategy(category)` helper + tests (juiste type/fee per categorie).
c. Commit: `feat(strategy): per-category negotiation-strategy map (A/B/C)`.

## DEEL 1 — TYPE A: category-specifieke onderhandeling
a. Negotiator (`lib/negotiator.ts`) per TYPE-A-categorie de **juiste lever +
   framing** laten gebruiken:
   - **TELECOM:** frame als opzeg-intentie ("ik overweeg over te stappen tenzij…")
     met concurrent/nieuwe-klant-prijs; vraag naar de **retentie-afdeling**.
     **+ genereer een kort BELSCRIPT** (want e-mail is zwak bij telecom): de exacte
     zinnen om de retentie-afdeling te bellen. Toon dat naast de mail.
   - **ENERGIE:** lever = contract-einde/boetevrij-window (Energiewet 2026) +
     markt-kWh/m³ + overstapbonus; waarschuw dat vroeg opzeggen welkomstkorting kost.
   - **KRANT/TIJDSCHRIFT:** opzeg-intentie → vraag om een win-back/retentie-aanbod.
b. Tests: per TYPE-A-categorie bevat de output de juiste lever (telecom: belscript +
   retentie-afdeling; energie: contract-einde + tarief; krant: win-back).
c. Commit: `feat(negotiator): category-specific levers for TYPE-A categories`.

## DEEL 2 — TYPE B: self-service advies (geen onderhandeling, geen fee)
a. Voor STREAMING/GYM: i.p.v. een onderhandel-mail → een **advies-kaart**:
   - STREAMING: "Je betaalt €X; downgrade naar tier Y bespaart €Z" + student/bundel/
     win-back-opties. (Sourced tarieven of generiek-veilig.)
   - GYM: contract-keuze (4 vs 52 wk), downgrade, opzeg-actie.
   - Duidelijke tekst: **"Dit regel je zelf — zo doe je het"** (geen fee, geen relay).
b. De analyse-pagina toont voor TYPE B dit advies i.p.v. de "Genereer
   onderhandel-mail"-knop; de relay/fee-prompt verschijnt **niet**.
c. Tests: TYPE B → advies getoond, géén onderhandel-mail/relay/fee-prompt.
d. Commit: `feat(categories): self-service savings advice for streaming/gym (no fee)`.

## DEEL 3 — TYPE C: water (verbruik + kwijtschelding)
a. Bevestig/verbeter de bestaande water-flow (monopolie): verbruik-tips +
   kwijtschelding — corrigeer dat kwijtschelding **alleen het
   waterschapsbelasting-deel** betreft (via gemeente/waterschap), niet het
   drinkwaterbedrijf. Geen onderhandeling/fee.
b. Tests: WATER → monopolie-advies, géén fee/relay.
c. Commit: `fix(water): correct kwijtschelding scope (waterschap only), no fee`.

## DEEL 4 — Fee-model uitlijnen op de strategie (KERN)
a. `lib/payments.ts` `shouldChargeVerifiedFee` (en de fee-trigger in
   `lib/outcome-proof.ts`): **alleen** fee als `categoryStrategy(bill.category).fee
   === true` (TYPE A). TYPE B/C → nooit fee, ook niet bij "besparing".
b. Relay (`relay-authorize`) + de fee-kaart-prompt **alleen** tonen/toestaan voor
   TYPE A.
c. Tests: TYPE A verified saving → fee; TYPE B/C verified "saving" → géén fee.
d. Commit: `feat(fee): no-cure-no-pay only on TYPE-A categories (revenue integrity)`.

## DEEL 5 — Data/dekking die de levers voedt (sourced)
a. Voor TYPE A: zorg dat de **concurrent-prijzen + grote NL-providers** actueel +
   gesourcet zijn (anders is de lever leeg). Vul ontbrekende providers/prijzen aan
   per `PRICE_REFRESH_PLAYBOOK.md` (sourced of weglaten). Voor TYPE B: sourced
   tier-/abonnementsprijzen waar getoond.
b. Tests: elke nieuwe prijs/provider heeft een `// bron:`; `pricesAreStale` false.
c. Commit: `chore(data): refresh sourced prices/providers for the levers`.

## DEEL 6 — Rapport
a. `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen.
b. `V27_REPORT.md`: per categorie het **type (A/B/C)**, de lever/het kanaal, of de
   fee triggert, wat aan data/prijzen is bijgewerkt (met bron), en resterende gaten.
c. Commit: `docs(v27): category negotiation strategy + fee alignment verified`.

---

## Done-criteria
- [ ] `lib/category-strategy.ts` met A/B/C + lever + kanaal + fee-eligibility (sourced)
- [ ] TYPE A: category-specifieke levers (telecom belscript + retentie; energie
      contract-einde + tarief; krant win-back)
- [ ] TYPE B: self-service advies, **geen** onderhandel-mail/relay/fee
- [ ] TYPE C: water verbruik + kwijtschelding (waterschap-deel), geen fee
- [ ] **Fee triggert alléén op TYPE A** (telecom/energie/krant) — getest
- [ ] Prijzen/providers gesourcet (of weggelaten), geen hallucinaties, geen hyp/verz
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] `V27_REPORT.md` met type + lever + fee + data-status per categorie

## Eindrapportage
```
CATEGORY_NEGOTIATION_STRATEGY_V27 — Final report
DEEL 0 ✓ <hash> — category-strategy-map (A/B/C)
DEEL 1 ✓ <hash> — TYPE-A category-specifieke levers (+ telecom belscript)
DEEL 2 ✓ <hash> — TYPE-B self-service advies (geen fee)
DEEL 3 ✓ <hash> — TYPE-C water (kwijtschelding-scope)
DEEL 4 ✓ <hash> — fee alleen op TYPE A (revenue-integriteit)
DEEL 5 ✓ <hash> — sourced prijzen/providers voor de levers
DEEL 6 ✓ <hash> — rapport
```

**Na deze sprint onderhandelt DeGeldHeld per categorie zoals de markt écht werkt —
en reken je alléén af waar je daadwerkelijk een verlaging onderhandelt. Geen valse
beloftes bij water/streaming, en de telecom-lever (bel-script voor de
retentie-afdeling) sluit aan op hoe providers in de praktijk verlagen.**

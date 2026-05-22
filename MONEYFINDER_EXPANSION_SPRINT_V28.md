# DeGeldHeld v28 — "Vind al je geld" uitbreiding (model B: nooit providergeld)

**Lees eerst `docs/EXPANSION_PROPOSALS.md`** (gesourcet marktonderzoek). De
eigenaar koos **model B**: omzet komt van de **klant** (abonnement /
no-cure-no-pay) of van **teruggehaald/geclaimd geld** — **nooit van providers**.
"Wij nemen nooit providergeld" wordt een merk-statement.

Deze sprint verbreedt DeGeldHeld van "verlaag je vaste lasten" naar
**"vind al het geld dat je laat liggen"**, met de **gratis toeslagen-check** als
groei-motor en het **abonnement** als cashflow-motor.

*(Vervangt de oude affiliate-sprint — affiliate is geschrapt want model B.)*

---

## ⚠️ GUARDRAILS
1. **`npm run build` (EXIT 0) + `npx tsc --noEmit` + `npm test` groen vóór élke commit.**
2. **NOOIT providergeld** (model B). Alleen klant-betaalt (abonnement /
   no-cure-no-pay) of % van teruggehaald geld.
3. **Toeslag-regels MOETEN gesourcet zijn** — de inkomens-/huur-/vermogensgrenzen
   en bedragen via **WebFetch op de officiële Belastingdienst/Toeslagen-pagina's
   (2026)**, met `// bron: <URL>` + peildatum. **GÉÉN gehallucineerde grenzen of
   bedragen** — een foute toeslag-schatting schaadt mensen + je reputatie. Niet
   zeker → toon een range + "controleer bij de Belastingdienst", reken niets hard.
4. **Indicatie, geen advies.** De check is een **indicatieve schatting + verwijzing**
   naar de officiële aanvraag (DigiD/Belastingdienst). **Geen aanvraag-overname**,
   geen DigiD-integratie. Duidelijke disclaimer + "Geen financieel/fiscaal advies".
5. **Privacy/AVG (gevoelig — inkomensdata):** bereken de check **client-side of
   transient**; sla inkomens-/huishouddata **niet** op tenzij de gebruiker dat
   expliciet wil; maskeer in analytics (`.ph-no-capture`). Geen PII in events.
6. **Ethisch:** de toeslagen-check is **gratis** — je verdient niet aan mensen die
   een uitkering mislopen. Hij trekt ze binnen → ze gebruiken de betaalde
   onderhandeling/abonnement.
7. **AFM-gate** intact (geen hypotheek/verzekering).
8. Geen `--no-verify`/`--force`. Co-author trailer:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## START
```
Lees /Users/bdb/alpharadar-pro/degeldheld/MONEYFINDER_EXPANSION_SPRINT_V28.md én docs/EXPANSION_PROPOSALS.md, en voer alle deeltaken in volgorde uit. Per deel: npm test + npx tsc --noEmit + npm run build (EXIT 0) groen vóór de commit. Toeslag-grenzen/bedragen ALLEEN WebFetch-geverifieerd op officiële Belastingdienst/Toeslagen-bronnen met // bron: + peildatum — niets gokken. Check = indicatie + verwijzing, géén aanvraag-overname/DigiD, géén opslag van inkomensdata. Gratis check. Geen providergeld, geen hyp/verz. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify/--force. Eindig met V28_REPORT.md incl. bronnen van de toeslag-regels + peildatum.
```

---

## DEEL 1 — Gratis toeslagen-/regelingen-check (de groei-motor)
a. WebFetch de **officiële 2026-regels** voor **zorgtoeslag, huurtoeslag,
   kindgebonden budget** (inkomens-/vermogens-/huurgrenzen + max-bedragen) op
   belastingdienst.nl/toeslagen. Codeer ze in `lib/toeslagen.ts` met `// bron:` +
   peildatum. Voeg een **algemene "check je gemeente-regelingen"-verwijzing** toe
   (bijzondere bijstand, kwijtschelding, individuele inkomenstoeslag) zonder
   per-gemeente-bedragen te gokken.
b. `estimateToeslagen(input)` (pure functie): inkomen, huur, huishoudsamenstelling,
   leeftijd, evt. vermogen → indicatie per toeslag (recht ja/nee + range €/mnd).
c. UI `/toeslagen-check`: een kort formpje → toont **"Je loopt mogelijk €X/mnd
   mis"** + per toeslag een uitleg + een **knop naar de officiële aanvraag**
   (Belastingdienst). Disclaimer: indicatie, geen advies, controleer/aanvragen via
   de Belastingdienst.
d. Privacy: bereken transient; sla niets gevoeligs op zonder expliciete keuze.
e. Tests: bekende voorbeeld-inputs → juiste indicatie (tegen de gesourcete
   grenzen); elke grens/bedrag heeft een `// bron:`; randgevallen (net boven/onder
   grens) geven een nette range.
f. Commit: `feat(toeslagen): free sourced eligibility check (indicatie, no advice)`.

## DEEL 2 — Herframing "vind al je geld"
a. Landing + onboarding verbreden: naast "verlaag je vaste lasten" → "én check of
   je toeslagen misloopt". Een duidelijke, gratis instap naar `/toeslagen-check`.
b. Na de check → natuurlijke doorstroom naar de upload/onderhandeling +
   abonnement ("we vonden €X aan toeslagen — wil je ook je rekeningen checken?").
c. Tests: landing toont beide; check → vervolg-CTA naar bills/abonnement.
d. Commit: `feat(brand): broaden to "find all the money you're leaving" + funnel`.

## DEEL 3 — Abonnement (DeGeldHeld Plus) als cashflow-motor
a. Positioneer/scherp het bestaande abonnement: maandelijkse her-scan van **álle**
   vaste lasten + **periodieke toeslag-her-check** (regels/inkomen wijzigen) +
   alerts (contract-einde, prijsstijging). Duidelijke prijs (bijv. €2,99-4,99/mnd
   of jaarprijs) + waaróm het de moeite waard is (ook voor water/streaming).
b. Tests: abonnement-waarde getoond; her-check/alert-logica.
c. Commit: `feat(plus): subscription as the all-category money-finder engine`.

## DEEL 4 — Spookabonnement-detectie (verspilling)
a. Detecteer uit de geüploade rekeningen/abonnementen **terugkerende kosten** +
   markeer waarschijnlijk **ongebruikte/dubbele** abonnementen → begeleid het
   **zelf** opzeggen (géén betaalde opzegdienst — dat is bekritiseerd; zie bron).
b. Tests: detectie + opzeg-begeleiding; geen betaalde-opzeg-claim.
c. Commit: `feat(waste): detect unused/duplicate subscriptions + self-cancel guidance`.

## DEEL 5 — (Scaffold, later) claims/refunds
a. Leg de basis voor **no-cure-no-pay op teruggehaald geld** (onterechte
   incassokosten/storingscompensatie/te-veel-betaald): een `claim`-model + flow,
   **achter een flag** (`FEATURE_CLAIMS=false`). Nog niet live; alleen het skelet.
b. Commit: `chore(claims): scaffold refund-claim flow behind FEATURE_CLAIMS (off)`.

## DEEL 6 — Rapport
a. `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen.
b. `V28_REPORT.md`: de toeslag-check (met **bronnen + peildatum** van de regels),
   de herframing, het abonnement-aanbod, de waste-detectie, en de claims-scaffold.
   Plus EIGENAAR-stappen (privacy-tekst/voorwaarden bijwerken voor de toeslag-check;
   jurist-check op "indicatie geen advies").
c. Commit: `docs(v28): money-finder expansion verified (sources + peildatum)`.

---

## Done-criteria
- [ ] Gratis toeslagen-check met **gesourcete** 2026-regels (bron + peildatum), indicatie + verwijzing, géén aanvraag-overname
- [ ] Privacy: inkomensdata transient, niet opgeslagen, gemaskeerd in analytics
- [ ] Herframing "vind al je geld" + funnel naar bills/abonnement
- [ ] Abonnement gepositioneerd als all-category money-finder (incl. toeslag-her-check)
- [ ] Spookabonnement-detectie + zelf-opzeg-begeleiding (geen betaalde opzegdienst)
- [ ] Claims/refunds-scaffold achter `FEATURE_CLAIMS` (uit)
- [ ] Géén providergeld, géén hyp/verz, geen gehallucineerde toeslag-cijfers
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] `V28_REPORT.md` met bronnen + peildatum + eigenaar-stappen

## Eindrapportage
```
MONEYFINDER_EXPANSION_V28 — Final report
DEEL 1 ✓ <hash> — gratis toeslagen-check (sourced)
DEEL 2 ✓ <hash> — herframing "vind al je geld" + funnel
DEEL 3 ✓ <hash> — abonnement als cashflow-motor
DEEL 4 ✓ <hash> — spookabonnement-detectie
DEEL 5 ✓ <hash> — claims-scaffold (flag uit)
DEEL 6 ✓ <hash> — rapport + bronnen
```

**Na deze sprint is DeGeldHeld "vind al je geld": gratis toeslagen-check (€1B+
markt, PR-goud) als groei-motor, abonnement als cashflow-motor, en alles 100%
aan de kant van de klant — nooit providergeld.**

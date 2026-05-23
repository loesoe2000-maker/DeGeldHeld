# DeGeldHeld v29 — Box 3 + NS Geld-Terug + Zorgkostenaftrek + "vind al je geld"-hub

**Lees eerst:**
- `docs/EXPANSION_RESEARCH_V29.md` — gesourcete marktscan + revenue-verdicts per feature
- `docs/BENEFITS_DATA_2026.md` — V28-pattern voor sourced data-file (kopieer de stijl)
- `V28_REPORT.md` — wat al staat (`lib/toeslagen.ts`, `lib/eu261.ts`, `lib/plus.ts`,
  `app/geld-check/`, `app/vluchtclaim/`, `app/spookabonnementen/`, `app/plus/`)

Doel: drie nieuwe consumer-aligned features die directe (Box 3) + indirecte (NS + Zorgkosten
via Plus) revenue brengen, plus één **"vind al je geld"-hub** die alles samenbrengt.
**Model B intact** (nooit providergeld). Alles **achter feature-flags** (default off).

## ⚠️ GUARDRAILS (sprint-specifiek, naast de standaard)

1. **`npm run build` (EXIT 0) + `npx tsc --noEmit` + `npm test` groen vóór élke commit.**
2. **DEEL 0 verplicht**: maak EERST `docs/V29_DATA_2026.md` met ALLE forfaits / drempels /
   bedragen, **EXACT** uit officiële NL-bronnen (Belastingdienst / Rijksoverheid / NS /
   Hoge Raad — niet uit aggregators). Élk getal heeft `// bron: <URL>` + peildatum +
   verifiedAt. **Niets gokken of "bijwerken".** Bij twijfel → indicatie + verwijzing, geen
   exact bedrag.
3. **Indicatie ≠ advies.** Box 3 = indicatie of bezwaar loont, exacte berekening doet
   Belastingdienst-OWR. Zorgkosten = drempel + JA/NEE-checklist, klant rekent zelf.
   NS = indicatie compensatie, claim via Mijn NS / formulier. Sterke disclaimers + verwijzing
   naar officiële kanalen op elke pagina.
4. **Privacy / AVG (kritisch)**: inkomens-/vermogens-/zorgkosten-data **client-side**
   verwerken (zoals `lib/toeslagen.ts` doet); niet opslaan; **`ph-no-capture`** op alle
   gevoelige inputs; analytics alleen booleans/counts (géén PII).
5. **Revenue-model (KRITISCH — niet versimpelen)**:
   - **Box 3**: GRATIS indicatie altijd. **No-cure-no-pay 25%** alléén aanbieden als
     verwachte teruggave **≥ € 500**. Onder die drempel → DIY-brief + checklist, geen fee
     (anders pakken we 25% over €50 teruggave = onethisch + slechte CAC).
   - **NS Geld-Terug**: GRATIS check + brief + reminder. **Plus-upsell**: "auto-claim
     elke vertraging" als 4e pijler in `lib/plus.ts`. Geen losse NCNP-fee (€1-4 per
     claim = niet verzilverbaar).
   - **Zorgkosten**: GRATIS, geen fee. Top-of-funnel naar Plus.
6. **Géén providergeld** (model B). **Géén hyp/verz** (AFM-gate).
7. **Flags blijven default UIT** tot eigenaar de privacy/disclaimer per feature heeft
   gereviewed:
   - `BOX3_CHECK_ENABLED` (default false)
   - `NS_CHECK_ENABLED` (default false)
   - `ZORGKOSTEN_CHECK_ENABLED` (default false)
   - `MONEYFINDER_HUB_ENABLED` (default false) — gates `/vind-al-je-geld`
8. Géén `--no-verify`/`--force`. Co-author trailer:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/MONEYFINDER_EXPANSION_SPRINT_V29.md, docs/EXPANSION_RESEARCH_V29.md én docs/BENEFITS_DATA_2026.md (als stijl-referentie). Voer alle deeltaken uit in volgorde. DEEL 0 is verplicht — maak EERST docs/V29_DATA_2026.md met ALLE Box 3-forfaits + heffingsvrij vermogen 2017-2025+ + Wet tegenbewijsregeling-procedure + NS Geld-Terug exacte bedragen + EU-PRR-verschillen + zorgkostenaftrek-drempel + volledige lijst aftrekbare/niet-aftrekbare posten — élk getal met // bron: officiële Belastingdienst/Rijksoverheid/NS-URL + verifiedAt. Niets uit aggregators, niets gokken. Bij twijfel → indicatie + verwijzing, geen exact bedrag. Per deel: npm test + npx tsc --noEmit + npm run build (EXIT 0) groen vóór de commit. Revenue-model EXACT zoals in guardrail 5: Box 3 gefaseerd (gratis indicatie + NCNP 25% alleen bij ≥€500 verwachte teruggave), NS gratis + Plus-upsell, zorgkosten gratis. Privacy: alles client-side, ph-no-capture, geen opslag. Alle features achter feature-flags (default false). Geen providergeld, geen hyp/verz. Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>. Geen --no-verify/--force. Eindig met V29_REPORT.md incl. bronnen + peildatums + eigenaar-stappen.
```

---

## DEEL 0 — `docs/V29_DATA_2026.md` (bron-van-waarheid, verplicht eerst)

a. Maak `docs/V29_DATA_2026.md` met:
   - **Box 3** (sectie):
     - Forfaitaire rendementen per jaar **2017 t/m 2025+** per **vermogensschijf**
       (sparen / overige bezittingen / schulden), EXACT van Belastingdienst.
     - **Heffingsvrij vermogen** per jaar.
     - **Wet tegenbewijsregeling Box 3** (ingegaan 19 jul 2025) — kernregels:
       wie kan tegenbewijs leveren, OWR-formulier, deadline-richtlijnen,
       welke vermogenscategorieën.
     - Eerlijk over wat WEL en NIET hard te schatten is (rendement spaargeld =
       relatief hard via gemiddelde spaarrente; beleggingen = klant moet zelf
       opgeven; vastgoed = ander regime).
     - Bronnen: Rijksoverheid (tijdlijn rechtsherstel), Belastingdienst (forfaits),
       Hoge Raad-arresten (6 jun 2024, 14 jun 2024, 20 dec 2024), Wet
       tegenbewijsregeling Stb 2025.
   - **NS Geld-Terug** (sectie):
     - Exacte percentages per vertraging-band (NS-regeling: 30-59 min = 50%,
       ≥ 60 min = 100% · EU-PRR Verordening 2021/782: 60-119 min = 25%,
       ≥ 120 min = 50% — wanneer welke geldt).
     - Minimum claim (€ 2,30) · deadline (3 maanden).
     - Abonnement-handling (Vrij / Voordeel / Flex / kortingsabonnement).
     - Uitsluitingen (overmacht, terrorisme, exceptioneel weer).
     - Bronnen: NS Voorwaarden Geld-Terug-bij-Vertraging-PDF, EU 2021/782,
       Rover.
   - **Zorgkostenaftrek** (sectie):
     - Drempel-formule (1,65% van toetsingsinkomen, minimum € 164 per
       belastingplichtige — peildatum verifiëren voor 2025/2026).
     - Volledige lijst **wel-aftrekbare** posten (zorgkosten ziekte/invaliditeit:
       genees-/heelkundige hulp, voorgeschreven medicijnen, hulpmiddelen, vervoer
       i.v.m. ziekte, dieet op doktersrecept, etc.).
     - Volledige lijst **niet-aftrekbare** posten (eigen risico, premies, etc.).
     - Bronnen: Belastingdienst (overzicht zorgkosten + drempelbedrag),
       Eindrapport aftrek specifieke zorgkosten Eerste Kamer 2022.
   - Eerlijk over wat indicatie-only is.
b. Geen aggregator-cijfers (geen blog/influencer). Officiële bronnen of weglaten.
c. Commit: `docs(v29): sourced data file for box3 + NS + zorgkostenaftrek 2026`.

---

## DEEL 1 — Box 3-rechtsherstel check + brief-helper

a. **Engine** `lib/box3.ts` (pure, client-side, zoals `lib/toeslagen.ts`):
   - Types: `Box3Input` (jaar, spaargeld, beleggingen, schulden, vermogen-peildatum),
     `Box3Result` (forfaitaire heffing, werkelijk-rendement-indicatie,
     verwachteTeruggaveCents, lonsBezwaarStatus: "likely" | "maybe" | "unlikely",
     biedNcnpAan: boolean, uitleg, bron).
   - `estimateBox3Restitution(input)` — pure functie. Vergelijk fictief vs werkelijk
     rendement met de forfaits uit `V29_DATA_2026.md` (importeer via constants met
     `// bron:`). Indicatie geven, GEEN exact eindbedrag pretenderen.
   - **Revenue-gate**: `biedNcnpAan = verwachteTeruggaveCents >= 50_000`
     (€ 500-drempel uit guardrail 5).
b. **UI** `/box3-check`:
   - Server `app/box3-check/page.tsx` (flag-gated op `BOX3_CHECK_ENABLED`).
   - `Box3CheckClient.tsx`: wizard (jaar selecteren → spaargeld / beleggingen /
     schulden / werkelijk rendement) → resultaat-kaart. Onder kleinedrempel:
     "doe het zelf — hier is de brief en checklist (gratis)". Boven drempel:
     "wij doen 'm voor je (no-cure-no-pay 25%)" + DIY-optie blijft beschikbaar.
   - Privacy-callout zoals geld-check (client-side, niets opgeslagen).
   - `track("box3_check_started" | "box3_results_viewed" | "box3_ncnp_chosen" |
     "box3_diy_chosen")` — alle non-PII.
c. **Brief-helper**: pre-gefilde tekst voor het OWR-formulier + verwijzing naar
   MijnBelastingdienst. Geen DigiD-integratie.
d. **Feature-flag**: `BOX3_CHECK_ENABLED` (default false) in `lib/feature-flags.ts`.
e. **Analytics**: extend `AnalyticsEvent`-union met de events hierboven.
f. **Tests** `tests/box3.test.ts`:
   - Engine: forfait-vergelijking correct, drempel-€500 gate werkt, élke
     constante heeft `// bron:` (source-read assert).
   - Edge cases: jaar buiten range → unlikely + verwijzing, vermogen onder
     heffingsvrij → unlikely.
   - Revenue-gate: < € 500 → biedNcnpAan = false; ≥ € 500 → true.
g. Commit: `feat(box3): rechtsherstel check + brief-helper (gefaseerd model)`.

---

## DEEL 2 — NS Geld-Terug bij Vertraging

a. **Engine** `lib/ns.ts` (pure, EU261-pattern):
   - Types: `NsInput` (ticketCents, delayMinutes, isAbonnement, isInternational),
     `NsResult` (compensationCents, percentage, regime: "NS_NL" | "EU_PRR" |
     "ABONNEMENT_VERWIJS", eligible, reden).
   - `nsCompensation(input)` — pure. Past de juiste regeling toe: NS-NL voor
     binnenland-losse-tickets, EU-PRR voor IC-direct/internationaal, abonnement
     → verwijzing naar Mijn NS.
b. **UI** `/ns-check`:
   - Server `app/ns-check/page.tsx` (flag `NS_CHECK_ENABLED`).
   - `NsCheckClient.tsx`: vragenlijst (datum + ticket-type + ticketprijs +
     vertraging) → indicatie + brief-template + reminder-knop ("zet me op deadline").
   - Reminder = simpel email-mailto met formulier-link (geen achtergrond-job).
c. **Plus-integratie** (de echte revenue):
   - Update `lib/plus.ts`: voeg "auto-claim NS-vertragingen" toe als pijler.
   - Update `app/plus/page.tsx`: noem het als concreet abonnement-voordeel.
   - Echte auto-claim-implementatie = owner-werk (vergt account-koppeling) →
     eerst alleen in de positionering + waitlist-signal.
d. **Tests** `tests/ns.test.ts`:
   - Regimes correct (NS-NL vs EU-PRR), drempels op grens, minimum € 2,30
   - Abonnement → verwijzing-regime
   - Constants matchen `V29_DATA_2026.md`
e. **Feature-flag**: `NS_CHECK_ENABLED` (default false).
f. Commit: `feat(ns): Geld-Terug bij Vertraging check + Plus auto-claim pillar`.

---

## DEEL 3 — Zorgkostenaftrek check

a. **Engine** `lib/zorgkosten.ts` (pure, geld-check-DNA):
   - Types: `ZorgkostenInput` (toetsingsinkomen, partner, leeftijd, opgegeven
     zorgkosten-totaal per categorie), `ZorgkostenResult` (drempelCents,
     aftrekbaarCents, indicatieJa: boolean, checklistVeelvergeten:
     {item: string, mogelijkAftrekbaar: boolean}[], uitleg, bron).
   - `estimateZorgkostenAftrek(input)` — pure. Drempel = max(€ 164,
     1,65% × toetsingsinkomen). Indicatie of er boven-drempel-aftrek is.
   - Géén exact bedrag in EUR pretenderen voor het uiteindelijke voordeel
     (hangt van marginale tarief af) — alleen "aftrekbaar boven drempel".
b. **UI** `/zorgkosten-check`:
   - Server `app/zorgkosten-check/page.tsx` (flag `ZORGKOSTEN_CHECK_ENABLED`).
   - `ZorgkostenCheckClient.tsx`: vragenlijst (inkomen + partner + per-categorie
     bedragen) → indicatie + **uitgebreide checklist veelvergeten posten**
     (alternatieve geneeswijzen op doktersrecept, fysio buiten basisverzekering,
     vervoer i.v.m. ziekte, dieet op doktersrecept, hulpmiddelen, etc.) met
     JA/NEE per item ("kan ik dit aftrekken?").
   - Disclaimer: indicatie, geen exact bedrag, eindcontrole bij aangifte zelf.
c. **Tests** `tests/zorgkosten.test.ts`:
   - Drempel-formule correct (1,65% met min € 164)
   - Aftrek boven/onder drempel
   - Checklist-volledigheid (assert dat alle posten uit `V29_DATA_2026.md`
     vermeld zijn)
d. **Feature-flag**: `ZORGKOSTEN_CHECK_ENABLED` (default false).
e. Commit: `feat(zorgkosten): aangifte-helper indicatie + checklist (sourced)`.

---

## DEEL 4 — "Vind al je geld"-hub (bindende landing)

a. **Page** `app/vind-al-je-geld/page.tsx` (server, flag `MONEYFINDER_HUB_ENABLED`):
   - Hero: "Vind al je geld — alles op één plek"
   - Tegels per check (alleen tonen als de bijbehorende flag aan staat):
     - Toeslagen + gemeente → `/geld-check`
     - Box 3-rechtsherstel → `/box3-check`
     - Zorgkostenaftrek → `/zorgkosten-check`
     - Vluchtclaim (EU261) → `/vluchtclaim` (achter `CLAIMS`)
     - NS-vertraging → `/ns-check`
     - Spookabonnementen → `/spookabonnementen`
   - Plus-pitch onderaan ("één abonnement = elke maand opnieuw checken")
b. **Update Hero + dashboard tile**: secundaire link naar `/vind-al-je-geld`
   wanneer `MONEYFINDER_HUB_ENABLED=true`. Bestaande links blijven werken.
c. **Update `lib/plus.ts`**: positioneer Plus expliciet als "her-check-engine"
   over alle 6 modules.
d. **Tests**:
   - `tests/vind-al-je-geld.test.tsx`: tegels alleen tonen bij actieve flag
   - Geen tegel zichtbaar wanneer ouder-flag uit (regression-guard)
e. **Feature-flag**: `MONEYFINDER_HUB_ENABLED` (default false).
f. Commit: `feat(hub): vind-al-je-geld central landing + Plus positioning`.

---

## DEEL 5 — Rapport + finale gate

a. `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen.
b. `V29_REPORT.md`: per feature de **revenue-conclusie** (uit guardrail 5), de
   gebruikte bronnen + peildatum, wat er WEL en NIET gebouwd is (auto-claim NS =
   positionering, geen achtergrond-job), en de eigenaar-stappen:
   - `FEATURE_BOX3_CHECK_ENABLED=true` na privacy/disclaimer-review
   - `FEATURE_NS_CHECK_ENABLED=true` na review NS-voorwaarden-tekst
   - `FEATURE_ZORGKOSTEN_CHECK_ENABLED=true` na review aftrek-disclaimer
   - `FEATURE_MONEYFINDER_HUB_ENABLED=true` als laatste (overzicht-pagina)
   - Stripe-side: nieuwe Plus-positionering vergt geen prijswijziging
c. Commit: `docs(v29): money-finder expansion V29 verified (sources + peildatum)`.

---

## Done-criteria

- [ ] `docs/V29_DATA_2026.md` — alle forfaits/drempels/bedragen sourced met
      `// bron:` + peildatum, geen aggregator-cijfers
- [ ] Box 3-check: gefaseerd revenue-model (gratis < € 500, NCNP 25% ≥ € 500)
- [ ] NS-check: gratis + Plus-positionering ("auto-claim"-pijler)
- [ ] Zorgkosten-check: indicatie + uitgebreide checklist, geen exact bedrag
- [ ] Vind-al-je-geld-hub: tegels alleen bij actieve flags
- [ ] Privacy: élke check **client-side**, géén opslag, `ph-no-capture` op
      gevoelige inputs, analytics zonder PII
- [ ] Flags allemaal default UIT
- [ ] Géén providergeld, géén hyp/verz, géén gehallucineerde cijfers
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] `V29_REPORT.md` met bronnen + peildatums + eigenaar-stappen

## Eindrapportage

```
MONEYFINDER_EXPANSION_V29 — Final report
DEEL 0 ✓ <hash> — V29_DATA_2026.md (sourced)
DEEL 1 ✓ <hash> — Box 3-rechtsherstel (gefaseerd revenue)
DEEL 2 ✓ <hash> — NS Geld-Terug + Plus auto-claim positionering
DEEL 3 ✓ <hash> — Zorgkostenaftrek (indicatie + checklist)
DEEL 4 ✓ <hash> — Vind-al-je-geld hub
DEEL 5 ✓ <hash> — V29_REPORT.md
```

**Drie nieuwe consumer-aligned features die directe (Box 3) + indirecte (NS + Zorgkosten
via Plus) revenue brengen, alles sourced, indicatie-only, client-side, en flag-gated tot
eigenaar de privacy/disclaimer per feature heeft gereviewed.**

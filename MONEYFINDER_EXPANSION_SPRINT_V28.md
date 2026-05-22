# DeGeldHeld v28 — "Vind al je geld" uitbreiding (model B: nooit providergeld)

**Lees eerst `docs/EXPANSION_PROPOSALS.md`** (gesourcet marktonderzoek). Eigenaar
koos **model B**: omzet komt van de **klant** (abonnement / no-cure-no-pay) of van
**teruggehaald/geclaimd geld** — **nooit van providers**.

Verbreedt DeGeldHeld naar **"vind al het geld dat je laat liggen"**: rekeningen
(onderhandelen) + **toeslagen + gemeente-regelingen** (claimen) + **vluchtclaims**
(EU261) + verspilling (spookabonnementen). *(Vervangt de oude affiliate-sprint.)*

## Hoe je het per klant checkt (3 mechanismes — het hart van deze sprint)
- **Toeslagen + gemeente-regelingen** = één **vragenlijst** (inkomen, huishouden,
  kale huur, leeftijd, vermogen, postcode→gemeente) → **regel-engine** op de
  officiële Belastingdienst-regels + het **Nibud/Stimulansz "Bereken je Recht"**-
  model (inkomen + gemeente → landelijke + lokale regelingen). Géén DigiD/bank-toegang.
- **Vluchtclaim** = **vluchtnummer + datum** → **flight-data-API** (Aviation Edge /
  AviationStack — historische vertraging) → **EU261**-regels (≥3u + afstand →
  €250/€400/€600).

---

## ⚠️ GUARDRAILS
1. **`npm run build` (EXIT 0) + `npx tsc --noEmit` + `npm test` groen vóór élke commit.**
2. **NOOIT providergeld** (model B). Alleen klant-betaalt of % van teruggehaald geld.
3. **Regels/bedragen komen EXACT uit `docs/BENEFITS_DATA_2026.md`** — dat is de
   al-gesourcete **bron-van-waarheid** (met `// bron:` + peildatum 2026). Neem die
   één-op-één over. **Géén gehallucineerde of "bijgewerkte" grenzen/bedragen.**
   Huurtoeslag = **indicatie + verwijzing** (complexe formule, geen exact bedrag).
   Onzeker → range + "controleer/aanvragen bij de Belastingdienst".
4. **Indicatie, geen advies / geen overname.** Toeslag-check = schatting +
   verwijzing naar de Belastingdienst-aanvraag (geen DigiD-integratie).
   Vluchtclaim-check = indicatie; de claim zelf is no-cure-no-pay (zie DEEL 4).
   Disclaimer "Geen financieel/fiscaal advies".
5. **Privacy/AVG (gevoelig):** inkomens-/vlucht-data **transient** verwerken; niet
   opslaan tenzij expliciet gewenst; maskeren in analytics; geen PII in events.
6. **Ethisch:** toeslagen-/regelingen-check is **gratis** (je verdient niet aan
   mensen die een uitkering mislopen → groei-motor).
7. **AFM-gate** intact (geen hypotheek/verzekering).
8. Geen `--no-verify`/`--force`. Co-author trailer:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## START
```
Lees /Users/bdb/alpharadar-pro/degeldheld/MONEYFINDER_EXPANSION_SPRINT_V28.md, docs/BENEFITS_DATA_2026.md én docs/EXPANSION_PROPOSALS.md, en voer alle deeltaken in volgorde uit. Per deel: npm test + npx tsc --noEmit + npm run build (EXIT 0) groen vóór de commit. Alle regels/grenzen/bedragen komen EXACT uit docs/BENEFITS_DATA_2026.md (al gesourcet) — niets gokken of "bijwerken"; huurtoeslag = indicatie + verwijzing. Checks = indicatie + verwijzing; geen DigiD/aanvraag-overname; geen opslag van gevoelige data. Toeslagen/gemeente-check gratis; vluchtclaim no-cure-no-pay op teruggehaald geld. Geen providergeld, geen hyp/verz. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify/--force. Eindig met V28_REPORT.md incl. bronnen + peildatums.
```

---

## DEEL 1 — Geld-check wizard: toeslagen + gemeente-regelingen (gratis)
a. Neem de **2026-regels EXACT over uit `docs/BENEFITS_DATA_2026.md`**
   (zorgtoeslag, huurtoeslag, kindgebonden budget — grenzen + bedragen + bronnen).
   Codeer in `lib/toeslagen.ts` mét de `// bron:` + peildatum uit dat bestand.
   **Huurtoeslag = alleen indicatie** (huur ≤ max-huurgrens + vermogen ok →
   "mogelijk recht") + link naar de officiële proefberekening; géén exact bedrag.
b. **Gemeente-regelingen** volgens het **"Bereken je Recht" (Nibud/Stimulansz)**-
   model: postcode → gemeente; inkomen → indicatie van landelijke + (generiek-veilig)
   lokale regelingen (bijzondere bijstand, kwijtschelding, individuele
   inkomenstoeslag, collectieve zorgverzekering) + waar aanvragen. Geen verzonnen
   per-gemeente-bedragen — toon "je komt waarschijnlijk in aanmerking" + de link.
c. Eén **vragenlijst** (`/geld-check`): inkomen, huishouden, kale huur, leeftijd,
   vermogen, postcode → `estimateBenefits(input)` (pure functie) → "**je loopt
   mogelijk €X/mnd mis**" per regeling + uitleg + aanvraag-knop. Disclaimer.
d. Privacy: transient; sla niets gevoeligs op zonder expliciete keuze.
e. Tests: voorbeeld-inputs → juiste indicatie (tegen de gesourcete grenzen);
   elke grens/bedrag heeft `// bron:`; randgevallen → nette range; geen opslag.
f. Commit: `feat(geld-check): sourced toeslagen + gemeente-regelingen wizard (free)`.

## DEEL 2 — Herframing "vind al je geld" + funnel
a. Landing/onboarding: naast "verlaag je vaste lasten" → "check of je toeslagen/
   regelingen misloopt" + "had je een vertraagde vlucht?". Gratis instap naar `/geld-check`.
b. Na de check → doorstroom naar upload/onderhandeling + abonnement ("we vonden
   €X — wil je ook je rekeningen checken?").
c. Tests: landing toont de takken; check → vervolg-CTA.
d. Commit: `feat(brand): "find all your money" framing + funnel`.

## DEEL 3 — Abonnement (DeGeldHeld Plus) als cashflow-motor
a. Positioneer het abonnement: maandelijkse her-scan vaste lasten + **periodieke
   her-check** toeslagen/regelingen (regels/inkomen wijzigen) + alerts
   (contract-einde, prijsstijging). Prijs (~€2,99-4,99/mnd) + duidelijke waarde
   (ook voor water/streaming). Klant betaalt → 100% aligned.
b. Tests: abonnement-waarde + her-check-logica.
c. Commit: `feat(plus): subscription as the all-category money-finder engine`.

## DEEL 4 — Vluchtclaim (EU261): check (gratis) + claim (no-cure-no-pay)
a. **Check:** UI `/vluchtclaim` → vluchtnummer + datum → een **flight-data-adapter**
   (`lib/flightdata.ts`, providerafhankelijk: Aviation Edge / AviationStack — via
   env-key, achter `FEATURE_CLAIMS`) haalt de **werkelijke vertraging** op →
   `eu261Compensation(distanceKm, delayMin)` (EU261-bedragen + drempels EXACT uit
   `docs/BENEFITS_DATA_2026.md`) → "indicatie: €X". Geen API-key → nette
   "binnenkort"-staat.
b. **Claim:** als de klant doorgaat → een no-cure-no-pay claim-flow (model `Claim`):
   DeGeldHeld stelt de claim-brief op namens de klant (zelfde consent-principe als
   de relay) → bij uitbetaling **% van het teruggehaalde bedrag** (bijv. 25% — onder
   EUclaim's 31%). **Achter `FEATURE_CLAIMS` (default false)** tot de eigenaar de
   flight-data-deal + juridische check rond heeft.
c. Tests: EU261-calc (afstand/vertraging → juist bedrag, sourced); geen API-key →
   fallback; flag uit → geen claim-UI.
d. Commit: `feat(claims): EU261 flight-delay check + no-cure-no-pay claim (flagged)`.

## DEEL 5 — Spookabonnement-detectie (verspilling)
a. Detecteer uit geüploade rekeningen terugkerende kosten + markeer waarschijnlijk
   ongebruikte/dubbele abonnementen → begeleid **zelf** opzeggen (géén betaalde
   opzegdienst — bekritiseerd; zie bron).
b. Tests: detectie + zelf-opzeg-begeleiding.
c. Commit: `feat(waste): detect unused/duplicate subscriptions + self-cancel guidance`.

## DEEL 6 — Rapport
a. `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen.
b. `V28_REPORT.md`: de geld-check (bronnen + peildatum), de vluchtclaim (EU261-bron
   + welke flight-data-API), herframing, abonnement, waste-detectie. EIGENAAR-stappen:
   privacy/voorwaarden bijwerken; jurist-check "indicatie geen advies" + de claim-
   volmacht; flight-data-API-key + `FEATURE_CLAIMS` aanzetten.
c. Commit: `docs(v28): money-finder expansion verified (sources + peildatum)`.

---

## Done-criteria
- [ ] Geld-check wizard: toeslagen + gemeente-regelingen, **gesourcet** (bron + peildatum), indicatie + verwijzing, géén DigiD/opslag
- [ ] Vluchtclaim: EU261-check via flight-data-API + no-cure-no-pay claim, **achter FEATURE_CLAIMS**
- [ ] Privacy: gevoelige data transient, niet opgeslagen, gemaskeerd
- [ ] Herframing "vind al je geld" + funnel · abonnement als cashflow-motor · waste-detectie
- [ ] Géén providergeld, géén hyp/verz, geen gehallucineerde cijfers
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] `V28_REPORT.md` met bronnen, peildatums + eigenaar-stappen

## Eindrapportage
```
MONEYFINDER_EXPANSION_V28 — Final report
DEEL 1 ✓ <hash> — geld-check (toeslagen + gemeente, sourced)
DEEL 2 ✓ <hash> — "vind al je geld" + funnel
DEEL 3 ✓ <hash> — abonnement cashflow-motor
DEEL 4 ✓ <hash> — vluchtclaim EU261-check + claim (flagged)
DEEL 5 ✓ <hash> — spookabonnement-detectie
DEEL 6 ✓ <hash> — rapport + bronnen
```

**Per klant checken = één slimme vragenlijst (toeslagen/gemeente) + een
vluchtnummer-lookup (EU261). Alles indicatie + sourced, gratis voor de check,
no-cure-no-pay op teruggehaald geld — en nooit providergeld.**

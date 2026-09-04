# V40 — WWS-data zelfstandige woonruimte (geldend 2026)

Bron-registratie voor `lib/wws-punten.ts`. Elke waarde hieronder is op
3-9-2026 letterlijk opgehaald uit de geldende regelgeving. Primaire bron:
**Besluit huurprijzen woonruimte, Bijlage I onderdeel A, geldend 2026**
(wetten.overheid.nl/BWBR0003237/2026-01-01) — hierna "BHW". Prijstabel:
**Huurcommissie, Beleidsboek waarderingsstelsel zelfstandige woonruimte,
Bijlage 3 (per 1-1-2026)**.

## Punten per rubriek (BHW Bijlage I-A)

| Onderdeel | Waarde | Bron |
|---|---|---|
| Oppervlakte vertrek | 1 punt per m² | BHW rubriek 1 |
| Oppervlakte overige ruimte (incl. privé-garage) | 0,75 punt per m² | BHW rubriek 2 |
| Verwarmd vertrek | 2 punten | BHW rubriek 3 |
| Verwarmde overige/verkeersruimte | 1 punt (max 4) | BHW rubriek 3 |
| Verkoeling in vertrek (mits ook verwarmingsfunctie) | 1 punt, max 2 | BHW rubriek 3 |
| Keuken: aanrecht < 1 m / 1–2 m / ≥ 2 m | 0 / 4 / 7 punten | BHW rubriek 5 |
| Keuken extra kwaliteit | max verdubbeling aanrechtpunten | BHW rubriek 5.2 |
| Toilet aparte ruimte / in badkamer | 3 / 2 punten | BHW rubriek 6 |
| Hangend toilet aparte ruimte / in badkamer | 3,75 / 2,75 punten | BHW rubriek 6 |
| Wastafel | 1 punt (max 1 per ruimte excl. badkamer) | BHW rubriek 6 |
| Meerpersoonswastafel (≥ 70 cm, 2 kranen) | 1,5 punt | BHW rubriek 6 |
| Douche / bad / bad+douche | 4 / 6 / 7 punten | BHW rubriek 6 |
| Sanitair extra kwaliteit | max verdubbeling douche/bad-punten | BHW rubriek 6.2 |
| Gehandicapten-voorziening | 1 punt per € 332 investering | BHW rubriek 7 |
| Privé-buitenruimte | 2 punten + 0,35 punt per m² | BHW rubriek 8 |
| Gedeelde buitenruimte | 0,75 punt per m² ÷ aantal adressen | BHW rubriek 8 |
| Rubriek 8 maximum | 15 punten | BHW rubriek 8 |
| Géén buitenruimte | −5 punten | BHW rubriek 8 |
| WOZ: per waarde | 1 punt per € 16.954 (peildatum 1-1-2025) | BHW rubriek 11.1 |
| WOZ: per m² gebruiksoppervlak | 1 punt per € 268 | BHW rubriek 11.1 onder b |
| WOZ per m² — kleine nieuwbouw (< 40 m², bouwjaar 2018–2022, COROP Amsterdam/Utrecht) | deler € 114 i.p.v. € 268 | BHW rubriek 11.1 onder a |
| WOZ-minimum nieuwbouw 2015–2019 | min 40 punten als rest-punten ≥ 110 | BHW rubriek 11.2 |
| WOZ-cap | max 33% van totaal; geldt NIET onder 187 punten | BHW rubriek 11 |
| Video-intercom (aanbel + deur openen) | 0,25 punt | BHW rubriek 12 |
| Laadpaal | 2 punten | BHW rubriek 12 |
| Zorgwoning | +35% over onderdelen 1 t/m 11.1 | BHW rubriek 12 |

## Energieprestatie (BHW rubriek 4, per label)

| Label | Eengezins | Meergezins/duplex |
|---|---|---|
| A++++ | 62 | 58 |
| A+++ | 57 | 53 |
| A++ | 52 | 48 |
| A+ | 47 | 43 |
| A | 41 | 37 |
| B | 34 | 30 |
| C | 22 | 15 |
| D | 14 | 11 |
| E | −5 | −5 |
| F | −9 | −9 |
| G | −15 | −15 |

Zonder geldig label telt het bouwjaar (zelfde puntkolommen): ≥ 2002 → A ·
2000–2001 → B · 1992–1999 → C · 1984–1991 → D · 1979–1983 → E · 1977–1978 →
F · ≤ 1976 → G. // bron: BHW rubriek 4, bouwjaar-kolom.

## Opslagen op de maximale huurPRIJS (niet op punten)

| Opslag | Waarde | Bron |
|---|---|---|
| Rijksmonument (contract ≥ 1-7-2024) | +35% | BHW art. 8a |
| Gemeentelijk/provinciaal monument | +15% | BHW art. 8a |
| Beschermd stads-/dorpsgezicht (pre-1965 + eisen) | +5% | BHW art. 8a |
| Nieuwbouwopslag middenhuur (eerste ingebruikname > 1-7-2024, bouw gestart < 1-1-2028) | +10%, 20 jaar | BHW art. 8a lid 4 |

## Maximale huurprijsgrenzen per 1-1-2026 (ankerwaarden)

Volledige tabel: Huurcommissie Beleidsboek Bijlage 3 / Volkshuisvesting
Nederland "Maximale huurprijsgrenzen zelfstandige woningen per 1-1-2026"
(indexatie 2026: +3,65%). Geverifieerde ankerrijen:

| Punten | Max. huur/mnd |
|---|---|
| 40 | € 250,26 |
| 100 | € 637,67 |
| 140 | € 912,26 |
| 142 | € 925,98 |
| 143 | € 932,93 — **bovengrens laag segment** |
| 144 | € 939,73 |
| 160 | € 1.049,57 |
| 186 | € 1.228,07 — **liberalisatiegrens/middenhuur-top** |
| 187 | € 1.234,92 |
| 200 | € 1.324,18 |
| 250 | € 1.667,40 |

**F2b (3-9-2026): volledige 40–250-tabel geïmporteerd** in
`lib/wws-punten.ts` (`MAX_HUUR_TABEL_2026_CENTS`, 211 rijen) vanaf de
Huurcommissie-bijlage-3-pagina. Import-verificatie: doorlopend 40–250,
strikt oplopend, stapgroottes € 5,50–7,50, en exact gelijk aan de 11
bovenstaande onafhankelijk opgehaalde ankerrijen. De eerdere
conservatieve band is daarmee vervallen (band == exact).

## Afronding

Waardering per rubriek op 0,25 punt (1/8 wordt naar boven afgerond);
eindtotaal op hele punten (≥ 0,5 naar boven). // bron: BHW Bijlage I-A slot +
Beleidsboek juli 2025.

## F2b-kalibratie (3-9-2026) — bevindingen uit Beleidsboek + live wizard

**Kalibratie-case 1 (officiële wizard live doorlopen): exacte 1-op-1 match.**
Meergezins, label A, WOZ € 300.000 (peildatum 1-1-2025), 5 vertrekken
(56 m²) + toiletruimte 1,5 m² + berging 5 m² + balkon 6 m² + video-intercom
→ officieel **159 punten, € 1.042,73** — onze lib identiek op elke rubriek
(56 / 3,75 / 10 / 37 / 4 / 8 / 4 / 36 / 0,25). Vastgelegd als borg-test.

Regels toegevoegd aan de lib op basis van Beleidsboek juli 2025 (PDF, h2):

| Regel | Waarde | Bron |
|---|---|---|
| Oppervlakte-afronding | per ruimte 2 decimalen; SOM per categorie op hele m² (≥ 0,5 op), dán pas punten | Beleidsboek §2.4 (incl. rekenvoorbeeld 25,40 → 25) |
| Vertrek-eisen | o.a. ≥ 4 m², ≥ 1,50 m breed; keuken/badkamer altijd vertrek | Beleidsboek h2 §1 |
| Overige-ruimte-eis | ≥ 2 m² (toiletruimte 1,5 m² telt dus nérgens als oppervlakte; wél 3 sanitairpunten) | Beleidsboek h2 §2 — live bevestigd in wizard |
| Verkeersruimten (gang/hal/overloop) | niet gewaardeerd als oppervlakte; verwarmd → 1 pt (max 4 samen met overige) | Beleidsboek h2 §2/§3 |
| Monument-uitzondering energie | E/F/G → 0 punten (geen minpunten) bij rijks/prov./gem. monument | Beleidsboek 4.2 |
| EPV overeengekomen | vast 32 (eengezins) / 28 (meergezins) | Beleidsboek 4.3 |
| Kleine woningen ≤ 40 m² | aparte tabellen 4.4.1 (<25 m²) en 4.4.2 (25–40 m²), alléén voor NTA-labels 1-1-2021 t/m 30-6-2024 (overgangsrecht, vervallen per 1-1-2025) | Beleidsboek 4.4 |
| Rubriek 9 gemeensch. binnenruimtes | vertrek 1 pt/m² ÷ adressen; overige 0,75 pt/m² ÷ adressen | Beleidsboek h2 r9 |
| Rubriek 10 gemeensch. parkeren | Type I (garage) 9 / II (buiten+dak) 6 / III (buiten) 4 punten ÷ adressen | Beleidsboek h2 r10 |
| Zolder zonder vaste trap | −5 punten op de zolder-oppervlaktepunten (max de zolderpunten zelf) | Beleidsboek h2 §2 — nog niet in lib (intake-veld F3) |
| Gebruiksoppervlak voor WOZ-deling | = som gewaardeerde ruimtes (vertrekken + overige), niet BAG | live wizard: 61 m² bij case 1 |
| < 40 punten | wizard toont de 40-puntenprijs (€ 250,26); lib geeft null → F3 toont "onder tabelminimum" | live wizard |
| Keuken/sanitair-featurepunten | volledige lijsten met puntwaarden (afzuig 0,75 · inductie 1,75 · vaatwasser 1,5 · … / bubbelbad 1,5 · doucheafscheiding 1,25 · …) | Beleidsboek 5.2/6.2 — voor de F3-intake |

## KALIBRATIE AFGEROND (4-9-2026) — 10 wizard-cases, gate GEHAALD

Alle cases live doorlopen in de officiële Huurprijscheck en vastgelegd als
borg-tests (tests/wws-punten.test.ts, "KALIBRATIE cases"):

| Case | Regel getest | Officieel | Lib |
|---|---|---|---|
| 1 | integraal (7 ruimtes, per rubriek) | 159 / € 1.042,73 | exact ✓ |
| 2 | eengezins + bouwjaar-fallback + −5 geen buitenruimte | 101 / € 644,53 | exact ✓ |
| 3 | **cap-bodem**: cap zou < 187 geven → totaal = 186 | 186 / € 1.228,07 | fix → ✓ |
| 3b | **cap-formule**: totaal = ⌊rest ÷ 0,67⌋ | 198 / € 1.310,46 (WOZ 65) | fix → ✓ |
| 4 | Amsterdam/Utrecht-deler € 114 | 173 / € 1.138,85 (WOZ 111) | exact ✓ |
| 5 | zorgopslag 35% (volgorde + afronding) | 156 / € 1.022,07 (opslag 40,50) | exact ✓ |
| 6 | monument: label G → 0 + prijsopslag 35% | 79 / € 494,10 → € 667,04 | exact ✓ |
| 8 | gedeelde tuin ÷ adressen + parkeer III ÷ adressen | 7,50 resp. 2 punten | exact ✓ |
| 9 | kleine-woning-tabel <25 m² label A | 111 / € 713,20 (energie 45) | exact ✓ |
| 10 | nieuwbouwopslag +10% op prijs | 157 / € 1.029 → € 1.131,90 | exact ✓ |

**Cap-formule definitief (uit cases 3/3b):** bij ongecapt totaal ≥ 187 wordt
het totaal ⌊rest ÷ 0,67⌋; komt dat onder de 187, dan bodem op 186. De
letterlijke 33%-lezing uit de BHW-bijlage was ontoereikend — de wizard-
implementatie van de Huurcommissie is leidend genomen.

Weergave-detail (geen rekenverschil): bij de bodem toont de wizard de
WOZ-rubriek een half punt lager (92,50 bij rest 93) maar het puntentotaal en
de prijs zijn identiek aan de onze.

Rest-scope (bewust v1-buiten): rijksmonument-contracten van vóór 1-7-2024
(oud €-toeslagregime) · zolder-zonder-vaste-trap-aftrek (intake-veld F3) ·
verkoeling-zonder-koeling-NTA-variant.

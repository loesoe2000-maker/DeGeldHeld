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

De tabel is per-punt en niet lineair; tussen ankers rekent de lib bewust een
**conservatieve band** (onder- en bovengrens uit omliggende ankers).
**F2b-actie**: volledige 40–250-tabel importeren uit het officiële bestand,
daarna vervalt de band.

## Afronding

Waardering per rubriek op 0,25 punt (1/8 wordt naar boven afgerond);
eindtotaal op hele punten (≥ 0,5 naar boven). // bron: BHW Bijlage I-A slot +
Beleidsboek juli 2025.

## Open kalibratievragen (F2b, vóór lancering beantwoorden)

1. "Kleine woning na 1-1-2025"-melding in de officiële wizard: raakt dit de
   labelbepaling (EP-Online/NTA 8800) of de WWS-punten zelf? In BHW-bijlage
   staat géén aparte kleine-woning-energieregel → aanname: labelbepaling.
   Verifiëren via Beleidsboek §4.
2. Volgorde zorgopslag (35%) vs. WOZ-cap (33%): lib past cap eerst toe en
   zorgopslag daarna over 1–11.1 — bevestigen met Beleidsboek-rekenvoorbeeld.
3. Rijksmonument bij contracten van vóór 1-7-2024 (oud regime, €-toeslag):
   buiten scope v1 — alleen nieuwe contracten.
4. WOZ-cap-randgeval: als de 33%-cap het totaal van boven 187 naar ónder 187
   duwt — geldt er dan een bodem (bv. totaal wordt op 186 gesteld)? De lib
   volgt nu de letterlijke BHW-tekst (cap zodra ongecapt ≥ 187, geen bodem);
   bevestigen met Beleidsboek-rekenvoorbeeld. Dit randgeval kwam boven bij
   het schrijven van de unit-tests (adres op 188,5 ruw → gecapt 165,75).

# Toeslagen + EU261 — gesourcete data 2026 (bron-van-waarheid voor de geld-check)

> **Peildatum: 2026 (per 1 januari 2026), onderzocht 2026-05-23.**
> Dit is de **enige** bron die `MONEYFINDER_EXPANSION_SPRINT_V28.md` mag gebruiken
> voor bedragen/grenzen. Niets buiten dit bestand gokken. Bij twijfel: toon een
> **range + "controleer/aanvragen bij de Belastingdienst"**, reken niets hard.
> Herijk jaarlijks (de bedragen wijzigen per 1 januari).

## ⚠️ Eerlijk over wat wél en niet hard te schatten is
- **Zorgtoeslag** = vrij hard te schatten (vaste inkomens-/vermogensgrens + max-bedrag).
- **Kindgebonden budget** = bedragen per kind hard; de afbouw boven de grens is een
  formule → geef een indicatie/range.
- **Huurtoeslag** = **complexe formule** (géén vaste inkomensgrens; hangt af van huur,
  huishouden, leeftijd, percentages). → **alleen een grove indicatie + verwijzing
  naar de officiële proefberekening**. Géén exact bedrag faken.

---

## ZORGTOESLAG 2026
| Veld | Alleenstaand | Met toeslagpartner |
|---|---|---|
| Max. jaarinkomen | € 40.857 | € 51.142 (gezamenlijk) |
| Max. vermogen (1-1-2026) | € 146.011 | € 184.633 |
| Max. toeslag | € 129 / mnd | € 246 / mnd |
- Voorwaarden: 18+, NL-basisverzekering, inkomen+vermogen onder de grens.
- *bron: [Belastingdienst — vermogen zorgtoeslag](https://www.belastingdienst.nl/wps/wcm/connect/nl/zorgtoeslag/content/maximaal-vermogen-zorgtoeslag) · [geld.nl — grens zorgtoeslag 2026](https://blog.geld.nl/zorgverzekering/grens-zorgtoeslag)*

## HUURTOESLAG 2026 (indicatie — complexe formule)
| Grens | Bedrag |
|---|---|
| Kwaliteitskortingsgrens | € 498,20 |
| Lage aftoppingsgrens | € 713,02 |
| Hoge aftoppingsgrens | € 764,14 |
| Max. huur (21+) | € 932,93 |
| Max. huur (18-20) | € 498,20 |
| Max. vermogen | € 38.479 (alleenst.) / € 76.958 (partner) |
- **Géén vaste inkomensgrens** — afhankelijk van huur + aantal bewoners.
- Subsidie-% van de huur: 100% tot kwaliteitskortingsgrens, 65% tussen
  kwaliteitskortings- en lage aftoppingsgrens, 40% boven de hoge aftoppingsgrens.
- **Implementatie:** check of huur ≤ max-huurgrens + vermogen onder de grens →
  "je komt mogelijk in aanmerking" + **link naar de officiële proefberekening**
  voor het exacte bedrag. Geen exact bedrag zelf uitrekenen.
- *bron: [Belastingdienst — vermogen huurtoeslag](https://www.belastingdienst.nl/wps/wcm/connect/nl/huurtoeslag/content/maximaal-vermogen-huurtoeslag) · [Woonbond — normen en grenzen huurtoeslag](https://www.woonbond.nl/thema/huren-en-geld/normen-en-grenzen-huurtoeslag/) · [Over Toeslagen — bedragen 2026](https://www.overtoeslagen.nl/actueel/nieuws/2025/11/24/bedragen-huurtoeslag-en-andere-toeslagen-2026-bekend)*

## KINDGEBONDEN BUDGET 2026
| Veld | Bedrag |
|---|---|
| Max. per kind < 12 jr | € 2.580 / jr |
| Max. per kind 12-16 jr | € 3.283 / jr |
| Max. per kind 16-17 jr | € 3.516 / jr |
| Extra alleenstaande ouder | ± € 3.320 / jr *(bronnen variëren licht → toon als "ca.")* |
| Max. inkomen voor het volledige bedrag | € 29.736 (alleenst.) / € 39.141 (partner) |
| Max. vermogen | € 146.011 (alleenst.) |
- Boven de inkomensgrens: **afbouw** (geen harde nul). → indicatie/range.
- *bron: [Consumentenbond — kindgebonden budget 2026](https://www.consumentenbond.nl/toeslagen/kindgebonden-budget) · [Belastingdienst — max inkomen kindgebonden budget](https://www.belastingdienst.nl/wps/wcm/connect/nl/kindgebonden-budget/content/maximaal-inkomen-kindgebonden-budget)*

## GEMEENTE-REGELINGEN (model, geen vaste bedragen)
- Per gemeente verschillend (350+). **Niet per-gemeente bedragen gokken.**
- Volg het **Nibud/Stimulansz "Bereken je Recht"**-model: postcode → gemeente +
  inkomen → indicatie van regelingen (bijzondere bijstand, kwijtschelding
  gemeentebelasting, individuele inkomenstoeslag, collectieve zorgverzekering) +
  **link naar de gemeente/het officiële aanvraagpunt**.
- *bron: [Nibud — Bereken je Recht](https://berekenuwrecht.nibud.nl/)*

## EU261 — vluchtcompensatie (stabiel, 2026 ongewijzigd)
| Bedrag | Voorwaarde |
|---|---|
| € 250 | vlucht ≤ 1.500 km, **≥ 3 u** vertraging (aankomst) |
| € 400 | EU-vlucht > 1.500 km, óf niet-EU 1.500-3.500 km, **≥ 3 u** |
| € 600 | vlucht > 3.500 km, **≥ 4 u** |
- Geldt voor: vertrek uit een EU-land, **of** aankomst in de EU met een EU-maatschappij.
- **Buitengewone omstandigheden** (extreem weer, ATC-staking) → géén compensatie;
  staking van eigen personeel van de maatschappij → **wél**.
- Verjaring NL: **2 jaar** na de vluchtdatum.
- *bron: [Europa.eu — rechten vliegtuigpassagiers](https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_nl.htm) · [EUclaim — verordening 261/2004](https://www.euclaim.nl/vlucht-problemen/rechten-van-vliegtuigpassagiers/verordening-261-2004)*

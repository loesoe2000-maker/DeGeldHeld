# V40 F3 — Huurprijs-check: routes, termijnen en leges (geldend 2026)

Bron-registratie voor `lib/huurprijs-check.ts`. Alles hieronder is op
4-9-2026 opgehaald bij de **Huurcommissie zelf** (primaire bron; aggregators
zijn alleen gebruikt om pagina's te vinden, nooit als bron voor een getal).

De puntentelling zelf staat in `docs/V40_DATA_WWS_2026.md` (F2/F2b,
gekalibreerd tegen de officiële Huurprijscheck).

## GATE 0 — geldt het zelfstandige stelsel wel? (toegevoegd 4-9-2026)

**Dit is de enige plek waar de check een FOUT antwoord kon geven in plaats
van een afwijzing.** Sinds 1-7-2024 hangt "zelfstandig" niet alleen aan de
voorzieningen maar ook aan het aantal bewoners:

> "Onder een woonruimte welke een zelfstandige woning vormt, wordt een
> woonruimte verstaan als bedoeld in artikel 7:234 van het Burgerlijk
> Wetboek, welke wordt bewoond door maximaal twee personen of welke wordt
> bewoond door drie of meer personen die een duurzame gemeenschappelijke
> huishouding hebben."
> — Besluit huurprijzen woonruimte art. 1 lid 2, geldend 2026
>   (wetten.overheid.nl/BWBR0003237/2026-01-01, geverifieerd 4-9-2026)

Gevolg: een appartement met eigen voordeur, keuken, toilet en douche waarin
**drie of meer huisgenoten zonder gemeenschappelijke huishouding** wonen — de
klassieke vriendengroep, woningdelers, veel expat-shares en studentenhuizen —
is juridisch **onzelfstandig** en moet onder het WWSO worden gewaardeerd.
Onze puntentelling is daar niet op van toepassing.

**Implementatie:** `isJuridischZelfstandig()` in `lib/huurprijs-check.ts`;
`bewoning` is een VERPLICHT inputveld (niet optioneel — vergeten te vragen
wás de bug). Bij onzelfstandig geeft de check géén puntenaantal en géén
maximale huur, maar verwijst door.

**En de boodschap is positief, niet afwijzend:** onzelfstandige woonruimte
valt **altijd** in de gereguleerde sector — er is dus altijd een maximale
huurprijs, ongeacht de huurprijs en de contractdatum. Er is geen midden- of
vrije sector voor kamerverhuur. Die huurder heeft dus wél een route; wij
rekenen hem alleen (nog) niet uit. // bron: Huurcommissie, Huurprijscheck
onzelfstandige woonruimte + Beleidsboek WWSO januari 2026.

## De kernvraag: mág deze huurder überhaupt een toets aanvragen?

Dit is de belangrijkste gate van de hele flow. Lang niet iedereen met een te
hoge huur heeft een zaak — en dat moet de check eerlijk zeggen.

### Route A — Toetsing aanvangshuurprijs (nieuw contract)

> "Stuur het formulier in binnen 6 maanden nadat het huurcontract van uw
> woning, kamer, woonwagen of standplaats is ingegaan."
> — huurcommissie.nl/onderwerpen/huurder-sociale--en-middensector/
>   huurprijs-punten-sociale-middensector-huurder/verlaging-aanvangshuurprijs-vragen

- Contract op/na 1-7-2024: **alleen binnen 6 maanden na aanvang**.
- Tijdelijk contract van vóór 1-7-2024: gedurende de looptijd (max 2 jaar)
  **tot een half jaar na afloop** ervan.
- Uitspraak geldt "vanaf de datum waarop het huurcontract is ingegaan"
  (terugwerkende kracht tot contractstart).

### Route B — Huurverlaging op puntenaantal (lopend contract)

> "De datum waarop de nieuwe huur moet ingaan. Let op: dit kan niet eerder
> zijn dan 2 volle kalendermaanden nadat u het voorstel verstuurt."
> "Start de zaak in elk geval binnen 6 weken na de datum van de huurverlaging
> die u had voorgesteld."
> — huurcommissie.nl/onderwerpen/huurder-sociale--en-middensector/
>   huurprijs-punten-sociale-middensector-huurder/huurverlaging-op-puntenaantal

Stappen: (1) schriftelijk voorstel aan de verhuurder met een ingangsdatum van
minimaal 2 volle kalendermaanden later; (2) gaat de verhuurder niet akkoord →
Huurcommissie, **binnen 6 weken na die voorgestelde ingangsdatum**. Geen
terugwerkende kracht: de verlaging gaat in per de voorgestelde datum.

### Route C — Wet betaalbare huur, lopend contract van vóór 1-7-2024

Huurders met een contract van vóór 1-7-2024 en een woning van **≤ 143 punten**
kunnen sinds **1-7-2025** huurverlaging naar de maximale huurprijs vragen
(zelfde voorstel-procedure als route B).

### Wanneer is er GEEN route (eerlijk "nee" van de check)

- **≥ 187 punten** (hoogsegment/vrije sector): geen procedure mogelijk.
- **144–186 punten met een contract van vóór 1-7-2024**: de Huurcommissie
  stelt expliciet "Bij huurcontracten afgesloten vóór 1 juli 2024 kan géén
  sprake zijn van middenhuur" → geen procedure.
  // bron: huurcommissie.nl/onderwerpen/wet--en-regelgeving/wet-betaalbare-huur/
  //   wet-betaalbare-huur-voor-huurders
- Lopend vrijesector-contract, langer dan 6 maanden, zonder einddatum: "Dan
  kan de Huurcommissie geen bindende uitspraak doen."

## Leges

Toetsing aanvangshuurprijs: **€ 25** voor de huurder (terug bij winst) —
zelfde bedrag als de servicekosten-procedure, zie
`HUURCOMMISSIE_LEGES_CENTS` in `lib/huurcommissie.ts`
// bron: huurcommissie.nl (procedure toetsing aanvangshuur) — bevestigd 4-9-2026.

## Behandeltijd

Circa 4–6 maanden (zelfde orde als de bestaande servicekosten-flow;
`HUURCOMMISSIE_BEHANDELING_MAANDEN = 5`).

## Marge-regel (productbeslissing, geen wet)

De huurder levert zelf metingen aan (kamers, aanrecht, sanitair). Die zijn
onzeker. Omdat méér punten een HOGERE maximale huur betekenen, rekent de
check naast de opgegeven waarden ook een **ruime variant** door die de punten
maximaliseert (meettolerantie erbij, aanrecht naar de hogere klasse, niet
opgegeven keuken-/sanitair-extra's op het wettelijke maximum, WOZ-tolerantie).

- Huur ligt óók boven de ruime maximale huur → **kansrijk**.
- Huur ligt alleen boven de basisberekening → **twijfelgeval: niet indienen**
  zonder exacte opmeting.
- Huur onder de basisberekening → **geen zaak**.

Dit is bewust pessimistisch voor ons: het filtert cases weg die we anders zouden
verliezen (en waarbij de klant € 25 leges kwijt is).

## Huurtoeslag-terugname (toegevoegd 4-9-2026, `lib/huurtoeslag.ts`)

Bij een huurder mét huurtoeslag daalt die toeslag mee zodra de kale huur
daalt. Een fee over de bruto verlaging zou de klant dan geld kosten voor
voordeel dat hij niet krijgt. **De fee gaat daarom over de conservatief
bepaalde NETTO besparing.**

Bronnen (alle primair, opgehaald 4-9-2026): Wet op de huurtoeslag geldend
1-1-2026 (wetten.overheid.nl/BWBR0008659) · Besluit op de huurtoeslag geldend
1-1-2026 (BWBR0008763) · Regeling huurtoeslaggrenzen 2026, Stcrt. 2025, 39783.

**Bronconflict opgelost.** Secundaire bronnen spraken elkaar tegen over wat er
per 1-1-2026 veranderde. De wettekst zelf geeft uitsluitsel:
- De **normhuurformule is vervallen** (art. 18 en 19 Wht, letterlijk
  "[Vervallen per 01-01-2026]"). Basishuur is nu een vast bedrag; het
  inkomenseffect zit in een lineaire afbouw (art. 21 lid 2).
- De **kwaliteitskortingsgrens en aftoppingsgrenzen zijn NIET vervallen** —
  art. 20 Wht staat onverkort en Stcrt. 2025, 39783 indexeert ze voor 2026.
- De **maximale huurgrens is geen afwijzingsgrond meer** maar werkt als
  plafond via art. 21 lid 1 onder d. Dáár kwam de verwarring vandaan.
- **Servicekosten tellen niet meer mee in de rekenhuur** → voor ons loopt
  kale huur 1-op-1 naar rekenhuur.

### Parameters 2026 en de marginale terugname

| Grens | Bedrag 2026 | Terugname per euro huurverlaging in die schijf |
|---|---|---|
| boven maximale huurgrens | > € 932,93 | **0%** (netto = bruto) |
| aftoppingsgrens → maximale huurgrens | € 713,02 / € 764,14 → € 932,93 | **40%** |
| kwaliteitskortingsgrens → aftoppingsgrens | € 498,20 → aftopping | **65%** |
| basishuur → kwaliteitskortingsgrens | € 202,52 / € 200,71 → € 498,20 | **100% — netto NUL** |
| onder de basishuur | < basishuur | 0% |

Aftoppingsgrens: € 713,02 bij 1–2 bewoners, € 764,14 bij 3 of meer. Let op de
contra-intuïtie: een **hogere** aftoppingsgrens laat méér van de verlaging in
de 65%-schijf vallen en levert de huurder dus **minder** netto op.

### Productregels die hieruit volgen

1. **Communiceer als "je houdt netto ten MINSTE € X over"**, nooit als een
   exact bedrag — de werkelijke uitkomst kan alleen hoger zijn (namelijk als
   de toeslag al bijna nul is door het inkomen, dat wij niet vragen).
2. **Fee = 0 zodra de netto besparing 0 is**, ook al is de zaak juridisch
   kansrijk. Dit is tegelijk het sterkste verschil met concurrenten die op
   bruto factureren.
3. **Jaarlijkse onderhoudstaak (november):** alle bedragen worden geïndexeerd.
   `HUURTOESLAG_PARAMS` is jaargesleuteld met een `geldigTot`; loopt die af,
   dan toont de check géén netto bedrag meer maar verwijst door naar de
   officiële proefberekening. Zelfde geldt voor de 143-puntengrens, die de
   geïndexeerde tegenhanger van een eurobedrag is en dus kan schuiven.

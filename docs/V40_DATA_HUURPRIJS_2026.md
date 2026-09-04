# V40 F3 — Huurprijs-check: routes, termijnen en leges (geldend 2026)

Bron-registratie voor `lib/huurprijs-check.ts`. Alles hieronder is op
4-9-2026 opgehaald bij de **Huurcommissie zelf** (primaire bron; aggregators
zijn alleen gebruikt om pagina's te vinden, nooit als bron voor een getal).

De puntentelling zelf staat in `docs/V40_DATA_WWS_2026.md` (F2/F2b,
gekalibreerd tegen de officiële Huurprijscheck).

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

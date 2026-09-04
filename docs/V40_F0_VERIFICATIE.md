# V40 F0 — Verificatie-bevindingen (3-9-2026)

Verify-fase vóór de huurcheck-bouw. Alles hieronder is live gecontroleerd
(officiële wizard doorlopen in de browser; registers en besluiten nagezocht).
Dit document is de feitenbasis voor F2 (calculator) en F3 (intake).

## 1. Officiële Huurprijscheck — structuur en velden

Wizard: https://huurprijscheck.huurcommissie.nl/zelfstandige-woonruimte
(nieuwe check, huurprijs vanaf 1-7-2024; aparte "oude check" voor contracten
van vóór 1-7-2024 via checkjeprijs.huurcommissie.nl). Er zijn drie aparte
checks: zelfstandig / onzelfstandig / woonwagens+standplaatsen. Er bestaat een
**Engelse versie** van de officiële check (relevant voor de expat-lijn).

**Stap 1 — Woning**: postcode + huisnummer (+ toevoeging) · tijdvak
(1-7-2024–31-12-2024 / 2025 / 2026 — **puntprijzen verschillen per tijdvak**)
· WOZ-waarde + peildatum (handmatig; hulplink WOZwaardeloket; taxatierapport
mag als WOZ nog niet is vastgesteld) · energielabel (**de wizard haalt dit
zelf op per adres** — bevestigt EP-Online-koppeling per adres; aparte regel
"kleine woning na 1-1-2025") · woonvorm (eengezins/meergezins) ·
gemeenschappelijke binnenruimtes (ja/nee).

**Stap 2 — Binnenruimtes**: per ruimte de oppervlakte, ruimte-voor-ruimte:
woonkamer · keuken · woonkamer met open keuken · slaapkamer · badkamer ·
toiletruimte · andere binnenruimtes · keuken/bad/douche/wastafel in andere
ruimte. (Sub-vragen per ruimtetype — o.a. aanrechtlengte — volgen in F2 uit
het beleidsboek.)

**Stap 3 — Buitenruimtes** (eigen óf gedeeld): balkon · dakterras ·
voortuin/zijtuin · achtertuin · loggia · geen buitenruimte · parkeerruimtes.

**Stap 4 — Bijzonderheden**: monument (gemeentelijk/provinciaal · beschermd
stads-/dorpsgezicht · rijksmonument, met **contract-datumsplitsing vóór/na
1-7-2024**) · zorgwoning · voorzieningen voor personen met een handicap ·
nieuwbouw/hoogniveau-renovatie opgeleverd 2015–2019 · nieuwbouwopslag (eerste
ingebruikname na 1-7-2024) · intercom met beeld · regio-regel
Amsterdam/Utrecht (alle ruimtes samen < 40 m², opgeleverd 2018–2022).

**Stap 5 — Resultaat.** De wizard heeft "opslaan en later verdergaan".

## 2. Registers — wat kan automatisch, wat niet

| Bron | Toegang | Actie |
|---|---|---|
| **BAG** (oppervlakte, bouwjaar, gebruiksdoel per adres) | Gratis API met key; aanvragen via Kadaster-formulier ("BAG API Individuele Bevragingen"), gebruikslimieten | Owner: key aanvragen // bron: kadaster.nl/zakelijk/producten/adressen-en-gebouwen/bag-api-individuele-bevragingen |
| **EP-Online** (energielabel per adres) | Gratis publieke zoek per postcode+huisnummer; API/webservice met key via apikey.ep-online.nl | Owner: key aanvragen // bron: ep-online.nl |
| **WOZ-waardeloket** | Individuele raadpleging gratis; **géén officiële open API**, massaal opvragen/scrapen niet toegestaan (open data vergt wetswijziging) | Huurder vult WOZ zelf in met hulplink — exact zoals de officiële wizard het doet // bron: data.overheid.nl datarequests "Api WOZ-waardeloket" |

Conclusie: m² en energielabel kunnen (na keys) automatisch per adres; WOZ is
en blijft een gebruikersveld met hulplink. Daarmee doen wij het niet slechter
dan de officiële check zelf.

## 3. WWS-scope en bronnen voor F2

- Drie stelsels; wij starten **alleen met zelfstandige woonruimte** (grootste
  markt, wizard-structuur hierboven).
- Kalibratiebron: **Beleidsboek waarderingsstelsel zelfstandige woonruimte,
  versie juli 2025** // bron:
  huurcommissie.nl/site/binaries/.../2025/07/01/beleidsboek-waarderingsstelsel-zelfstandige-woonruimte (PDF)
- WWSO (onzelfstandig) is per 1-7-2025 gemoderniseerd (zelfde
  kwaliteitsaspecten) — later eventueel als uitbreiding // bron:
  huurcommissie.nl nieuws 16-6-2025 "Vernieuwde beleidsboeken per 1 juli 2025".
- Afronding: waardering per rubriek op 0,25 punt (1/8 naar boven) // bron: idem.
- Tijdvak-afhankelijke maximale-huurprijstabellen (2024-H2 / 2025 / 2026).

## 4. Cadeau-vondst: verplichte puntentelling van de verhuurder

Sinds **1-1-2025 is de verhuurder wettelijk verplicht een puntentelling bij
elk nieuw huurcontract te voegen** // bron: huurcommissie.nl
/support/huurprijscheck/huurprijscheck-zelfstandige-woonruimte. Gevolg voor
F3: bij contracten van na 1-1-2025 vragen we de huurder die telling te
uploaden en **controleren** we die — hardere feitenbasis dan zelf blind
tellen. Zelf tellen blijft het pad voor oudere contracten.

## 5. Scheidsrechter-principe bevestigd

De Huurcommissie schrijft zelf dat bij een beoordeling **altijd een nieuwe
puntentelling door een onderzoeker** wordt opgesteld; de check is indicatief
// bron: zelfde pagina. Onze rol blijft dus triage + dossier, nooit bindend
oordeel — de marge-regel uit het V40-plan blijft de kern.

## 6. Kaart-mandaat herbruikbaar

`stripeCustomerId` (r57) en `feePaymentMethodId` (r62) staan op het
**User**-model (prisma/schema.prisma) en `chargeFeeOffSession`/
`persistFeeSetup` (lib/payments.ts) zijn claim-agnostisch → de huur-flow kan
hetzelfde mandaat-vooraf-patroon gebruiken als Box 3, zonder verbouwing.

## Openstaande owner-acties uit F0

1. BAG API-key aanvragen (Kadaster-formulier).
2. EP-Online API-key aanvragen (apikey.ep-online.nl).
   (Tot de keys er zijn kan F2/F3 met handmatige invoer + publieke zoek.)

## F0-verdict

**Groen voor F1.** Geen blockers gevonden; twee register-keys zijn
owner-acties die de bouw niet blokkeren (handmatige fallback bestaat en is
gelijk aan wat de officiële wizard doet).

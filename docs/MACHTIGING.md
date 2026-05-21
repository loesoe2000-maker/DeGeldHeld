# Machtiging — onderhandelen namens de klant (volmacht)

> **CONCEPT — laat door een jurist controleren vóór productie. Dit is geen
> juridisch advies.** De structuur is bewust opgezet rond Boek 3 BW (volmacht)
> + AVG; de exacte formulering moet een jurist/DPO toetsen.

DeGeldHeld onderhandelt **namens de klant** met diens provider over het
**bestaande** contract. Daarvoor geeft de klant een **volmacht**. Dit document
legt de juridische basis + de exacte concept-machtigingstekst vast.

## Juridische grondslag

### 1. Volmacht — art. 3:60 BW
De klant (volmachtgever) verleent DeGeldHeld (gevolmachtigde) de bevoegdheid om
**in zijn naam** rechtshandelingen te verrichten: namens hem **onderhandelen
en corresponderen** met de genoemde provider over zijn bestaande contract.

### 2. Binding + strikte scope — art. 3:66 BW (KERN)
Op grond van art. 3:66 BW binden de handelingen van de gevolmachtigde, binnen
de grenzen van zijn bevoegdheid, de volmachtgever. Daarom is de volmacht
**strikt beperkt**:
- **Wél gedekt:** onderhandelen + corresponderen namens de klant
  (onderhandel-mails, counter-voorstellen, vragen om een beter tarief).
- **NIET gedekt:** het **accepteren of aangaan** van een (nieuw of gewijzigd)
  contract, of het vastleggen van een definitieve deal. Dat blijft een
  **eigen rechtshandeling van de klant** — DeGeldHeld legt elk concreet/
  committerend bod eerst aan de klant voor (de goedkeuring-gate). Zo wordt de
  klant **nooit ongewild gebonden**.

### 3. Herroepbaarheid — art. 3:72 BW
De volmacht eindigt onder meer door **herroeping** door de volmachtgever. De
klant kan de machtiging **op elk moment intrekken** (de pauzeer/stop-knop): na
intrekking verstuurt DeGeldHeld geen mails meer namens de klant.

### 4. Consumentenrecht
De relay-dienst is een dienst van DeGeldHeld met duidelijke voorwaarden
(zie /voorwaarden), een herroepingsrecht op de dienst, en zonder oneerlijke
handelspraktijk. De klant kiest er expliciet voor (opt-in) en kan stoppen.

### 5. AVG (grondslag voor de relay)
Het verwerken + **doorsturen** van de klantgegevens (naam, klantnummer,
factuurcontext) naar de **provider** rust op:
- **uitvoering van de overeenkomst** (art. 6.1.b AVG) — de relay-dienst, én
- **expliciete toestemming** voor het relayen naar die specifieke provider.
Dit staat in de privacyverklaring: welke gegevens, waarom, naar wie (= de
provider waarmee onderhandeld wordt).

## Concept-machtigingstekst (wat de klant accepteert)

> **Machtiging om namens mij te onderhandelen**
>
> Ik machtig DeGeldHeld B.V. om **namens mij** te onderhandelen en
> corresponderen met **{provider}** over mijn **bestaande contract**
> ({klantnummer indien bekend}). DeGeldHeld mag in mijn naam onderhandel-
> e-mails sturen en op antwoorden van {provider} reageren met
> tegenvoorstellen.
>
> Deze machtiging is **beperkt tot onderhandelen en corresponderen**.
> DeGeldHeld mag **géén** nieuw of gewijzigd contract namens mij accepteren of
> afsluiten: **elk concreet aanbod of definitieve stap leg ik zelf goed** via
> de goedkeuring-knop. Zonder mijn goedkeuring wordt er niets vastgelegd of
> geaccepteerd.
>
> Ik kan deze machtiging **op elk moment intrekken** (pauzeren/stoppen);
> daarna stuurt DeGeldHeld geen e-mails meer namens mij.
>
> Ik geef toestemming om mijn naam, klantnummer en factuurcontext naar
> {provider} te sturen voor zover nodig om te onderhandelen (AVG art. 6.1.a/b).
>
> *(concept — wordt juridisch getoetst)*

De **exact geaccepteerde tekst** wordt per onderhandeling opgeslagen
(`Negotiation.relayAuthText`) met een timestamp (`relayAuthorizedAt`) voor de
audit-trail.

## Implementatie-haakjes
- `Negotiation.relayAuthorizedAt / relayAuthText / relayToken / relayState`
  (zie schema). Geen relay-send zonder `relayAuthorizedAt`.
- Intrekken = `relayState = PAUSED` (geen mails meer); de goedkeuring-gate =
  `relayState = AWAITING_APPROVAL` (klant accepteert/weigert de deal zelf).

## v25 — veiligheidsgates rond de volmacht
- **Feature-flag (`FEATURE_RELAY_ENABLED`, default `false`).** De volledige
  relay — consent-prompt-zichtbaarheid, `relay-authorize`, de status-pagina,
  `relay-approve`, `relay-pause` — staat **uit** tot de eigenaar 'm aanzet. Uit
  → uitsluitend de handmatige kopieer-flow. **Zet 'm pas aan ná juridisch
  akkoord op dit document + /voorwaarden + /privacy.**
- **Kaart verplicht (GUARDRAIL 4).** `relay-authorize` weigert (409
  `card-required`) zonder gekoppelde fee-kaart + geaccepteerd
  no-cure-no-pay-mandaat. "Wij doen het werk" → een bewezen besparing moet
  afschrijfbaar zijn.
- **Provider-adresregister (`lib/relay-providers.ts`).** Alleen op de officiële
  contactpagina geverifieerde adressen (elk met `// bron:`). Onbekend → de klant
  voert het adres zelf in. Geen gehallucineerde adressen.

## Eigenaar-restpunten
1. Machtigingstekst + voorwaarden + privacyverklaring **door jurist/DPO laten
   toetsen** vóór de relay live gaat.
2. Bevestig dat de relay-afzender (SPF/DKIM/DMARC op het verzend-domein) klopt
   zodat mails namens de klant niet in spam landen.
3. Bevestig de adressen in `lib/relay-providers.ts` (steekproef op de officiële
   contactpagina's) vóór activering.
4. Zet **`FEATURE_RELAY_ENABLED=true`** in Vercel pas ná akkoord op 1–3.

# Retentie-dynamiek per categorie — waarom + via welk kanaal providers verlagen

> Onderzoek (mei 2026, sourced) als **basis voor de category-specifieke
> onderhandel-logica**. Dít bepaalt waar DeGeldHeld geld verdient.
>
> **Kernconclusie:** no-cure-no-pay verdient alléén waar een echte
> **retentie-lever** bestaat. De categorieën splitsen in 3 types — en de
> "stuur een onderhandel-mail naar de provider"-aanpak past maar bij één ervan.

## De 3 types (de belangrijkste indeling)

| Type | Categorieën | Kan DeGeldHeld een verlaging onderhandelen? | Fee? |
|---|---|---|---|
| **A — Échte onderhandeling** | TELECOM, ENERGIE, KRANT/TIJDSCHRIFT | **Ja** — er is een retentie-lever | **Ja, 20% no-cure-no-pay** |
| **B — Self-service besparing** | STREAMING, GYM (ketens) | Nee — de klant downgrade/opzegt zelf | **Nee** (je onderhandelt niks) |
| **C — Niet te verlagen** | WATER | Nee — regionaal monopolie | **Nee** |

**Waarom dit cruciaal is:** voor TYPE B/C een "onderhandeling" beloven is
misleidend én levert niks op (geen verlaging om 20% van te rekenen). Het script
moet dus per categorie wéten welk type het is en zich anders gedragen.

---

## Per categorie

### TELECOM / INTERNET — TYPE A (sterk)
- **Waarom verlagen ze:** hoge churn, felle concurrentie. **Nieuwe klanten krijgen
  korting; loyale klanten betalen juist meer.** De retentie-afdeling heeft budget
  om je te houden zodra je dreigt te vertrekken.
- **Kanaal:** **opzeg-intentie → retentie-afdeling ("klantbehoud-team")** — in de
  praktijk vooral **telefonisch**. Bellen mét opzeg-intentie routeert je naar
  retentie, die korting mág geven. **E-mail werkt zwak** (KPN/Vodafone/Odido/Ziggo
  publiceren geen retentie-mail — zie v26).
- **Lever:** "ik stap over" + de **nieuwe-klant-/concurrent-prijs** + contract-einde
  (na de vaste periode gratis opzegbaar, opzegtermijn max 1 maand).
- **Implicatie voor DeGeldHeld:** de e-mail-relay is hier zwak. De échte waarde =
  de klant de **munitie + een belscript** geven (concurrent-prijzen + exacte
  argumenten + "vraag naar de retentie-afdeling") om zelf te bellen.
- *bron: Consumentenbond "onderhandelen met je provider"; ACM ConsuWijzer; iusmentis (loyale klanten betalen meer); timetocancel.*

### ENERGIE — TYPE A (matig-sterk)
- **Waarom:** gedereguleerd, overstappen makkelijk + **overstapbonus**; churn kost geld.
- **Kanaal:** overstap/retentie; schriftelijk werkt soms. Het echte moment is
  **contract-einde / boetevrije opzegging**.
- **Lever:** **Energiewet 2026** → veel vaste contracten zijn dit jaar boetevrij
  opzegbaar, per provider in een window (bijv. Vandebron t/m 28-2, Essent t/m
  12-3-2026) — mits de leverancier de voorwaarden in jouw nadeel wijzigde. Plus
  markt-kWh/m³-tarief + overstapbonus. **Let op:** vroeg opzeggen kan welkomst-
  korting (>€400) kosten → timing telt.
- **Nuance:** variabel/dynamisch = altijd maandelijks gratis opzegbaar; vast =
  opzegvergoeding behalve in het boetevrij-window.
- *bron: Radar/AVROTROS (Energiewet 2026 boetevrij); Overstappen.nl; Consumentenbond energie.*

### KRANT / TIJDSCHRIFT (subset van ABONNEMENT) — TYPE A (matig)
- **Waarom:** uitgevers vechten churn met **win-back-aanbiedingen**.
- **Kanaal:** opzeg-flow → retentie-aanbod. "Akkoord met een nieuw aanbod = een
  nieuw abonnement met andere voorwaarden/prijs."
- **Lever:** opzeg-intentie → win-back/retentie-korting.
- *bron: ACM ConsuWijzer / Consumentenbond / Rijksoverheid (stilzwijgende verlenging, opzegtermijn).*

### STREAMING (Netflix / Spotify / Videoland / Disney+) — TYPE B
- **Waarom NIET onderhandelbaar:** vaste, wereldwijde prijzen; geen individuele
  retentie-korting. Je kunt Netflix niet mailen voor een lager tarief.
- **Besparing (self-service):** **downgrade tier** (Netflix Premium→Standard ≈ €5/mnd),
  student-korting (Spotify €6,99 i.p.v. €12,99), jaar i.p.v. maand, bundels, of
  **opzeggen → win-back-promo** (Videoland returning-deal).
- **Implicatie:** géén onderhandel-mail. DeGeldHeld geeft **advies** (welk tier /
  bundel / opzeg-moment). 20%-fee past niet — de klant doet 't zelf.
- *bron: draadbreuk.nl (streaming-korting); Netflix Helpcentrum; watkost.nl.*

### GYM (Basic-Fit e.d.) — TYPE B (ketens), soms A (kleine gyms)
- **Waarom:** **ketens zijn rigide** — opzeggen is gratis via app/kiosk, maar er is
  geen individuele korting. Kleine/lokale gyms zijn soms flexibeler.
- **Besparing:** juiste contract kiezen (4 vs 52 wk), downgrade, opzeggen +
  heraanmelden bij een actie. Geen echte onderhandeling bij ketens.
- *bron: Basic-Fit prijzen/opzeggen; opzeggen.nl.*

### WATER — TYPE C (monopolie)
- **Waarom NIET:** regionaal monopolie — je **kunt niet overstappen**.
- **Besparing:** verbruik verlagen + **kwijtschelding** — let op: het
  **drinkwaterbedrijf (Vitens) doet géén kwijtschelding**; alleen het
  **waterschapsbelasting**-deel is kwijt te schelden, via gemeente/waterschap. Bij
  betaalproblemen: uitstel/betalingsregeling.
- *bron: Vitens (betalen/betaalproblemen); binnenlandsbestuur (kwijtschelding waterschap).*

---

## Wat dit betekent voor het product (revenue) — actiepunten
1. **20%-fee alleen op TYPE A** (telecom/energie/krant): daar onderhandelt
   DeGeldHeld een verlaging die de klant zelf niet (makkelijk) krijgt.
2. **TYPE B (streaming/gym-keten):** geef **advies**, geen onderhandeling, **geen
   fee** over self-service-besparing. (Evt. later: een vaste "bespaar-scan"-prijs.)
3. **TYPE C (water):** verbruik + kwijtschelding-advies, geen fee.
4. **Telecom-nuance:** e-mail is zwak → lever **munitie + belscript** voor de
   retentie-afdeling (telefonisch), niet (alleen) een relay-mail.
5. **Energie-nuance:** lever = **timing (contract-einde / boetevrij-window) +
   markt-tarief**, niet alleen een mail.

> Deze indeling is de basis voor `CATEGORY_NEGOTIATION_STRATEGY_SPRINT_V27.md`.

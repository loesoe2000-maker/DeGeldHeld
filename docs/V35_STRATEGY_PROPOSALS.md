# V35 — Baanbrekende functie-voorstellen (strategische ronde)

> Datum: 2026-05-26 · Status: na V34 (tech-basis 86,3% composite, alle gates groen).
> **Doel**: één écht onderscheidende feature toevoegen die concurrenten **niet
> binnen 6 maanden kunnen kopiëren** en die zonder enorm marketing-budget
> verkeer trekt. Géén Dyme-clone, géén EUclaim-kopie.
>
> **Realiteit-check vóór iedere bouw-beslissing**: DGH heeft 86,3% tech-zekerheid
> maar ~10-15% markt-validatie. Een "groot baanbrekend" idee is alleen waard
> als het ofwel (a) de markt-validatie zelf is, ofwel (b) parallel kan
> draaien naast validation-week — niet erin plaats van.

---

## Concurrentie-landschap (peildatum 2026-05-26)

| Speler | Wat zij doen | Wat zij missen |
|---|---|---|
| **Dyme** | PSD2-bank-koppeling + abonnement-detector + €60-70/jr Plus | Geen claim-flows, geen onderhandelings-executie, geen Box 3 |
| **EUclaim / AirHelp / Flightright** | Vluchtclaims EU261 (31% + €33 NCNP) | Alleen vluchten, niets anders |
| **Bezwaarmaker.nl / Kosteloosbezwaar.nl / Eigen Huis** | WOZ-bezwaar NCNP | Alleen WOZ, ethisch grijs ("klacht-spam") |
| **Jongbloed / RB-leden / accountants** | Box 3-rechtsherstel via uurtarief | Niet consumer-friendly, geen NCNP voor kleine cases |
| **BelastingBox / Pinkweb / Taxbutler** | Aangifte-software | Geen pro-actieve detectie, geen onderhandeling |
| **Independer / Overstappen.nl / Pricewise** | Vergelijkers + affiliate-commissies | Zij verdienen op providers (niet model B) |
| **trein-vertraging.nl** | NS-vertraging-claim | Alleen NS, geen ander claims-platform |
| **Slimster / Geldfit / Nibud** | Educatie + tools maar geen onderhandeling | Geen executie, alleen informatie |
| **Schuldhulpmaatjes / Geldwijzer** | Schuldhulp na-de-schuld | Géén preventieve detectie |

**Patroon**: elke speler doet **één ding** of **één laag** (alleen detectie /
alleen claim / alleen educatie). **Niemand doet end-to-end executie over
meerdere domeinen heen, klant-aligned (model B), met radicale transparantie.**

---

## Voorstel A — PSD2 Auto-Action ("Set & Forget" geld-monitor)

### Wat het is
Klant koppelt bankrekening 1× via PSD2 (zoals Tikkie/Bunq/Buddy). Onze AI
**monitort transacties live**, detecteert kansen, en vraagt per kans om
**1-click consent** om voor klant te handelen. **Niet alleen detectie — executie.**

Real-time triggers:
- "Je betaalde €52 aan KPN — markt-mediaan is €38. Klik voor relay-onderhandeling."
- "We detecteren een dubbele Spotify-incasso van 3 mnd terug — terug te halen?"
- "Je inkomensdaling deze maand → check zorgtoeslag-update."
- "Vlucht-vergoeding KLM op je rekening ontbreekt na de annulering van 12 mei. Claim?"
- "WOZ-aanslag gedetecteerd op je rekening — wil je een bezwaar-check?"
- "Eindafrekening Vattenfall: €847 — afwijking van markt-tarief detected, mogelijk fout."

### Waarom baanbrekend
Dyme zegt "**je verliest geld**" — wij zeggen "**we regelen het, geef alleen
toestemming**." Dat is de stap van **information-tool naar action-platform**.
Niemand in NL doet dit met executie over alle 6 claim-types die we hebben.

### Buildable in DGH-context
- **PSD2-licentie**: niet zelf — gebruik een gelicenseerde tussenpartij
  (Tink (€), Yapily (€), Salt Edge (€), GoCardless Open Banking).
  ~€500-2000/mnd afhankelijk van volume.
- **Engine**: bestaande spookabonnement-detectie + Box3-claim + waste-detection
  zijn al pure functies. Voeden van transaction-stream is "alleen" data-mapping.
- **Consent-UI**: per gedetecteerde kans één toestemming-modal. Hergebruik
  relay-authorize-pattern.
- **Effort**: 4-6 weken voor MVP (PSD2-koppeling + 3 detect-categorieën).

### Risico
- **PSD2-licentie kosten** (€500-2000/mnd) drukt cashflow voor je 0 klanten hebt
- **DPO + DPIA** verplicht voor PSD2-data — vergt eigenaar-werk
- **AFM-grens**: alleen detectie + executie van bestaande consument-rechten,
  géén beleggings-/pensioenadvies. Strikt-houden.
- **Dyme heeft al PSD2** — wij MOETEN de executie-laag waarmaken om
  onderscheid te behouden

### Eerlijke verdict
**Sterk** als je bereid bent ~€1k/mnd te investeren in een PSD2-partner én de
relay-flow daadwerkelijk werkt (KPN-test verdict pending). **Risk-warning**:
bouw dit niet voor de relay-validation-week-uitkomst — als relay-mail dood
is, heeft auto-action geen executie-laag.

---

## Voorstel B — Glass Box (radicale transparantie)

### Wat het is
DeGeldHeld publiceert **maandelijks geanonimiseerd** op een publieke pagina:
- Per provider: gemiddelde verlaging na onderhandeling, succes-rate (%-deals),
  gemiddelde retentie-aanbod
- Per check: hoeveel mensen mis-lopen-geld-totaal (sourced uit hun resultaten),
  gemiddelde indicatie
- Per claim-type: succes-rate, gemiddelde uitkering, gemiddelde
  doorlooptijd
- Onze eigen fees: hoeveel we factureerden, refund-rate, klachten-rate

**Géén concurrent doet dit.** Vergelijkers tonen alleen provider-tarieven,
nooit hun eigen prestaties. Bezwaarmaker.nl publiceert geen succes-rates.
EUclaim publiceert geen uitbetalings-statistieken.

### Waarom baanbrekend
Het maakt **vertrouwen meetbaar.** Klanten kunnen kiezen op basis van
ECHTE prestaties, niet marketing. Het is ook een PR-machine: "Dit is hoeveel
KPN gemiddeld toegeeft" → media pakt op.

Concurrent kopiëren-tijd: jaren (vergt jaren van data + bereidheid om
zwaktes publiek te tonen).

### Buildable in DGH-context
- **Data-laag**: bestaat al (negotiations + box3claims + alle check-results
  in DB). Aggregatie-queries + maandelijkse export naar publieke pagina.
- **Privacy**: aggregeer op n ≥ 50 per groep — onder die drempel niet tonen
  (k-anonymity).
- **Pagina**: `/transparantie` of `/glass-box` met grafieken (Chart.js /
  Recharts) + downloadbare CSV/JSON.
- **Effort**: 1-2 weken voor MVP (aggregatie-queries + grafieken + maandelijkse
  cron + persbericht-template).

### Risico
- **0 klanten = geen data**. Eerste maanden zijn de cijfers leeg. Solution:
  begin pas zodra je 50+ klanten hebt — dan is het krachtig. Tot dan: niet
  bouwen.
- **Zwaktes publiek**: als KPN-succes-rate 5% blijkt, ZIE je dat in
  Glass Box. Maar dat is precies waarom het GEBROUWEN-trust werkt.
- **Concurrenten beschermen zwaktes** — wij zijn dus alleen baanbrekend
  zolang we durven. Cultureel risico voor de owner.

### Eerlijke verdict
**Krachtig op middellange termijn** (na ~6 mnd, 50+ klanten). **Nu nog te
vroeg** — geen data om te tonen. Bouw dit als V37-V40, niet V35.

---

## Voorstel C — Claim-Hub (alle consumenten-claims op 1 plek)

### Wat het is
**ALL-IN-1 consumenten-claim-platform.** EUclaim doet vluchten, Bezwaarmaker
doet WOZ, jongbloed doet Box 3 — wij doen **alles**, in één UI, met één
account, met één fee-model:

**Bestaande claims** (al in V28-V31):
- ✓ Box 3-rechtsherstel
- ✓ EU261-vluchtclaim
- ✓ NS Geld-Terug-vertraging

**Toe te voegen** (V35 scope):
- Huurcommissie-bezwaar (servicekosten + jaarlijkse huurverhoging)
- Energie-eindafrekening-claim (fouten/te-veel-betaald, ACM-route)
- Verzekering-claim-afwijzing-bezwaar (kifid-route)
- Parkeerboete-bezwaar (cjib-portaal — let op rauwe rechtsstaat-grens)
- Incasso-bezwaar (te-hoge-kosten, niet-onderbouwde claim)
- Telecom-klacht ACM (afwijking voorwaarden)
- Vergoeding annulering trein-/busreis (NS, GVB, RET — bredere dan alleen NS)
- Vergoeding cadeau-/tegoedbon (failliete winkel-vouchers)

**Eén tool**, **één account**, **één no-cure-no-pay** (gefaseerd zoals Box 3):
< €50 verwachte uitkering → DIY-brief gratis. ≥ €50 → NCNP 20%.

### Waarom baanbrekend
**Niemand bundelt dit.** Jongbloed doet Box 3 voor €300/uur, EUclaim doet
vluchten voor 31%+€33, parkeerboete-bezwaar.nl doet €19 per bezwaar. Wij
doen ze ALLEMAAL voor 20% NCNP — onder iedereen.

**Concurrent kopiëren-tijd**: 18-24 maanden (vergt 8 verschillende juridische
domeinen + 8 verschillende officiële procedures + 8 verschillende form-flows).

### Buildable in DGH-context
- **Architectuur ligt al klaar**: Box3Claim-model is generiek
  herbruikbaar voor andere claim-types. proof-back-flow idem.
- **Per claim-type 1-2 weken**: research-procedure + brief-template + check-wizard
  + tests. 8 claims = 16 weken = 4 maanden voor volledige hub.
- **MVP V35**: voeg 3 claims toe (Huurcommissie + Energie + Parkeerboete) =
  ~3-4 weken
- **Sourcing-discipline** zoals V28/V29: per claim een data-file met de
  officiële regels + drempels + deadlines.

### Risico
- **Juridische review per claim-type** vereist — niet alle 8 kunnen we zonder
  vrijwaring aanbieden. Sommige (incasso-bezwaar, verzekering-claim) raken
  Wft-/AFM-grenzen.
- **Owner-werk**: 8× verschillende officiële procedures uitzoeken kost tijd
- **Markt-fragmentatie**: per claim-type kleine niche. Pas waardevol als ALLE
  3 → cross-sell over claims werkt
- **Geen onderscheidende technologie**: het is een **bundeling-bet**, niet een
  tech-doorbraak. Andere spelers kunnen klonen als ze investeren.

### Eerlijke verdict
**Sterk én buildable**. Bestaande engines herbruikbaar. **Past direct in de
"vind al je geld"-positionering** die je al hebt. Onderscheid komt uit
**bundeling + lage fee + transparantie**, niet uit nieuwe technologie. Lage
risk, geleidelijke build.

---

## Voorstel D — Gen-Z Money-OS (doelgroep-focus)

### Wat het is
Schaf de breedte-strategie af. **Focus 100% op 18-25-jarigen.** Een 16-jarige
founder heeft een natuurlijk voordeel op deze doelgroep — geen 40-jarige Dyme-
PM kan dat kopiëren.

Specifiek voor de Gen-Z financiële realiteit:
- Studieschuld-optimalisatie (DUO-aflossings-strategie)
- Eerste huurwoning (servicekosten + huurcommissie + jongerencontract)
- Eerste baan (loonstrook-check + reiskostenvergoeding)
- ZZP-startup (zelfstandigenaftrek + MKB-winstvrijstelling)
- Online-veiligheid (scam-detector voor jongeren)
- Crypto + box 3 (vooral relevant voor Gen-Z)
- Kraampakket / kinderopvangtoeslag (jonge ouders)
- "Eerste belastingaangifte"-helper

**Distributie**: 100% TikTok + Instagram Reels. 16-jarige founder filmt zelf.
Niet betaalde ads — organic content over "wist je dat je dit kunt terugkrijgen?"

### Waarom baanbrekend
**Niemand richt zich specifiek op Gen-Z.** Dyme/Independer/Slimster targeten
generic adults. Geldfit en Nibud doen educatie zonder tooling. Een 16-jarige
founder met TikTok-aanwezigheid is **letterlijk niet te repliceren** door een
volwassen-team.

Concurrent kopiëren-tijd: nooit — concurrenten zijn structureel niet Gen-Z
zelf.

### Buildable in DGH-context
- **Tech**: de helft staat al (toeslagen, box 3 voor crypto-houders, NS voor
  forenzen-studenten)
- **Toe te voegen**: studieschuld-helper (DUO-API of statisch model) + scam-
  detector + ZZP-aangifte-helper
- **Content-laag is groter dan tech-laag**: TikTok-account opzetten,
  wekelijks 3-5 videos, community-building op Discord/Slack
- **Effort**: 4-6 weken voor tech + doorlopend content-werk

### Risico
- **Doelgroep-Switch**: bestaande 30+ visitors zijn niet je target meer.
  Tweede positionering bovenop bestaande?
- **Gen-Z heeft minder spendable income** → hogere churn op Plus
- **Content-werk is owner-tijd-intensief** — geen agentic-code-fix mogelijk
- **Markt is volatiel**: TikTok-algoritme verandert, kan trends keren

### Eerlijke verdict
**Krachtigste differentiator**. Maar **vergt het meeste owner-werk**
(content-creatie). Tech is bij-zaak. Past niet bij "ik werk vooral met
Claude Code"-workflow. Als je deze kiest: 50% van je tijd gaat naar TikTok,
niet naar code.

---

## Vergelijkings-tabel

| Voorstel | Tech-werk | Owner-werk | Time-to-MVP | Concurrent kopieert in | Onderscheid-duurzaamheid | Past bij huidige stack |
|---|---|---|---|---|---|---|
| A. PSD2 Auto-Action | Groot | Middel (DPIA/DPO) | 4-6 wk | 12 mnd (Dyme heeft basis) | Middel | Goed |
| B. Glass Box | Klein | Klein | 1-2 wk | 12-18 mnd | Hoog | Goed (mits data) |
| C. Claim-Hub (incl. 3 nieuwe) | Middel | Middel (jurist per type) | 3-4 wk | 18-24 mnd | Hoog | Uitstekend |
| D. Gen-Z Money-OS | Middel | Groot (content) | 4-6 wk + doorlopend | Nooit (founder-fit) | Hoog | Re-positionering |

---

## Eerlijke aanbeveling

**Mijn voorkeur: Voorstel C (Claim-Hub) als V35, Voorstel D (Gen-Z) als marketing-laag erbovenop.**

Waarom:

1. **C past direct op de bestaande stack** — Box3Claim-model is generiek, proof-back is generiek, sourcing-discipline is generiek. Drie nieuwe claim-types toevoegen kost minder dan het bouwen van V28-V29-V30 destijds.

2. **C heeft de langste kopieer-tijd** (18-24 mnd) want het vergt juridische research per type. Tech-spelers (Dyme) zullen dit NIET doen want ze hebben geen NCNP-engine.

3. **C versterkt de "vind al je geld"-positionering**. V28-V30 was over **checks** (indicaties). V35 zou over **claims** (executies) zijn. Klant-aligned end-to-end.

4. **D (Gen-Z marketing) is parallel mogelijk** zonder code te schrijven. TikTok-content gaat over de bestaande features — Box 3, toeslagen, NS-vertraging zijn perfect Gen-Z-content. Geen tech-werk.

5. **A (PSD2) en B (Glass Box) zijn beide te vroeg.** A vergt €1k/mnd dat we niet hebben. B vergt 50+ klanten data, die we niet hebben.

### Concrete volgorde-suggestie

| Wanneer | Wat | Owner-werk |
|---|---|---|
| Week 1 (validation-week, lopend) | KPN-test + 20 gesprekken | Owner |
| Week 2-3 | Claim-Hub V35: **Huurcommissie-bezwaar** als eerste claim-type | Code + jurist-check |
| Week 4-5 | Claim-Hub V35: **Energie-eindafrekening-claim** | Code + ACM-procedure-research |
| Week 6-7 | Claim-Hub V35: **Parkeerboete-bezwaar** | Code + CJIB-procedure |
| Parallel doorlopend | TikTok-content over bestaande features (Gen-Z laag) | Owner-content |
| Maand 3-6 | Pas dan: PSD2 (Voorstel A) als 50+ klanten + cashflow | Owner + engineer |
| Maand 6-12 | Glass Box (Voorstel B) als 50+ klanten met data | Code (data al er) |

---

## Wat NIET te doen

- **Niet alle 4 tegelijk** (verwatering, geen onderscheid duidelijk)
- **Niet Voorstel A nu** (cashflow-risico zonder klanten)
- **Niet Voorstel B nu** (geen data)
- **Geen Dyme-clone** (PSD2 zonder executie = "wij ook!"-positionering, geen onderscheid)
- **Niet de KPN-test-uitkomst negeren** — als relay-mail dood is, moet V35 dat reframen vóór nieuwe claims worden bijgebouwd

---

## START-string voor Voorstel C als V35 (klaar voor Claude Code wanneer je beslist)

Geen sprint nu — eerst owner-keuze. Als je voor C gaat, dan:
- Krijg ik per claim-type een doc-file zoals V29_DATA_2026.md (officiële regels,
  drempels, procedures)
- Schrijf ik een sprint-script per claim-type (1 sprint per 1-2 weken)
- Houden we de gefaseerde NCNP (gratis < €50, 20% boven)

**Maar dat doe ik pas nadat je hebt gekozen.** Lange opmerking eerst.

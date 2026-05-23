# V29 — Marktonderzoek: volgende ronde features (model B, EOW 2026-05-31)

> **Datum onderzoek:** 2026-05-24 · **Doel:** features identificeren die (a) **echt
> werken** / bouwbaar zijn in dagen, (b) waar **bewezen vraag** voor is (gesourcet
> NL data), (c) binnen **model B** blijven (geen providergeld), (d) niet de
> **AFM-zone** raken, (e) realistisch op te leveren zijn vóór einde volgende week.
>
> Trust-volgorde bronnen: Belastingdienst / Rijksoverheid / Hoge Raad / ACM /
> CBS / AFM / Consumentenbond / NOS > advies-/aggregator-sites. Honesty > precisie:
> waar iets in de praktijk niet werkt of de markt verzadigd is → expliciet "skip"
> + reden.

## Recap bestaande stack (mei 2026, na V28)

| Onderdeel | Status | Revenue-stroom |
|---|---|---|
| TYPE A negotiation (telecom/energie/krant) | live | no-cure-no-pay 20% |
| TYPE B advies (streaming/gym) | live | geen fee (top-of-funnel) |
| TYPE C monopolie (water) | live | geen fee |
| RELAY (onderhandelen-namens) | live + getest | onderdeel van A-fee |
| **Plus**-abonnement | live (waitlist tot KYC) | € 2,99-4,99 / mnd |
| **Geld-check** (toeslagen + gemeente) | gebouwd, flag-off | gratis (top-of-funnel) |
| **Vluchtclaim EU261** | gebouwd, flag-off | no-cure-no-pay % |
| **Spookabonnement-detectie** | live | onderdeel Plus |

Drie revenue-stromen actief: **no-cure-no-pay**, **abonnement**, **% van teruggehaald**.
Wat ontbreekt: meer **claim-typen** (no-cure-no-pay-volume) + meer **gratis
top-of-funnel-tools** (Plus-acquisitie).

---

## 🥇 1. Box 3-rechtsherstel check + brief-helper

### Bewezen vraag
- **Wet tegenbewijsregeling Box 3** ingegaan **19 juli 2025** (Rijksoverheid).
  Alle box-3-betalers over **2017-2027** die kunnen aantonen dat hun **werkelijke**
  rendement lager was dan het fictieve forfaitaire rendement, kunnen vermindering
  / terugvordering vragen.
- Belastingdienst stuurt **sinds juli/aug 2025** finale aanslagen 2022/2023/2024
  uit voor mensen met meer dan alleen spaargeld — al die mensen krijgen NU
  concreet een aanslag waar ze tegenin kunnen.
- **Opgaaf Werkelijk Rendement (OWR)** formulier sinds **9 juli 2025** online.
- Hoge Raad uitspraak 6 juni 2024 + 14 juni 2024: oude box-3-regeling violates
  EVRM voor spaargelders + beleggers met laag rendement → rechtsherstel is een
  recht, geen gunst.
- **Doelgroep**: massaal — alle huishoudens met box-3-vermogen boven het
  heffingsvrij vermogen (~€ 57.000 alleenstaand / € 114.000 partner per
  ~2024-2026, peilen).
- *bron: [Rijksoverheid — tijdlijn rechtsherstel box 3](https://www.rijksoverheid.nl/onderwerpen/inkomstenbelasting/box-3/tijdlijn-rechtsherstel-box-3) · [SRA — overzichtsartikel tegenbewijsregeling](https://www.sra.nl/dossiers/dossier-hoge-raad-box-3/tegenbewijsregeling-box-3-2017-2027/box-3-een-overzichtsartikel-met-de-belangrijkste-verwijzingen-werkelijk-rendement-box-3-2017-2026) · [PwC — analyse arrest + vervolgproces](https://www.pwc.nl/nl/actueel-en-publicaties/belastingnieuws/inkomen/Box-3-tegenbewijsregeling-analyse-arrest-en-vervolgproces.html)*

### Technische haalbaarheid
- Tool = **vragenlijst** (spaargeld + belegd vermogen + jaar + werkelijk rendement
  → vergelijk met fictief rendement → indicatie of bezwaar/verzoek loont) +
  **brief-/OWR-helper** (genereert tekst voor het OWR-formulier).
- **Géén DigiD nodig voor de TOOL** — alleen voor de indiening bij de
  Belastingdienst (klant doet dat zelf op MijnBelastingdienst). Wij doen de check
  + briefgeneratie.
- Bouwbaar in **2-3 dagen** (vragenlijst + rule-engine — DNA gelijk aan geld-check).

### Model-B fit + AFM
- **No-cure-no-pay % van teruggehaald geld** (zelfde stroom als vluchtclaim).
  Klant 100% aligned: krijgt hij niets terug, betaalt hij niets.
- Géén AFM (fiscaal advies valt buiten AFM-toezicht — dat is Belastingdienst/
  RB/NOB-domein). Wel **disclaimer "indicatie, geen advies"** + verwijzing naar
  belastingadviseur/RB bij complexe situaties.

### Risico's
- Concurrentie van advieskantoren + sites zoals JONGBLOED / SRA / RB-leden.
  **Onderscheidend**: consumentvriendelijk + no-cure-no-pay + simpel-online +
  transparant (i.p.v. uurtarieven).
- 2026-aanslagen rollen pas later in. Voor 2022-2024 zit er druk op — actie nu.

### Verdict
**DOEN als #1**. Hoogste revenue-potentie, hoogste topicaliteit, perfecte
model-B-fit.

---

## 🥈 2. NS Geld-Terug bij Vertraging (NL trein-claim)

### Bewezen vraag
- NS-regeling: vertraging **30-59 min = 50%** ticket terug, **≥ 60 min = 100%**
  ticket terug. Voor EU-Passenger-Rights-tickets (verordening 2021/782):
  **60-119 min = 25%**, **≥ 120 min = 50%**.
- **Minimum claim € 2,30** · **deadline 3 maanden** na reisdatum.
- Geen NL-cijfer voor "onbenut bedrag" gevonden (zou interessant zijn om te
  verzamelen via FOI-verzoek aan NS), maar logisch evident: forenzen claimen
  zelden, drempel = ergernis met formulier.
- Voorbeeld bestaande spelers: **trein-vertraging.nl** (deels geautomatiseerd) →
  bewijs dat een markt bestaat.
- *bron: [NS — what compensation does NS offer](https://www.ns.nl/en/service-and-contact/refunds/what-compensation-does-ns-offer) · [NS — voorwaarden Geld Terug bij Vertraging PDF](https://www.ns.nl/binaries/_ht_1754559989981/content/assets/ns-nl/voorwaarden/voorwaarden-toeslag-en-geld-terug-bij-vertraging-ic-direct.pdf) · [Rover — geld terug bij vertraging](https://www.rover.nl/reistips/geld-terug-bij-vertraging)*

### Technische haalbaarheid
- Pure rule-based, **EU261-pattern** (we hebben de architectuur al!).
  `nsCompensation({ ticketCents, delayMin, isAbonnement })` → indicatie.
- Vragenlijst: vertrektrein-datum + vertraging-minuten + ticketprijs +
  abonnement-type → indicatie compensatie.
- Claim zelf moet **via Mijn NS** (OV-chipkaart) of een NS-formulier (andere
  betaalwijzen). Onze rol: check + briefgeneratie + reminder bij deadline.
- Bouwbaar in **1-2 dagen** (hergebruik vluchtclaim-DNA + nieuwe constants/regels).

### Model-B fit + AFM
- Twee opties:
  - (a) **no-cure-no-pay %** van teruggehaald geld (bedragen klein, ~€ 2-15 →
    absolute fee klein → marketing-moeilijk te verkopen)
  - (b) **GRATIS check + brief + reminder** → top-of-funnel naar Plus
    ("automatische maandelijkse her-check al je treinritten")
- Aanbevolen: **(b) gratis + Plus-upsell**. Volume > marge voor deze use-case.
- Géén AFM.

### Risico's
- Bedragen per claim klein → no-cure-no-pay onaantrekkelijk als enkele stroom.
- NS controleert zelf claims; geen lange terugkijktijd (3 mnd) → tool moet
  reactief draaien (na elke reis), niet "verzamelen voor over een jaar".

### Verdict
**DOEN als #2**, **gratis + Plus-upsell-route**. Trekt forenzen massaal aan,
weinig marginale moeite (architectuur ligt klaar).

---

## 🥉 3. Zorgkostenaftrek-check (aangifte-helper)

### Bewezen vraag
- **~ 900.000 huishoudens** benutten de aftrek specifieke zorgkosten (cijfer
  2023, Eindrapport aftrek specifieke zorgkosten / Eerste Kamer).
- In 2015: **€ 22 mln voorwaartse verliescompensatie**, waarvan **€ 8 mln
  (39%)** later niet verwerkt of verrekend → ~€ 8 mln per jaar dat letterlijk
  blijft liggen, alleen bij doorgeschoven posten.
- **Drempel 2025**: 1,65% van toetsingsinkomen, **minimum € 164** per
  belastingplichtige.
- *bron: [Eindrapport aftrek specifieke zorgkosten (Eerste Kamer)](https://www.eerstekamer.nl/overig/20220915/evaluatie_aftrek_specifieke/document) · [Belastingdienst — drempelbedrag 2025](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/relatie_familie_en_gezondheid/gezondheid/aftrek_zorgkosten/hoe_berekent_u_uw_aftrek/drempelbedrag_berekenen/drempelbedrag-2025) · [Belastingdienst — overzicht zorgkosten 2025](https://www.belastingdienst.nl/wps/wcm/connect/nl/belastingaangifte/content/overzicht-zorgkosten-2025)*

### Technische haalbaarheid
- **Vragenlijst** (inkomen / partner / zorgkosten-typen + bedragen) →
  drempel berekenen → indicatie aftrekbaar bedrag + checklist veelvergeten
  posten (alternatieve geneeswijzen, fysio, hulpmiddelen, dieet op
  doktersrecept, etc.).
- Pure rule-based, **zelfde wizard-DNA als geld-check** (`lib/zorgkosten.ts`
  + reuse component-stijl).
- Bouwbaar in **1-2 dagen**.

### Model-B fit + AFM
- **Gratis** → top-of-funnel naar Plus / negotiation. Trust-builder net als
  toeslagen-check.
- Géén AFM (fiscaal).

### Risico's
- **Seizoenseffect**: aangifte-window is jan-mei → off-season minder relevant.
  Tegenargument: planning voor volgend jaar + tussentijds inzicht.

### Verdict
**DOEN als #3** — snel toe te voegen (architectuur hergebruik), versterkt de
"vind al je geld"-positionering.

---

## ⚠️ Te overwegen voor V30 (sterk, maar later)

### 4. Servicekosten-bezwaar tool (huurders)
- **Vraag**: NOS 2024 — sterke stijging zaken Huurcommissie over servicekosten,
  bezwaar vaak succesvol. Grote NL-groep huurders. Te-veel-betaalde voorschotten
  zijn restitueerbaar door verhuurder; weigert hij → Huurcommissie binnen 24 mnd.
- **Haalbaarheid**: tool = upload jaarafrekening servicekosten + huurcontract →
  rule-based check op rode vlaggen (niet-toegestane posten verrekend, geen
  specificatie, ontbrekende onderliggende facturen). Briefgenerator → verhuurder
  + escalatie-template Huurcommissie. **2-3 dagen** (parsing diverser dan een
  wizard).
- **Model B**: no-cure-no-pay % van teruggehaald geld.
- *bron: [Huurcommissie — jaarafrekening servicekosten beoordelen](https://www.huurcommissie.nl/onderwerpen/servicekosten-verhuurder/jaarafrekening-beoordelen) · [NOS — sterke stijging zaken servicekosten](https://nos.nl/artikel/2520537-sterke-stijging-aantal-zaken-over-servicekosten-bezwaar-vaak-succesvol) · [Juridisch Loket — problemen servicekosten](https://www.juridischloket.nl/wonen-en-buren/huurwoning/servicekosten/)*

### 5. Energie-factuur fouten-detectie
- **Vraag**: ACM + Consumentenbond signalleren consistent klachten over
  meterstand-fouten, te-hoge-facturen, ontbrekende heffingskortingen.
- **Haalbaarheid**: tool = upload eindafrekening → rule-based check op
  meterstand-shift, toegepaste energiebelasting-vermindering, dubbele
  heffingen, tarief vs marktgemiddelde. **2-3 dagen** want bouwt voort op
  bestaande energie-kennis.
- **Model B**: indicatie + brief-template (klant handelt zelf af, gratis,
  top-of-funnel) OF no-cure-no-pay % bij bewezen restitutie.
- *bron: [ACM — problemen met je energierekening](https://acm.nl/nl/energie/elektriciteit-en-gas/rechten-van-kleinverbruikers/problemen-met-uw-energierekening) · [Consumentenbond — meterstand klopt niet](https://www.consumentenbond.nl/energie-vergelijken/meterstand-afrekening-energie-klopt-niet)*

---

## ❌ NIET doen (eerlijke "no"-verdicts)

### Vergeten pensioenen
- **Vraag massief**: AFM-schatting **€ 2,4 miljard** aan vergeten pensioengeld,
  **450.000 vergeten potjes**, ExcellentFinance noemt **€ 350 mln** "klaar voor
  uitkering".
- **Probleem**: **mijnpensioenoverzicht.nl heeft DigiD-gate** → geen
  geautomatiseerde lookup mogelijk. Alleen "guide-only" — de gebruiker moet
  zelf inloggen. Geen claim-pakket, geen revenue-model behalve top-of-funnel.
- *bron: [Taxlive — 2,4 miljard euro aan vergeten pensioen](https://www.taxlive.nl/nl/documenten/nieuws/2-4-miljard-euro-aan-vergeten-pensioen/) · [ExcellentFinance — 350 mln vergeten pensioen](https://excellentfinance.nl/financiele-content/pensioeninformatie/vergeten-pensioenen/) · [Mijnpensioenoverzicht.nl](https://www.mijnpensioenoverzicht.nl/en)*
- **Verdict**: hooguit een **gratis checklist + reminder-pagina** als
  trust-builder ("3 stappen om je pensioenpotjes terug te vinden") — geen
  full feature.

### Slapende tegoeden (DNB / NVB Loket Slapende Tegoeden)
- **Vraag**: Consumentenbond schat **€ 300-650 mln** aan slapende
  banktegoeden in NL.
- **Probleem**: het **Loket Slapende Tegoeden** (NVB / slapendetegoeden.nl)
  werkt **alléén voor erfgenamen van overledenen**. Voor levenden moet je per
  bank navragen — geen API, geen single-window. Niche voor erfgenamen, geen
  product-flow voor de massa.
- *bron: [Loket Slapende Tegoeden (NVB)](https://www.slapendetegoeden.nl/) · [Loket Slapende Tegoeden — FAQ](https://www.slapendetegoeden.nl/veelgestelde-vragen) · [Consumentenbond schatting](https://www.bank.nl/kennisbank/slapende-tegoeden/)*
- **Verdict**: **SKIP**. Eventueel later een sub-feature "regelen-na-overlijden"
  voor erfgenamen.

### WOZ-bezwaar
- **Vraag**: bestaat, ~50% succes-ratio, no-cure-no-pay-markt al ingericht.
- **Probleem**:
  - **Markt verzadigd**: Bezwaarmaker.nl, KosteloosBezwaar.nl, Eigen Huis,
    Lansigt, ...
  - **Ethische kritiek**: no-cure-no-pay-bureaus dienen vaak "zoveel mogelijk"
    bezwaren in → kost gemeenten geld. Rijksoverheid heeft Woo-besluit
    gepubliceerd over de problematiek. Past slecht bij DeGeldHeld's "eerlijk +
    klant-aligned"-merk om hier in te stappen tussen de critici.
- *bron: [Rijksoverheid — Woo-besluit aanpak no-cure-no-pay BPM en WOZ](https://www.rijksoverheid.nl/documenten/woo-besluiten/2026/03/06/beslissing-op-bezwaar-tegen-besluit-op-woo-verzoek-aanpak-no-cure-no-pay-problematiek-bpm-en-woz) · [Weekblad Fiscaal Recht — no-cure-no-pay in WOZ en BPM: serieus probleem](https://www.inview.nl/document/idpass8cc575d0bb4d44fe8c07326d2b352c05/weekblad-fiscaal-recht-no-cure-no-pay-in-woz-en-bpm-serieus-probleem)*
- **Verdict**: **SKIP voor nu**. Eventueel later met een principieel-andere
  flow ("eerlijke check, alleen indienen als er echte gronden zijn — geen
  klacht-spam"), maar dan moeten we bewust positioneren tegen de critici.

### Hypotheek / verzekering / beleggingsadvies
- **AFM-gate** — niet aanraken zonder vergunning. Blijft de hele V29.

---

## Aanbeveling — V29-sprint scope (haalbaar voor EOW 2026-05-31)

**Lever 3 features op, gefaseerd:**

| # | Feature | Effort | Revenue-rol | Architectuur |
|---|---|---|---|---|
| 1 | **Box 3-rechtsherstel** check + brief-helper | 2-3 dagen | NCNP % van teruggehaald | nieuw `lib/box3.ts` + wizard |
| 2 | **NS Geld-Terug** check + brief + reminder | 1-2 dagen | gratis → Plus-upsell | nieuw `lib/ns.ts` + wizard, hergebruik EU261-DNA |
| 3 | **Zorgkostenaftrek** check | 1-2 dagen | gratis → top-of-funnel | nieuw `lib/zorgkosten.ts` + wizard, hergebruik geld-check-DNA |

**Totaal: ~5-7 werkdagen** — past binnen 7 kalenderdagen.

Plus **bonus** (halve dag): de `/geld-check` upgraden tot **één "vind al je
geld"-hub** met routing naar: toeslagen + box-3 + zorgkosten + vluchtclaim
+ NS. Dat is de positioneerings-versterking die alle losse tools bij elkaar
brengt.

### Volgorde-argument
1. **Box 3 eerst** — meest topicaal (juli-2025-wet rolt nu uit) + grootste
   absolute revenue per klant + nieuwe wettelijke procedure waar consumenten
   actief informatie zoeken.
2. **NS tweede** — snelste build, breedste doelgroep (alle treinreizigers),
   ideaal voor "Plus = scant elke maand je reizen automatisch"-upsell.
3. **Zorgkosten derde** — versterkt de geld-check-positionering, makkelijkste
   add (zelfde wizard-DNA), trust-builder voor jaarlijkse aangifte.

### Wat NIET in V29
- Servicekosten + energie-fouten: parkeren voor V30 (sterk maar parsing-zwaar).
- Vergeten pensioen / slapende tegoeden / WOZ: zie "❌ NIET doen".

---

## Bronnen-tabel (samengevat, peildatum 2026-05-24)

| Feature | Hoofdbronnen |
|---|---|
| Box 3 | Rijksoverheid (tijdlijn rechtsherstel) · SRA · PwC · Wet tegenbewijsregeling box 3 (Stb. 2025) |
| NS | NS Voorwaarden Geld Terug bij Vertraging · EU-PRR Verordening (EU) 2021/782 · Rover |
| Zorgkosten | Eindrapport aftrek specifieke zorgkosten (Eerste Kamer 2022) · Belastingdienst (drempel + overzicht) |
| Servicekosten | Huurcommissie · NOS (stijging zaken 2024) · Juridisch Loket |
| Energie-fouten | ACM · Consumentenbond |
| Vergeten pensioen | AFM (€ 2,4 mld) · ExcellentFinance (€ 350 mln) · mijnpensioenoverzicht.nl |
| Slapende tegoeden | NVB Loket · Consumentenbond (€ 300-650 mln schatting) |
| WOZ | Rijksoverheid Woo-besluit · Weekblad Fiscaal Recht |

---

## Vraag aan eigenaar

**Wil je deze 3 (Box 3 / NS / Zorgkosten)?** Of een andere combinatie? Bijvoorbeeld:

- **Box 3 + NS + Servicekosten** (i.p.v. zorgkosten) — als je specifiek huurders
  wilt binnenhalen (dat is een grote NL-groep). Trade-off: servicekosten is
  2-3 dagen i.p.v. 1-2, dus krappere planning.
- **Alleen Box 3 + NS** + uitwerken van de "vind al je geld"-hub als #3 — als je
  liever bouwt op wat er al staat dan een nieuw vakgebied toevoegt.

Zeg je voorkeur en ik schrijf de V29-sprint (zelfde stijl als V28) zodat
Claude Code 'm volgende keer in één run kan doen.

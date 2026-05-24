# V31 — Validation tracker (vóór marketing, week van 2026-05-25)

> **Waarom dit bestaat.** De KPN-test heeft het bewezen: een feature kan
> technisch werken (relay-mail verstuurd, 200 OK) en in de praktijk **stilte**
> opleveren (KPN antwoordde nooit). Géén euro marketing-budget tot we per
> dienst weten: (1) werkt het echt? (2) is er vraag naar?
>
> Deze week: **eerlijke validatie zonder kosten**. Vrijdag: per dienst een
> verdict — schalen / pivoten / killen. Pas dan marketing.
>
> **Discipline**: GEEN "lijkt te werken." Alleen concrete cijfers / observaties
> / quotes. Liever een painful "fail" dan een vage "misschien" — dan weten
> we het tenminste.

---

## Per-dienst validatie

### 1. Geld-check (toeslagen + gemeente)

**Hypothese:** wij geven een correctere/snellere indicatie dan de
Belastingdienst-proefberekening of Nibud.

**Test:**
- Doe de check voor **5 echte mensen** (jij, je vader, een vriend, ouder van vriend, oma): noteer per persoon de indicatie per regeling (zorgtoeslag/huurtoeslag/kindgebonden/gemeente).
- **Compare** met Belastingdienst-proefberekening (https://www.belastingdienst.nl/wps/wcm/connect/nl/toeslagen) — vul daar dezelfde gegevens in en noteer het officiële bedrag.

**Pass-criterium:**
- Indicatie ≤ **€ 30/mnd** afwijking van Belastingdienst-proefberekening voor 4/5 personen
- 5/5 personen vullen de wizard af zonder vast te lopen (vraag elke persoon: "waar haakte je af?")

**Fail-criterium:**
- Afwijking > € 30/mnd voor 2+ personen → formule of constants kloppen niet
- 2+ personen klikken weg / snappen 'm niet → UX-probleem

| Persoon | Datum | Onze indicatie | Belastingdienst-proefberekening | Afwijking | Feedback |
|---|---|---|---|---|---|
| – | – | – | – | – | – |

**Verdict (vrijdag):** _____ → actie: _____

---

### 2. Box 3-rechtsherstel check

**Hypothese:** wij kunnen iemand met box-3-vermogen vertellen of bezwaar
maken loont, met een werkelijke teruggave-indicatie die directionally klopt.

**Test:**
- Doe de check voor **2-3 mensen** met box-3-vermogen (vader? oom? bekende belegger?). Reëel: spaargeld + beleggingen jaartal 2022 of 2023.
- **Compare** met:
  - (a) Indicatie van een belastingadviseurs-site (jongbloed-fiscaaljuristen.nl heeft voorbeeld-cases) OF
  - (b) Vraag de testpersoon: "klinkt deze schatting redelijk?"

**Pass-criterium:**
- Verwachte teruggave ligt directionally (factor 2) in lijn met wat adviseur-cases of testpersoon-intuïtie zegt
- De HARDE €500-gate werkt: indicatie < €500 → krijgt "doe het zelf"-pad, geen NCNP-aanbod

**Fail-criterium:**
- Indicatie systematisch te hoog/laag (factor 5+ af) → formule of forfait fout
- Drempel-gate triggert niet correct (test: input dat €100 verwachte teruggave oplevert → MOET DIY-pad krijgen, NIET NCNP)

| Persoon | Datum | Vermogen-type | Indicatie | Sanity-check | Verdict |
|---|---|---|---|---|---|
| – | – | – | – | – | – |

**Verdict (vrijdag):** _____ → actie: _____

---

### 3. NCNP onderhandeling — **DE KPN-TEST**

**Hypothese:** onze relay-onderhandel-mail krijgt antwoord + aanbod van
NL-providers. KPN-stilte was incident, niet patroon.

**Test:** stuur relay-mail naar **5 verschillende providers**, verschillende
categorieën, allemaal zelfde maandag. Wacht 7 dagen.

| Provider | Categorie | Verzonden | Antwoord (na 7d)? | Aanbod? | Hoeveel? |
|---|---|---|---|---|---|
| Eneco | energie | – | – | – | – |
| Vattenfall | energie | – | – | – | – |
| T-Mobile | telecom | – | – | – | – |
| VodafoneZiggo | internet | – | – | – | – |
| NRC of FD | krant | – | – | – | – |

**Pass-criterium:**
- ≥ **3/5 antwoorden** binnen 7 dagen
- ≥ **1/5 biedt iets aan** (verlaging / bonus / verlengd contract met korting)

**Fail-criterium:**
- < 2/5 antwoorden → relay-mail-onderhandeling is een fail-pattern, net als KPN
- **Honest verdict bij fail:** alle TYPE-A-categorieën moeten naar belscript-pattern (zoals telecom in V30). Stream 1a (energie/krant NCNP via mail) is dood. Reframen.

**Verdict (vrijdag):** _____ → actie: _____

---

### 4. NS Geld-Terug

**Hypothese:** onze NS-check geeft het exacte bedrag dat NS daadwerkelijk
uitkeert via Mijn NS.

**Test:** volgende NS-vertraging (≥ 30 min): doe de check, dien claim in via
Mijn NS, vergelijk uitgekeerd bedrag.

**Pass-criterium:** onze indicatie matcht het door NS uitgekeerde bedrag tot
op €1 nauwkeurig.

**Fail-criterium:** afwijking > €5 → regel-engine of abonnement-handling fout.

| Datum reis | Vertraging (min) | Onze indicatie | NS-uitkering | Match? |
|---|---|---|---|---|
| – | – | – | – | – |

**Verdict (vrijdag):** _____ → actie (waarschijnlijk: nog te weinig cases, herhaal volgende week) → _____

---

### 5. Zorgkostenaftrek check

**Hypothese:** drempel-formule + checklist matcht met wat de
Belastingdienst-aangifte 2024 berekende.

**Test:**
- Doe de check voor je eigen of vader's 2024-aangifte: input toetsingsinkomen
  + zorgkosten per categorie → vergelijk met aftrek uit aangifte 2024.

**Pass-criterium:** aftrek-bedrag ± **€ 50** van aangifte-bedrag.

**Fail-criterium:** structureel hoger/lager → drempel-formule of categorieën fout.

| Persoon | Aangifte-jaar | Onze aftrek | Werkelijke aftrek | Match? |
|---|---|---|---|---|
| – | – | – | – | – |

**Verdict (vrijdag):** _____ → actie: _____

---

### 6. Vluchtclaim EU261 + Plus-cron + Plus-abonnement

**Niet te valideren deze week.** Wachten op:
- Aviation Edge API + jurist (vluchtclaim)
- KvK/KYC + eerste echte Plus-users (Plus)

Status: parkeren, niet uitstellen in volgende validation-rondes.

---

## Vraag-validatie — 20 gesprekken

**Doel:** ontdekken of de vraag *echt latent* is in jouw netwerk, of dat
mensen al een oplossing hebben (concurrent), of dat ze er niet om geven.

**De enige vraag:**
> *"Wat doe jij nu om te checken of je toeslagen / vaste lasten /
> belastingteruggave misloopt?"*

**Wat NIET zeggen:**
- ❌ "Ik bouw een app die..." (geen pitch, je gaat luisteren)
- ❌ "Vind je dit een goed idee?" (mensen liegen om aardig te zijn)
- ❌ "Zou je dit gebruiken?" (hypothetisch ≠ koop-intent)

**Wat WEL doorvragen:**
- ✅ "Hoe lang geleden voor het laatst?"
- ✅ "Wat hield je tegen om het wel te doen?"
- ✅ "Wat zou het makkelijker maken?"

**Tracker:**

| # | Persoon (initialen) | Datum | Antwoord-patroon | Quote (1 zin) |
|---|---|---|---|---|
| 1 | – | – | niets / accountant / [tool X] / ooit geprobeerd / geen idee | – |
| ... | | | | |
| 20 | | | | |

**Patronen om naar te tellen op vrijdag:**
- N × "**niks, denk er niet aan**" → latente vraag, marketing moet wekken
- N × "**ik heb [accountant/Dyme/Bezwaarmaker]**" → concurrent, vraag waarom + wat missen ze
- N × "**ik gebruik [Belastingdienst-proefberekening / Mijn NS]**" → bestaande gratis tools, wij moeten beter zijn
- N × "**ooit geprobeerd, [reden]**" → goud, dat is je pijnpunt
- N × "**geen idee, kan dat?**" → bevestigt latente markt

---

## Lokaal-werkt-het-check (deze zondag, 30 min)

Dev-server draait al (`Ready in 1672ms` ✓). Klik door alle 6 checks **als
eindgebruiker** met de flags AAN:

```bash
FEATURE_GELD_CHECK_ENABLED=true FEATURE_BOX3_CHECK_ENABLED=true \
FEATURE_NS_CHECK_ENABLED=true FEATURE_ZORGKOSTEN_CHECK_ENABLED=true \
FEATURE_MONEYFINDER_HUB_ENABLED=true FEATURE_CLAIMS=true \
npm run dev
```

| Check | URL | Werkt zonder vastlopen? | Klopt de output? | Friction (1-10) |
|---|---|---|---|---|
| Geld-check | `/geld-check` | – | – | – |
| Box 3 | `/box3-check` | – | – | – |
| Box 3 NCNP-pad | `/box3-check` → NCNP-knop | – | – | – |
| NS | `/ns-check` | – | – | – |
| Zorgkosten | `/zorgkosten-check` | – | – | – |
| Vluchtclaim (zonder API) | `/vluchtclaim` | – | – | – |
| Spookabonnementen | `/spookabonnementen` | – | – | – |
| Hub | `/vind-al-je-geld` | – | – | – |

Friction-score: 1 = naadloos, 10 = breekt af. Boven 5 = UX-fix nodig vóór live.

---

## Vrijdag-verdict-template (2026-05-29)

Vrijdagavond: 30 minuten. Vul in:

```
WEEK VAN 2026-05-25 — VALIDATION-VERDICT

WERKT TECHNISCH + KLOPT OUTPUT:
- [dienst]: pass / fail / inconclusief — reden
- ...

KPN-TEST (5 providers):
- Antwoord-ratio: X/5
- Aanbod-ratio: X/5
- Verdict: relay-mail-onderhandeling [werkt / faalt / mixed]
- Actie indien faalt: alle TYPE-A naar belscript-pattern reframen (V32)

VRAAG-VALIDATIE (20 gesprekken):
- Dominante patroon: [latent / concurrent / actief-gebruikt / desinteresse]
- Belangrijkste pijnpunt (quote): "..."
- Doelgroep die het meest pijn heeft: ...

GO / NO-GO PER STREAM (eerlijke verdicten):
- Stream 1a (energie/krant NCNP via mail): GO / NO-GO / PIVOT-NAAR-BELSCRIPT
- Stream 1b (telecom belscript via Plus): GO / NO-GO
- Stream 2 (Box 3 NCNP): GO / NO-GO / WACHT-OP-OWR-CASES
- Stream 3 (Plus abonnement): GO / NO-GO (afhankelijk van KvK/KYC)
- Stream 4 (gratis checks → top-of-funnel): GO / NO-GO

VOLGENDE WEEK FOCUS:
[Op basis van verdicten: marketing voor wat werkt, herwerk voor wat niet]
```

---

## Beslis-tabel: wat te doen bij elke uitkomst

| Uitkomst | Actie |
|---|---|
| Alles pass + vraag-latent | **Marketing-week** (SEO + content + TikTok + PR) |
| Alles pass + vraag-bevredigd-door-concurrent | **Differentiatie-week** — waarom zou iemand wisselen van Dyme/Bezwaarmaker naar ons? |
| KPN-test faalt (mail-onderhandeling dood) | **V32: reframe alles naar belscript + DIY-helper.** Marketing pas daarna. |
| Eén check faalt op accuracy | **Fix die check + retest** voor de andere checks marketing krijgen |
| Vraag-validatie: 15/20 desinteresse | **Hard verdict**: pivot naar specifieke niche (welke 5 zeiden "geen idee, kan dat?" → wie zijn dat, wat hebben ze gemeen) |

---

## Wat dit doc NIET is

- ❌ Geen sprint-script — geen build-instructies aan Claude Code
- ❌ Geen vapor-belofte — alleen concrete metrics, geen "vibes"
- ❌ Geen excuus — als alles faalt, faalt het. Eerlijk verdict > vage hoop.

## Wat dit doc WEL is

- ✅ Een **dwingende structuur** om bullshit te voorkomen
- ✅ Een **leesbaar geheugen** voor over een maand ("hadden we dit getest? wat was de uitkomst?")
- ✅ Een **beslis-instrument**: vrijdag weet je per dienst wat de volgende stap is, zonder discussie
- ✅ Een **investor/jurist-document**: bewijs van due diligence op product-market-fit

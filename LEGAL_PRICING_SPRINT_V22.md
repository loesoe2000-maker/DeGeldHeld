# DeGeldHeld v22 — Legal Compliance + Real Provider Prices

**Twee dingen in één grote sprint:** (A) alle juridische compliance op orde
+ hypotheek & verzekering uitschakelen (haalt AFM-vergunningrisico weg), en
(B) échte, gesourcete markt-prijzen voor alle overige categorieën.

**Volgorde:** v19 (auto-fee) is NIET vereist en is nog niet gedraaid — v22
hangt er niet van af en kan standalone nu. Draai v22 en v19 nooit *tegelijk*
(beide raken `app/onderhandel/analyse/page.tsx`); na elke sprint `npm run build`.

**Scope — alleen NL-markt.** Dit script vult prijzen voor **Nederlandse**
aanbieders. Buitenlandse providers worden wél door OCR herkend, maar de
markt-vergelijking is NL-only (v18: niet-NL facturen tonen een "indicatief"-
melding). Buitenlandse prijzen vallen BUITEN scope — dat is een latere
expansie-sprint per land (met eigen prijzen + lokale wetgeving). Verzin hier
geen buitenlandse prijzen.

## ⚠️ GUARDRAILS — lees eerst, hier zijn we streng (geen debug-nacht meer)

1. **`npm run build` is VERPLICHT vóór élke commit** (EXIT 0). `tsc` + vitest
   vangen NIET het Next.js route-export-contract; alleen de echte build wel.
   Een gebroken build vrijst productie 12u vast — dat gebeurt niet weer.
2. **GÉÉN gehallucineerde prijzen.** Een prijs komt er alleen in als 'm deze
   run via WebFetch uit een **officiële/provider-bron** is gehaald, mét de
   bron-URL in een comment. Kun je 'm niet verifiëren → laat 'm WEG of `null`.
   NOOIT gokken. Een ontbrekende prijs is oké; een verzonnen prijs niet.
3. **Niet de category-enum of lib-modules verwijderen** — alleen *gaten* in de
   UI/vergelijking. Verwijderen breekt imports/tests. Gate, niet delete.
4. **Na hyp/verz-gating: volledige `npm test` + build** om breakage te vangen.
5. **Juridische docs = CONCEPT.** Markeer elk document met "concept — laat door
   een jurist/DPO controleren". Geen claim dat dit juridisch advies is.
6. Migraties: datum-prefix + `prisma migrate deploy` + `prisma generate`.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/LEGAL_PRICING_SPRINT_V22.md en voer alle deeltaken in volgorde uit. Houd je STRIKT aan de GUARDRAILS, vooral: npm run build (EXIT 0) vóór elke commit, en NOOIT een prijs verzinnen — alleen gesourcete prijzen via WebFetch, anders weglaten. Per deeltaak: implementeer, dan npm test + npx tsc --noEmit + npm run build, bij fail fix tot groen, commit + push. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 30 min: TODO-commit en door. Eindig met V22_REPORT.md inclusief prijs-dekking per categorie (met bronnen) + een EIGENAAR-actielijst (DPA's tekenen, jurist-review).
```

---

## DEEL 1 — Hypotheek & verzekering uitschakelen (AFM-risico weg)

Reden: dit zijn Wft-producten; adviseren/bemiddelen vereist een AFM-vergunning
die we (nog) niet hebben. We bieden ze daarom niet aan tot dat geregeld is.

a. `lib/market-coverage.ts`: markeer `HYPOTHEEK` en `VERZEKERING` als
   **niet-ondersteund** voor alle landen. Eén bron van waarheid voor "doen we".

b. `app/onderhandel/analyse/page.tsx`: als `bill.category` (of primary) ∈
   {HYPOTHEEK, VERZEKERING}: toon GEEN vergelijking/besparing en GEEN
   onderhandel-mail-CTA. In plaats daarvan een nette melding:
   "We richten ons op telecom, energie, water en abonnementen. Hypotheek en
   verzekering ondersteunen we (nog) niet." + link terug. Verwijder de
   bestaande VERZEKERING- en HYPOTHEEK-render-blokken op die pagina.

c. Upload/OCR: blijf de categorie detecteren, maar als 'ie hyp/verz is →
   route naar bovenstaande "niet ondersteund"-staat (geen negotiation aanmaken).

d. Dashboard: verwijder de hypotheek- en verzekering-tegels uit
   `CategoryUploadGrid` (geen upload-CTA voor die categorieën).

e. Behoud `lib/categories/hypotheek.ts` + `verzekering.ts` en de enum-waarden
   (niet verwijderen — voorkomt dangling imports). Markeer ze met een comment
   "INACTIVE — gated in v22, niet aangeboden tot AFM-vergunning". Pas tests aan
   die ervan uitgingen dat die categorieën in de UI verschijnen.

f. `npm test` + `npx tsc --noEmit` + `npm run build` groen.

g. Commit: `feat(compliance): gate hypotheek + verzekering (AFM licence risk)`.

---

## DEEL 2 — Privacy / AVG-documenten

Sub-processors (stack): **Vercel** (hosting), **Neon** (database), **Resend**
(e-mail), **Groq** (AI/OCR), **Stripe** (betalingen), **Cloudflare** (DNS/CDN/
Turnstile), **Sentry** (foutmonitoring). MailerLite staat los (marketing).

a. **`/privacy` (privacyverklaring)** — herschrijf compleet + correct:
   - Welke persoonsgegevens (factuurdata, e-mail, betaalgegevens), met welk
     doel, op welke **grondslag** (uitvoering overeenkomst / toestemming).
   - **Alle 7 sub-processors** met naam + verwerkingsdoel + (EU/VS-)locatie.
   - Bewaartermijnen (incl. anonieme bills: cleanup-cron). Rechten van
     betrokkenen (inzage, verwijdering, export — verwijst naar /account).
   - Contact + (indien van toepassing) FG/DPO.

b. **`docs/VERWERKINGSREGISTER.md`** — feitelijk register (art. 30 AVG):
   per verwerking: categorie persoonsgegevens, doel, grondslag, ontvangers
   (sub-processors), bewaartermijn, beveiligingsmaatregelen. Leid dit af uit
   de échte codebase (schema + sub-processors), niet uit een template.

c. **`docs/VERWERKERSOVEREENKOMSTEN.md`** — overzicht per sub-processor:
   naam, wat ze verwerken, link naar hún standaard-DPA, status
   "☐ te tekenen door eigenaar". Code kan geen DPA tekenen — dit is de
   checklist voor de eigenaar.

d. **`docs/DATALEK_PROTOCOL.md`** — procedure: detectie (Sentry) → beoordeling
   → melden bij AP binnen 72u indien risico → betrokkenen informeren → log.

e. Markeer elk juridisch document met "**concept — laat door jurist/DPO
   controleren**".

f. Commit: `feat(privacy): full privacyverklaring + verwerkingsregister + DPA-lijst + datalek-protocol`.

---

## DEEL 3 — Voorwaarden + in-app disclaimers

a. **`/voorwaarden`** — herschrijf/aanvul:
   - "**Geen financieel advies**": DeGeldHeld helpt je bestaande contracten
     onderhandelen/vergelijken; geen advies in de zin van de Wft. Hypotheek/
     verzekering worden niet aangeboden.
   - **No-cure-no-pay fee** (20% van bewezen jaarbesparing, cap €500, min €2,
     drempel €25) + mandaat-tekst voor de off-session afschrijving (sluit aan
     op v19) + opzegrecht.
   - Geen garantie op besparing. Nederlands recht, NL-jurisdictie.
b. **In-app disclaimer** op de analyse-pagina (subtiel): "DeGeldHeld helpt je
   je huidige contract te onderhandelen — dit is geen financieel advies."
c. **Footer**: links naar /privacy + /voorwaarden op élke pagina (verifieer in
   de layout; voeg toe waar ze ontbreken).
d. Commit: `feat(legal): terms (no financial advice) + fee mandate + footer links`.

---

## DEEL 4 — Prijs-fundering (één gedateerde, gesourcete bron)

a. `lib/market-prices.ts` is DE bron. Voeg een getypte structuur toe voor
   plan-prijzen mét verplichte bron:
   ```ts
   export type MarketPlan = {
     provider: string;
     category: Category;       // alleen ondersteunde categorieën
     plan: string;             // tarief-/pakketnaam zoals afgedrukt
     priceCents: number;       // maandprijs in cents
     source: string;           // URL waar deze prijs vandaan komt (VERPLICHT)
     verifiedAt: string;       // ISO-datum van fetch
   };
   export const MARKET_PLANS: MarketPlan[] = [ /* DEEL 5 */ ];
   ```
   `source` verplicht in het type → een prijs zónder bron compileert niet.
b. Bump `PRICES_AS_OF` naar de run-datum.
c. Commit: `refactor(prices): sourced MarketPlan type — every price needs a URL`.

---

## DEEL 5 — Échte prijzen per categorie (research, NUL hallucinatie)

Voor elke categorie hieronder: WebFetch de **officiële/provider-pagina's** van
de **grote NL-aanbieders** + hun **hoofd-pakketten/tarieven**. Vul `MARKET_PLANS`
(of de medians) met de gevonden prijzen, elk met `source`-URL + `verifiedAt`.
**Niet kunnen verifiëren = weglaten.** Prioriteer de aanbieders die de meeste
NL-consumenten daadwerkelijk hebben (volledigheid < juistheid).

a. **TELECOM (mobiel + internet)**: KPN, Vodafone, Odido, Ziggo, Youfone,
   Simyo, Lebara, hollandsnieuwe, Ben, Tele2 — hoofd-SIM-only + internet/TV-pakketten.
b. **ENERGIE**: vervang de medians door de actuele ACM/markt-cijfers
   (mei 2026: stroom ~€0,23–0,30/kWh incl. btw, gas ~€1,28–1,58/m³ incl. btw).
   Source: ACM-tariefoverzicht / energievergelijkers. Date het.
c. **WATER**: per regionaal drinkwaterbedrijf (Vitens, PWN, Brabant Water,
   Evides, Dunea, Waternet, WML, Oasen, Waterbedrijf Groningen, WMD) het
   m³-tarief + vastrecht van hun officiële tarievenpagina.
d. **STREAMING**: Netflix, Disney+, Videoland, HBO Max/Max, Spotify, Apple
   Music, Amazon Prime, Viaplay — alle tier-prijzen (staan publiek vermeld).
e. **GYM**: Basic-Fit, SportCity, Fit For Free, TrainMore, Anytime Fitness —
   abonnementsprijzen.
f. **OV / SOFTWARE / OPSLAG / BANK / OVERIG**: alleen waar betrouwbaar
   publiek geprijsd (bv. NS-abonnementen, iCloud/Google One/Dropbox,
   bankpakket-maandkosten). Geen gok.
g. Per categorie een eigen commit:
   `feat(prices): real <CATEGORIE> plans sourced <datum>`.

> Zet bovenaan `MARKET_PLANS` een comment met de refresh-procedure +
> de bron-categorieën, zodat een maandelijkse update navolgbaar is.

---

## DEEL 6 — Prijzen doorvoeren + verifiëren

a. `lib/comparison.ts` (`getMarketRange`/`buildComparison`) gebruikt
   `MARKET_PLANS` voor de ondersteunde categorieën → echte markt-range +
   percentiel op de analyse-pagina.
b. Energie/water blijven tarief-gebaseerd (medians) — verifieer dat de
   analyse die toont met de nieuwe cijfers.
c. Staleness-voetnoot toont `PRICES_AS_OF`.
d. Tests: `getMarketRange` met de echte data geeft plausibele ranges; gated
   categorieën (hyp/verz) geven geen vergelijking.
e. Commit: `feat(analyse): wire real sourced prices into comparison`.

---

## DEEL 7 — Aggregate + rapport

a. `npm test -- --run` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** +
   `npx playwright test tests/e2e/`. Alles groen.
b. `V22_REPORT.md`:
   - **Compliance**: wat gated is (hyp/verz), welke juridische docs gemaakt zijn
     (elk met "jurist-review nodig").
   - **Prijzen**: per categorie hoeveel plannen/bronnen toegevoegd + de
     bron-URLs + `PRICES_AS_OF`. Expliciet: welke categorieën weinig/geen
     verifieerbare data hadden.
   - **EIGENAAR-actielijst**:
     1. DPA's tekenen bij elke sub-processor (lijst uit
        `docs/VERWERKERSOVEREENKOMSTEN.md`)
     2. Privacyverklaring + voorwaarden door jurist laten checken
     3. Markt-prijzen maandelijks verversen (RUNBOOK-procedure)
c. Commit: `docs(v22): legal compliance + sourced prices verified`.

---

## Done-criteria

- [ ] Hypotheek + verzekering gated — geen vergelijking/mail, nette melding,
      tegels weg, build + tests groen
- [ ] Privacyverklaring compleet (7 sub-processors) + verwerkingsregister +
      DPA-lijst + datalek-protocol (alle als concept gemarkeerd)
- [ ] Voorwaarden: geen-financieel-advies + fee/mandaat + footer-links overal
- [ ] `MarketPlan`-type met **verplichte bron** per prijs
- [ ] Échte gesourcete prijzen per ondersteunde categorie (geen gok), gedateerd
- [ ] Analyse toont echte markt-ranges voor ondersteunde categorieën
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] V22_REPORT.md met prijs-dekking (bronnen) + eigenaar-actielijst

## Eindrapportage

```
LEGAL_PRICING_V22 — Final report

DEEL 1  ✓ <hash> — hyp/verz gated (AFM-risico weg)
DEEL 2  ✓ <hash> — privacyverklaring + register + DPA-lijst + datalek
DEEL 3  ✓ <hash> — voorwaarden + disclaimers + footer
DEEL 4  ✓ <hash> — MarketPlan-type met verplichte bron
DEEL 5  ✓ <hash..> — echte prijzen per categorie (gesourcet)
DEEL 6  ✓ <hash> — prijzen doorgevoerd in vergelijking
DEEL 7  ✓ <hash> — build groen + rapport + eigenaar-actielijst
```

**Na deze sprint: juridisch verdedigbaar (hyp/verz uit, AVG-docs klaar voor
jurist), en élke besparing rust op een échte, gedateerde, gesourcete prijs —
geen placeholder, geen gok.**

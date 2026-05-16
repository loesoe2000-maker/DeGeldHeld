# DeGeldHeld v5 — multi-round + outcome tracking + wereldwijde provider + alle vaste lasten

Eén grote sprint, 8 deelfasen, commit per fase zodat niets verloren gaat bij crash.
Plak alleen de regel onder "## START" in Claude Code (vanuit
`/Users/bdb/alpharadar-pro/degeldheld/`). Claude Code leest dan dit bestand en
werkt de fasen af.

Geschatte duur: 5–8 uur. Dit is groot. Het is het waard.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/GLOBAL_EXPANSION_SPRINT.md en voer alle acht deeltaken uit in volgorde, met commit + push per deeltaak.
```

---

## Hoofdregels voor de hele sprint

- Werk de stappen 1 → 8 in volgorde. Niet skippen.
- Elke deeltaak eindigt met: `npx tsc --noEmit` groen voor nieuwe code,
  `npm test -- --run` groen voor nieuwe tests (pre-bestaande errors mogen blijven),
  `git add` van de gewijzigde files, een conventional commit, `git push`.
- Vermeld in elke commit: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Geen `--no-verify`, geen `--force push`.
- Bij fail: fix de échte oorzaak, niet de test softer maken.
- Schema-wijzigingen: **altijd** migratie genereren + `prisma migrate deploy` runnen
  zodat productie-DB up-to-date blijft.
- Bij twijfel over externe data (retentie-mailadressen, provider-info): gebruik
  WebFetch + Groq om te verifiëren. NIET verzinnen.

---

## DEEL 1 — Multi-round onderhandeling (state machine + UI)

**Doel:** na de eerste mail kan de user het antwoord van de provider plakken en
krijgt een counter-mail. Max 3 rondes. Dit is wáár 80% van de besparing zit.

a. Prisma migratie `negotiation_rounds`:
   ```prisma
   model NegotiationRound {
     id              String       @id @default(cuid())
     negotiationId   String
     roundNumber     Int          // 1, 2, 3
     providerResponse String?     @db.Text   // wat provider terugschreef
     responseOcrText String?      @db.Text   // als user screenshot upload
     analysisJson    String?      @db.Text   // AI analyse: bieden ze? hoeveel? voldoende?
     offeredCents    Int?         // bedrag dat provider biedt (uit analysis)
     counterSubject  String?
     counterBody     String?      @db.Text
     outcome         RoundOutcome @default(PENDING)
     createdAt       DateTime     @default(now())
     negotiation     Negotiation  @relation(fields: [negotiationId], references: [id], onDelete: Cascade)
     @@unique([negotiationId, roundNumber])
   }
   enum RoundOutcome { PENDING ACCEPTED REJECTED ESCALATED }
   ```
   Voeg toe aan `Negotiation`: `rounds NegotiationRound[]` + state-uitbreiding:
   `EMAIL_SENT, RESPONSE_RECEIVED, COUNTER_SENT, ACCEPTED, REJECTED`.

b. Run `npx prisma migrate dev --name negotiation_rounds` lokaal, dan
   `npx prisma migrate deploy` tegen productie.

c. Nieuwe route `/app/onderhandel/[billId]/ronde/[n]/page.tsx`:
   - Server-component, vereist auth, valideert dat user owner is.
   - Form met: textarea voor geplakte response OF file-upload voor screenshot.
   - POST naar nieuwe `/api/negotiations/round/route.ts` die:
     1. OCR'd screenshot indien aanwezig (gebruik bestaande extractBill, alleen
        ruwe tekst nodig).
     2. Stuurt response naar Groq llama-3.3 met systeem-prompt:
        "Je analyseert een antwoord van een provider op een onderhandel-mail.
         Extracteer: biedt de provider iets (true/false), nieuw bedrag in EUR,
         korting-percentage, tone (constructief|afwijzend|stalling), aanbevolen
         actie (accept|counter|escalate|walk_away). JSON output."
     3. Als advies = counter: genereer counter-mail via bestaande generateEmail
        met aangepaste prompt-context "ronde {n}, vorige aanbod was X".
     4. Sla NegotiationRound op.

d. UI op `/onderhandel/[billId]/ronde/[n]`:
   - Sectie "Antwoord van provider" (kopie van wat user plakte).
   - Sectie "Onze analyse" (chips: biedt €X / korting Y% / tone / advies).
   - Sectie "Counter-mail" (subject + body, kopieer-knop, WhatsApp-share).
   - Knoppen onderaan: "Akkoord, deal gesloten" | "Verstuur counter" | "Stop hier".

e. Tests:
   - `tests/round-analysis.test.ts`: 3 mock-responses (constructief €22, stalling,
     afwijzend) → verwacht juiste action + offeredCents.
   - `tests/round-counter.test.ts`: counter-mail bevat het vorige aanbod expliciet.

f. Commit: `feat(rounds): multi-round negotiation with response analysis`.

---

## DEEL 2 — Outcome tracking + reminder cron + /proof voeden

**Doel:** 7 dagen na mail-versturen automatisch vragen "wat was de uitkomst?".
Verzamel die data → `/proof` toont echte cijfers → social proof voor nieuwe users.

a. Prisma op `Negotiation`: voeg `emailSentAt DateTime?` en
   `outcomeAskedAt DateTime?` toe. Migratie `negotiation_followup`.

b. `/api/negotiations/[id]/sent/route.ts` POST: markeert emailSentAt = now().
   Frontend: op "Kopieer onderwerp+bericht" knop (in email/page.tsx) ook een
   fetch naar dit endpoint zodat we weten dat de mail is verstuurd.

c. `/api/cron/outcome-followup/route.ts` (GET):
   - Selecteer alle Negotiations waar emailSentAt >= 7 dagen geleden EN
     outcomeAskedAt IS NULL EN state IN (EMAIL_GEN, COUNTER_SENT).
   - Voor elk: Resend mail naar user met onderwerp "Hoe ging de onderhandeling
     bij {provider}?" en knop-link naar `/onderhandel/{billId}/uitkomst?token={hmac}`.
   - Set outcomeAskedAt = now().
   - Limiteer 50/dag (Resend free quota).
   - Vereist `CRON_SECRET` header check.

d. `/app/onderhandel/[billId]/uitkomst/page.tsx`:
   - 3 grote knoppen: ✓ Geslaagd / ⏳ Nog wachten / ✗ Geweigerd.
   - Bij geslaagd: vraag nieuwe maandbedrag, sla `actualSavingsCents` op
     (= verschil currentMonthlyCents en nieuwe), state = SUCCESS.
   - Bij wachten: state blijft, herinner over 7 dagen.
   - Bij geweigerd: state = FAILED.
   - Toon "Dank! Je bijdrage staat nu in onze Track Record".

e. Update `vercel.json` crons:
   ```json
   { "path": "/api/cron/outcome-followup", "schedule": "0 8 * * *" }
   ```
   (08:00 elke dag).

f. Aggregaten in `/api/proof/route.ts` en `/app/proof/page.tsx`: zorg dat
   `totalSavedCents` nu echt uit `actualSavingsCents` SOM komt (was deels uit
   `expectedSavingsCents`). Toggle in UI: "verwacht" vs "behaald".

g. Tests:
   - `tests/cron-followup.test.ts`: mock prisma met 3 negotiations, verifieer
     correcte selectie (alleen 7+ dagen, niet al gevraagd).
   - `tests/outcome-page.test.tsx`: 3 knoppen renderen, success-pad slaat
     actualSavingsCents op.

h. Commit: `feat(outcome): 7-day followup cron + outcome capture flow`.

---

## DEEL 3 — Globale provider registry (NL → EU → wereld)

**Doel:** OCR herkent nu primair NL-providers. Breid uit naar EU + UK + US + DACH
+ FR + ES + IT zodat de app werkt voor elke Westerse consument.

a. Refactor `lib/providers.ts` naar een **schaalbare structuur**:
   ```ts
   export type Provider = {
     id: string;              // canonical slug
     names: string[];         // alle bekende varianten (NL/EN/lokaal)
     category: Category;
     country: "NL" | "BE" | "DE" | "FR" | "UK" | "US" | "ES" | "IT" | "INT";
     network?: string;        // MVNO underlying network
     retention?: {
       email?: string;
       phone?: string;
       whatsapp?: string;
       url?: string;
       hours?: string;        // bv "ma-vr 9-18"
     };
     locale: "nl" | "en" | "de" | "fr" | "es" | "it";
   };
   ```

b. Vul `lib/providers.ts` met de top providers per land. Gebruik **WebFetch**
   om elke retention-email/phone te verifiëren — verzin niets. Per land minstens:
   - **NL**: top 30 (telecom 10, energie 8, verzekering 6, bank 4, streaming 5, abonnement 5)
   - **BE**: top 20 (Proximus, Orange, Telenet, Engie, Luminus, AXA, KBC, ING, etc.)
   - **DE**: top 25 (Telekom, Vodafone DE, O2, 1&1, EON, RWE, Allianz, HUK, DKB, etc.)
   - **FR**: top 20 (Orange, SFR, Bouygues, Free, EDF, Engie, Crédit Agricole, etc.)
   - **UK**: top 25 (BT, Sky, Virgin, EE, Vodafone UK, British Gas, Octopus,
     Aviva, HSBC, etc.)
   - **US**: top 30 (Verizon, AT&T, T-Mobile, Comcast, Spectrum, ConEd, GEICO,
     State Farm, Chase, BoA, etc.)
   - **ES**: top 15 (Movistar, Orange ES, Vodafone ES, Iberdrola, BBVA, etc.)
   - **IT**: top 15 (TIM, Vodafone IT, WindTre, Iliad, Enel, Intesa, etc.)

c. `findProvider(name: string)`: fuzzy match (lowercase, strip leestekens,
   Levenshtein <= 2) over ALLE `names` arrays. Return null als geen match.
   Voeg `findProviderByCountry(name, country)` toe voor disambiguatie.

d. **Belangrijk**: hardcoded prijslijsten worden onbeheersbaar. Voor non-NL
   landen: GEEN seed met plannen. In plaats daarvan: bij OCR detecteer country
   uit provider, en de "alternatieven"-sectie haalt **dynamisch** een markt-range
   uit Groq via prompt: "Wat zijn 3 goedkopere alternatieven voor {provider}
   {category} {planName} in {country}? Antwoord in JSON." Cache 7 dagen op
   `(provider, category, plan)`.

e. OCR system prompt aanpassen: ook `country` extraheren (auto-detect uit valuta,
   adres, taal). Schema `Bill.country` toevoegen.

f. Tests:
   - `tests/provider-fuzzy.test.ts`: 20 fuzzy inputs over alle landen.
   - `tests/dynamic-alternatives.test.ts`: mock Groq, verifieer caching + JSON
     parse + fallback bij timeout.

g. Commit: `feat(providers): global registry 200+ providers + dynamic alternatives`.

---

## DEEL 4 — Alle vaste lasten (categorie-uitbreiding)

**Doel:** niet alleen telecom. Energie, verzekering, hypotheek, bank, water,
gemeente, OV, gym, streaming, software-abonnementen.

a. Uitbreiding `enum Category` in `prisma/schema.prisma`:
   ```
   TELECOM ENERGIE WATER GEMEENTE VERZEKERING HYPOTHEEK BANK
   ABONNEMENT STREAMING GYM OV SOFTWARE OPSLAG OVERIG
   ```
   Migratie `category_expansion`.

b. `lib/categories.ts` (nieuw bestand):
   ```ts
   export type CategoryRules = {
     id: Category;
     label: string;          // "Energie"
     icon: string;           // emoji of svg-id
     comparisonUnit: "monthly_eur" | "per_kwh" | "per_m3" | "per_year" | "interest_pct";
     negotiationPlaybook: string;   // categorie-specifieke prompt-context
     typicalSavingPct: number;      // ~realistisch besparing % voor /proof verwachting
     retentionLeverage: string;     // wat werkt: switch-claim, jaarbetaling, etc.
   };
   ```
   Voor elke categorie zo'n object met realistic data:
   - TELECOM: comparisonUnit=monthly_eur, savings 15-30%, leverage=SWITCH_CLAIM
   - ENERGIE: comparisonUnit=per_kwh, savings 10-25%, leverage=TARIEF_VAST_VS_VAR
   - VERZEKERING: comparisonUnit=per_year, savings 20-40%, leverage=DEKKING_DOWNGRADE
   - HYPOTHEEK: comparisonUnit=interest_pct, savings = rente-shift, leverage=OVERSLUITEN_DREIG
   - BANK: comparisonUnit=monthly_eur, savings 5-15%, leverage=FEES_WAIVE
   - STREAMING: comparisonUnit=monthly_eur, savings 0-10%, leverage=DOWNGRADE_TIER
   - GYM: comparisonUnit=monthly_eur, savings 10-20%, leverage=ANNUAL_PREPAY
   - SOFTWARE: comparisonUnit=monthly_eur, savings 20-40%, leverage=ANNUAL_DEAL of EDUCATION_DEAL
   - WATER/GEMEENTE: geen onderhandeling mogelijk → toon "monitoring" alleen
   - etc.

c. OCR prompt: voeg category-detectie toe. Extracteer ook unit-data per category:
   - Energie: kWh-prijs vast + variabel, vastrecht, jaarverbruik geschat
   - Verzekering: dekking-type (WA/casco/uitgebreid), eigen risico
   - Hypotheek: rente, looptijd, type (lineair/annuiteit/aflossingsvrij)
   - Bank: maandkosten, transactie-fees, betaalpakket-naam
   - Streaming: tier (basic/standard/premium)

d. `lib/comparison.ts`: switch op `category.comparisonUnit` zodat de UI per cat
   de juiste vergelijking toont. Energie toont "€0,28/kWh vs markt mediaan €0,24/kWh".

e. `lib/negotiator.ts`: gebruik `categoryRules.negotiationPlaybook` in de system
   prompt zodat de mail per categorie de juiste hoek heeft. Hypotheek-mail vraagt
   om rente-reductie of openbaar oversluiten dreigen, geen "switch binnen 30 dagen".

f. UI op `/onderhandel/analyse`: per category een ander icon + andere chips
   ("kWh-tarief", "dekking", "rente"). Per category een ander "best alternative"
   format.

g. Tests per category:
   - `tests/category-rules.test.ts`: alle Category enum entries hebben rules.
   - `tests/energy-comparison.test.ts`: mock energie-factuur, kWh-extractie werkt.
   - `tests/insurance-negotiation.test.ts`: verzekering-mail noemt dekking + eigen risico.

h. Commit: `feat(categories): 14 categories with per-domain comparison + negotiation`.

---

## DEEL 5 — Multi-currency + locale + UI-vertaling

**Doel:** wereldwijde providers → bedragen in lokale valuta + UI ook in EN/DE/FR.

a. `lib/format.ts`: nieuwe `formatCurrency(cents, currency, locale)` die EUR,
   GBP, USD, CHF aankan. Behoud `formatEurCents` als wrapper voor backwards-compat.

b. Prisma `Bill`: voeg `currency String @default("EUR")` toe. Migratie
   `bill_currency`.

c. OCR extracteert valuta uit `€`/`£`/`$` symbolen + IBAN-prefix.

d. UI vertaling (alleen kerntekst, geen full i18n):
   - `lib/i18n.ts` met dictionary voor `nl`, `en`, `de`, `fr`.
   - Maximaal 40 sleutels: hero-titel, CTA-knoppen, dashboard-labels, error-messages.
   - Cookie `dgh_locale` of `Accept-Language` header → bepaalt locale.
   - Voor providers buiten NL: default locale = provider.locale.

e. Negotiator: support voor `language: "de" | "fr"` toevoegen (volledige
   strings + provider-hints in die taal).

f. `/[locale]/...` route-structuur is overkill voor nu. Houd het simpel:
   één locale via cookie, server-rendered translation lookup.

g. Tests:
   - `tests/format-currency.test.ts`: EUR/GBP/USD/CHF correcte rendering.
   - `tests/i18n.test.tsx`: nl→en switch verandert hero-tekst.

h. Commit: `feat(i18n): multi-currency + 4-language UI translation`.

---

## DEEL 6 — Smart provider auto-onboarding (unknown providers)

**Doel:** als OCR een onbekende provider tegenkomt, automatisch een nieuwe
Provider-entry voorstellen + retention-info ophalen via web.

a. `/api/providers/discover/route.ts` (POST, admin-only of rate-limited per user):
   - Input: provider naam + country hint.
   - Stappen:
     1. WebFetch zoekresultaat "{provider} retention contact email {country}".
     2. WebFetch officiële website /contact pagina.
     3. Groq parse: extract email, phone, hours uit gevonden tekst.
     4. Sla op in `ProviderCandidate` model (apart van `Provider` zodat
        verkeerde data niet direct live gaat).
     5. Return candidate JSON.
   - Prisma `ProviderCandidate { id, name, country, retentionJson, status,
     createdAt }` waar status ∈ {PENDING, APPROVED, REJECTED}.

b. Admin-pagina `/admin/providers/page.tsx` (basic auth via env):
   - Lijst pending candidates, knop "Approve" voegt toe aan static lib/providers.ts
     **NIET** — beter: nieuwe model `Provider` in DB. Maar dat is een grotere
     refactor. Voor nu: candidates approven → markeer als approved, en een
     `scripts/sync-approved-providers.ts` print de TS-code die je handmatig in
     lib/providers.ts plakt. Pragmatisch.

c. UI: bij OCR "needsManualProvider" → toon huidige dropdown PLUS knop
   "Mijn provider staat er niet bij — voeg toe". Klik → call discover endpoint
   → toon "We hebben {provider} gevonden, je kunt verder gaan."

d. Test: mock WebFetch, verifieer endpoint returnt candidate JSON, prisma write,
   geen duplicates.

e. Commit: `feat(providers): auto-onboard unknown providers via web discovery`.

---

## DEEL 7 — /proof + dashboard upgrade voor nieuwe schaal

**Doel:** nu we 14 categorieën en 8 landen hebben, moet /proof filterbaar zijn,
en gebruikers willen hun eigen historie zien.

a. `/proof/page.tsx`: voeg filters toe:
   - Country selector (alle landen waar bills uit komen)
   - Category selector (chips)
   - Period (al aanwezig)
   - Toon per filter combinatie: totaal bespaard, slaag-%, top-providers, mediaan.

b. `/dashboard/page.tsx` (nieuw):
   - Toon per user: totaal bespaard, lopende onderhandelingen, voltooid, gefaald.
   - Per actieve negotiation: state, dagen sinds verzonden, "ga verder" knop.
   - "Nieuwe factuur" CTA prominent.
   - "Voeg al je vaste lasten toe" sectie met alle 14 categorieën als upload-slots.

c. Voeg `/api/dashboard/route.ts` (GET, auth required) toe die alle data
   gestructureerd retourneert. Cache 60s.

d. Tests:
   - `tests/proof-filters.test.tsx`: filter combinations geven correcte SQL.
   - `tests/dashboard.test.tsx`: aggregaten correct, sorteert op recency.

e. Commit: `feat(dashboard): per-user history + filtered proof page`.

---

## DEEL 8 — End-to-end test + production smoke

a. Update bestaande Playwright E2E:
   - Voeg test toe voor multi-round flow: upload → email → "kreeg antwoord" →
     plak response → counter mail.
   - Voeg test voor outcome flow: simuleer 7 dagen na sent, cron-call,
     uitkomst-pagina form.

b. Update `scripts/smoke-prod.ts`:
   - Bestaande 6 checks plus:
   - 7. GET `/dashboard` zonder cookie → redirect /login
   - 8. GET `/api/proof?country=NL&category=TELECOM` → 200 JSON
   - 9. GET `/api/cron/outcome-followup` zonder secret → 401
   - 10. GET `/api/providers/discover` zonder body → 400

c. Run smoke live, plak output in commit.

d. Update `RUNBOOK.md` met:
   - Nieuwe cron op 08:00
   - Hoe nieuwe providers approven
   - Hoe ProviderCandidate flow werkt
   - Nieuwe DB migraties die zijn gedeployed

e. Commit: `test(e2e+smoke): full multi-round + outcome + global flows`.

---

## Afronding

Rapporteer per deeltaak één bullet met commit-hash + één-regel-resultaat,
b.v. `DEEL 1 ✓ abc1234 — multi-round live, 4 nieuwe tests groen, productie
DB heeft NegotiationRound table`.

Bij blockers: stop, rapporteer kort, vraag niet om nieuwe input.

---

## Done-criteria (handmatig verifieerbaar na sprint)

- [ ] Een bestaande KPN-onderhandeling → klik "Ik kreeg antwoord" → ronde 2 werkt
- [ ] Cron-job op Vercel toont volgende run op 08:00 morgen
- [ ] `/proof?country=DE` werkt en toont 0 of meer DE-data
- [ ] Upload een energie-factuur van Vattenfall → kWh-prijs zichtbaar +
      mail noemt "tarief-vast-vs-variabel"
- [ ] Upload een verzekering-factuur van Centraal Beheer → mail noemt dekking
      + eigen risico
- [ ] UI switch naar Engels → hero leest "Save on your monthly bills"
- [ ] Een onbekende provider triggert discovery + candidate appears in /admin
- [ ] Smoke-prod 10/10 groen

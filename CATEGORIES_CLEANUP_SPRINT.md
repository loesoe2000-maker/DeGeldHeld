# DeGeldHeld v10 — Categorieën-cleanup + multi-country alternatieven + auto-pingpong

Vier deelfasen + smoke. ~6–10 uur. Eén commit per fase.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/CATEGORIES_CLEANUP_SPRINT.md en voer alle vijf deeltaken uit in volgorde. Per deeltaak: implementeer, tests, `npx tsc --noEmit`, `npm test -- --run`, commit + push. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 25 min: TODO-commit en door. Migraties: lokaal `prisma migrate dev`, daarna `npx prisma migrate deploy`. Bij externe verificatie (provider-data): WebFetch + Groq, niet verzinnen.
```

---

## DEEL 1 — Multi-country provider-alternatieven écht repareren

Live bug: BE-Eneco factuur kreeg ES + FR alternatieven (Iberdrola, EDF, Endesa).
De country-filter werkt niet of de BE-provider-database is leeg per categorie.

a. Audit `lib/comparison.ts` `buildComparison()`. Voeg `country` parameter toe (optional, default "NL"). Filter alternatives op:
   - Zelfde category
   - Zelfde country (of country === "INT" voor universele)
   - Sorteer op prijs, top-3 cheaper-dan-input

b. Audit `lib/providers.ts`. Per land × categorie minimaal **5 echte alternatieven**:
   - **NL energie**: Eneco, Vattenfall, Greenchoice, Budget Energie, NLE, ENGIE NL, Essent
   - **BE energie**: Engie Electrabel, Luminus, TotalEnergies BE, Bolt, Mega, Eneco BE
   - **DE energie**: E.ON, RWE/Innogy, EnBW, Vattenfall DE, Naturstrom, Lichtblick
   - **FR energie**: EDF, Engie, TotalEnergies, Eni, Vattenfall FR, Mint Energie
   - **UK energie**: British Gas, Octopus, EDF Energy, EON UK, OVO, Bulb (legacy)
   - **NL telecom**: KPN, Vodafone, Odido, Ziggo + MVNOs Budget/Simyo/Lebara/Youfone
   - **BE telecom**: Proximus, Orange, Telenet, Voo, Scarlet, Mobile Vikings
   - **DE telecom**: Telekom DE, Vodafone DE, O2/Telefonica, 1&1, Congstar, Aldi Talk
   - **FR telecom**: Orange, SFR, Bouygues, Free, Sosh, RED
   - **UK telecom**: BT, Sky, Virgin Media, EE, Three, O2 UK, Vodafone UK
   - **NL verzekering**: Centraal Beheer, Univé, FBTO, Aegon, InShared, ANWB, ASR
   - **BE verzekering**: AG Insurance, Ethias, KBC Insurance, AXA BE, Belfius Insurance
   - **DE verzekering**: HUK-Coburg, Allianz, AXA DE, ERGO, R+V, DEVK
   - **NL water**: Vitens, Waternet, Evides, WMD, Brabant Water, PWN, Dunea
        (water is regio-monopolie — toon "geen alternatief, monopoliegebied")
   - **NL bank**: ABN, ING, Rabo, SNS, Bunq, Triodos, ASN, Knab, Revolut
   - **BE bank**: KBC, BNP Paribas Fortis, ING BE, Belfius, Argenta, Crelan
   - **NL hypotheek**: huidige top-10 verstrekkers (ABN, ING, Rabo, AEGON, Munt, NN, Florius, etc.)

   Verifieer via WebFetch dat élk record een echt domein + plausible startprijs heeft. Bij twijfel: skip i.p.v. verzinnen.

c. Voor monopolie-categorieën (NL water, gemeente-belasting, OV-verzekeringen): toon op `/onderhandel/analyse` een speciale message-card "Dit is een regio-monopolie. Onderhandelen heeft hier weinig effect — wel besparen door verbruik te verlagen." met tips.

d. Tests `tests/comparison-multi-country.test.ts`:
   - BE Eneco-bill → top-3 zijn Engie/Luminus/TotalEnergies BE (geen ES/FR)
   - DE Vodafone-bill → top-3 zijn DE-providers
   - Per land × categorie: assertie dat alternatives.length ≥ 3 (of monopolie-flag aan)

e. Commit: `fix(providers): country-aware alternatives + 8 country × 7 category coverage`.

---

## DEEL 2 — Categorieën consolideren naar 7 primair + sub-types

Live verwarring: 14 enum-categorieën in UI (TELECOM ENERGIE WATER GEMEENTE VERZEKERING HYPOTHEEK BANK ABONNEMENT STREAMING GYM OV SOFTWARE OPSLAG OVERIG) — te veel.

**Nieuwe structuur — 7 primaire, sub-categorisering via veld:**

| Primair | Sub-types |
|---|---|
| **TELECOM** | mobiel, internet, tv-pakket, combinatie |
| **ENERGIE** | stroom, gas, warmte, water, stroom+gas combi |
| **VERZEKERING** | zorg, auto, woon, aansprakelijkheid, reis, leven, uitvaart |
| **WONEN** | hypotheek, gemeente-belasting, waterschap, vve-bijdrage, huur |
| **FINANCIEN** | bankpakket, creditcard, beleggingsfee, spaarrekening |
| **ABONNEMENTEN** | streaming, software, gym, opslag, magazines, lidmaatschap |
| **OVERIG** | catch-all |

a. Prisma migratie `categories_v2`:
   - **Behoud** bestaande enum `BillCategory` voor backwards-compat (records met oude waardes blijven werken)
   - Voeg toe op `Bill`: `subType String?` (string ipv enum voor flexibiliteit)
   - Map oude → nieuwe via lib helper:
     - WATER, GEMEENTE → WONEN
     - STREAMING, GYM, SOFTWARE, OPSLAG → ABONNEMENTEN
     - BANK → FINANCIEN
     - OV → VERZEKERING (autoverzekering) of OVERIG
     - HYPOTHEEK → WONEN

b. `lib/categories.ts`:
   - Refactor naar `PRIMARY_CATEGORIES` array van 7
   - Sub-types per primair
   - Helper `primaryFromLegacy(legacyEnum)` voor migratie van bestaande Bills
   - Helper `displayLabel(primary, subType, language)` voor UI

c. OCR-prompt: vraag `primary_category` + `sub_type` ipv alleen `category`. Voorbeeld in prompt:
   ```
   {"primary_category":"ENERGIE","sub_type":"stroom+gas"}
   ```

d. `/app/onderhandel/analyse/page.tsx`: rendert op basis van primary category.
   - Sub-type toont als chip onder provider naam: "Eneco · stroom+gas"
   - Cards/banners zelfde stijl per primary

e. Backfill script `scripts/migrate-categories-v2.ts`:
   - Loop alle bestaande Bills
   - Set `subType` op basis van legacy enum + provider-naam-heuristiek
   - Bv. provider="Vitens" + category="OVERIG" → subType="water"

f. Tests:
   - `tests/categories-v2.test.ts` — backwards-compat: oude bills blijven werken
   - `tests/category-mapping.test.ts` — legacy enum → primary mapping is correct
   - `tests/subtype-display.test.ts` — UI render chip correct

g. Commit: `feat(categories): consolidate to 7 primary + flexible sub-types`.

---

## DEEL 3 — Rijkere category-info op analyse-pagina

Doel: per primary category een aparte info-sectie met context, niet alleen droge cijfers.

a. `lib/category-info.ts` per primary category een rich object:
   ```ts
   {
     primary: "ENERGIE",
     icon: "⚡",
     averageSavingsPct: 0.18,
     averageMonthlySpendNl: 14000, // cents
     marketDescription: "EU-energiemarkt is sinds 2022 zeer volatiel...",
     howToSave: [
       "Vergelijk vast vs variabel tarief",
       "Vraag prijsgarantie >2 jaar",
       "Check ACM jaarlijkse markt-rapport"
     ],
     warningSigns: [
       "Je betaalt meer dan €0,30/kWh — markt is rond €0,25/kWh",
       "Je hebt nooit een aanbod van een concurrent gekregen"
     ],
     monopolyWarning: false, // true voor water, gemeente
   }
   ```
   Voor alle 7 primaire categorieën.

b. `/app/onderhandel/analyse/page.tsx`: voeg sectie toe na bestaande analyse:
   - Collapsible "Hoe werkt {categorie} onderhandelen?"
   - Lijst van 3 tips
   - Waarschuwings-signalen
   - "Realistisch te besparen: 10–25%" range-balk

c. SEO bonus: deze info ook gebruiken op `/[category]-besparen` pages (deze bestaan al, vul met deze rich data).

d. Tests `tests/category-info.test.ts`: alle 7 primaries hebben rich-object compleet.

e. Commit: `feat(category-info): rich per-primary context on analyse + SEO pages`.

---

## DEEL 4 — Auto-pingpong: AI volgt provider-mailbox + counter-mail (user-confirm)

Doel: provider stuurt antwoord per email → AI detecteert via Resend inbound → genereert counter
→ USER MOET BEVESTIGEN → wordt automatisch verzonden via Resend.

Belangrijk: **AI MAG NOOIT autonoom versturen.** Confirmation-gate is wettelijke en
ethische vereiste. Dit punt staat ook in DEEL 5 van AFTER_V7_SPRINT, hier maken we
't af voor email (was daar voor WhatsApp).

a. Prisma — gebruik bestaande `NegotiationRound` model (uit v5) + nieuwe state:
   - Voeg `AWAITING_USER_CONFIRM` toe aan `RoundOutcome` enum
   - Migratie `round_awaiting_confirm`

b. `lib/inbound-router.ts`:
   - Verifieer Resend HMAC
   - Match incoming email op `Negotiation.providerThreadId` of `In-Reply-To` header
     (sla deze op bij élke mail die de user verstuurt — DEEL 4b)
   - Bij match: parse body, run `analyseProviderResponse()` (bestaand uit v5)
   - Genereer counter-mail via `generateEmail()` met `roundN+1` context
   - Sla op als `NegotiationRound` met `outcome=AWAITING_USER_CONFIRM`
   - Stuur user **notificatie-mail**: "Provider antwoordde. Bekijk de voorgestelde
     counter-mail: link naar /onderhandel/[billId]/ronde/[n]"

c. Op `/onderhandel/[billId]/ronde/[n]`: als ronde `AWAITING_USER_CONFIRM`:
   - Toon provider-antwoord
   - Toon AI-counter-mail (subject + body)
   - Twee knoppen: **"Verstuur counter via DeGeldHeld"** (groot, primary) en
     **"Wijzig eerst"** (secondary)
   - "Verstuur" → POST naar `/api/negotiations/round/[id]/confirm-send`
   - Server stuurt via Resend, markeert outcome als `ACCEPTED` (= counter verstuurd)

d. `lib/email-thread.ts`:
   - Genereer thread-id voor élke nieuwe Negotiation (UUID)
   - Bij élke outbound mail: zet `Message-ID: <thread-id@degeldheld.com>`
   - Bij élke inbound: lees `In-Reply-To` header → match op stored thread-id

e. User-setup flow:
   - Op `/account` nieuwe sectie "Auto-onderhandeling": uitleg + toggle
   - Toggle aan → user moet wel provider's reply doorsturen naar
     `auto@degeldheld.com` (subject: link naar negotiation)
   - Toekomst: optie om DeGeldHeld als BCC toe te voegen aan provider-mail
     zodat replies automatisch komen — maar simpelste flow eerst

f. **MANUAL_SETUP_REQUIRED.md** uitbreiden:
   - Resend domain `auto.degeldheld.com` met MX records
   - Resend inbound webhook URL: `/api/inbound/router`
   - HMAC secret: `RESEND_INBOUND_SECRET` in Vercel env

g. Feature flag `FEATURE_AUTO_PINGPONG=true` default uit. Aanzetten pas als
   Resend inbound werkt + getest met 5 echte threads.

h. Tests:
   - `tests/inbound-router.test.ts`: mock Resend payload met In-Reply-To
   - `tests/auto-pingpong.test.ts`: end-to-end mock — inbound → counter → confirm-send
   - `tests/confirm-required.test.ts`: GEEN counter verstuurd zonder user-confirm

i. Commit: `feat(auto-pingpong): email thread tracking + AI counter (user-confirm gate)`.

---

## DEEL 5 — Smoke 35 + STATUS_V10 + UI navigation update

a. `scripts/smoke-prod.ts` → 35 checks:
   - 1-30 bestaande
   - 31. POST `/api/inbound/router` zonder HMAC → 401
   - 32. `/onderhandelen-met-engie-be` SEO page → 200 (BE provider exists)
   - 33. `/account` heeft "Auto-onderhandeling" toggle sectie
   - 34. Upload BE Eneco-fixture → BE-alternatieven returned (no ES/FR)
   - 35. `lib/category-info.ts` heeft 7 primary entries

b. UI cleanup: in elk `/onderhandel/*` page de category-dropdown reduce van
   14 naar 7. Sub-type wordt automatisch geïnferd uit OCR of via secundaire dropdown.

c. Update `/proof` filter-chips: 7 primary categories ipv 14.

d. Update `/dashboard` "categorie-slots" naar 7 primary.

e. `STATUS_V10.md` per deeltaak 1-3 regel resultaat.

f. Commit: `docs(v10): smoke 35 + UI category cleanup + status report`.

---

## Done-criteria

- [ ] BE-bill toont BE-alternatieven (Engie/Luminus/TotalEnergies)
- [ ] Élke land × categorie heeft ≥3 echte alternatieven (of monopolie-flag)
- [ ] UI toont 7 categorieën i.p.v. 14
- [ ] `/onderhandel/analyse` heeft rich-info-sectie per categorie
- [ ] Auto-pingpong route bestaat + werkt achter feature-flag
- [ ] Bij élke counter-mail: user MOET bevestigen — niets gaat autonoom uit
- [ ] Resend inbound webhook getest met curl + correcte 401 zonder HMAC
- [ ] Smoke 35/35 groen

## Eindrapportage

```
CATEGORIES_CLEANUP_SPRINT v10 — Final report

DEEL 1  ✓ <hash> — BE/DE/FR/UK/ES providers verified, country filter live
DEEL 2  ✓ <hash> — 7 primary categories, sub-types live, legacy backwards-compat
DEEL 3  ✓ <hash> — rich info per primary, tips/warnings on analyse
DEEL 4  ✓ <hash> — auto-pingpong with mandatory user-confirm gate
DEEL 5  ✓ <hash> — smoke 35/35, UI cleaned to 7 categories, STATUS_V10 written
```

# DeGeldHeld v7 — Beat Trim Sprint

Drie thema's, elf deelfasen, ~8–12 uur. Doel: alle huidige bugs weg, vitale organen
versterken, én concrete features die ons fundamenteel beter maken dan Trim ooit was.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/BEAT_TRIM_SPRINT.md en voer alle elf deeltaken uit in volgorde. Per deeltaak: implementeer, schrijf tests, run `npx tsc --noEmit` en `npm test -- --run`, commit + push. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 20 min: TODO-commit "chore: SKIP DEEL X — reason" en door. Niet vragen om input. Migraties: lokaal `prisma migrate dev`, daarna `npx prisma migrate deploy` zodat productie meeloopt.
```

---

## Hoofdregels

- Commit per deelfase, eigen scope (`feat`, `fix`, `chore`, `test`, `perf`).
- Bij Groq calls: gebruik **alleen** `llama-3.3-70b-versatile` (text) en
  `meta-llama/llama-4-scout-17b-16e-instruct` (vision). Andere modellen zijn
  geblokkeerd op de free tier.
- Bij externe verificatie (retentie-mails, websites): gebruik WebFetch + Groq
  parse — NIET verzinnen. Bij twijfel: skip de entry liever dan fout invullen.
- Alle nieuwe DB-velden: optional met sensible default zodat oude records
  blijven werken.

---

# THEMA A — BUGS WEG, FUNDAMENTEN STEVIG

## DEEL 1 — Volledige bug-audit + alles wat 404/500 geeft fixen

a. Schrijf `scripts/audit-everything.ts` dat tegen `https://degeldheld.com` draait:
   - GET élke route uit `app/**/page.tsx` (auth-gated via test-cookie)
   - GET élke API route uit `app/api/**/route.ts` met minimale geldige body
   - Voor dynamic routes `[billId]`, `[n]`: pak echte IDs uit productie-DB
   - Voor élke response: log status, bytes, response-tijd, content-type
   - Markeer als FAIL: status >= 400, bytes < 200, of HTML waar JSON verwacht
b. Run het script, plak output, fix élk gevonden probleem in dezelfde commit.
c. Voeg regression-test toe `tests/audit-everything.test.ts` zodat dit niet
   terugkeert.
d. Pre-bestaande TS-errors opruimen:
   - `tests/negotiator.test.ts`: voeg `rationale: ""` toe in alle Alternative
     fixtures
   - `tests/toast.test.tsx`: vervang `import { act } from "vitest"` door
     `import { act } from "@testing-library/react"`
e. `npx tsc --noEmit` → 0 errors.
f. Commit: `fix(audit): resolve all 404/500/TS errors found by full audit`.

---

## DEEL 2 — Provider data verifiëren en cleanen

Probleem: er staan 200+ providers in de registry, een groot deel met mogelijk
verzonnen retentie-mailadressen. Eén fout adres = vertrouwens-incident.

a. Schrijf `scripts/verify-providers.ts`:
   - Loop door alle Provider entries in `lib/providers.ts`
   - Voor elke retention-email: doe DNS MX lookup via Node `dns.resolveMx`.
     Geen MX = adres bestaat niet. Markeer als INVALID.
   - Voor elke retention-url: HEAD request, verwacht 200 of 3xx. 404 = INVALID.
   - Voor providers zonder retention: gebruik WebFetch op `{provider naam} klantbehoud contact {country}` → Groq parse → vul aan.
   - Output: 3 lijsten — VALIDATED, FILLED_IN, INVALID_OR_UNKNOWN.
b. Update `lib/providers.ts`:
   - Vervang verified retention met getest data
   - Voor INVALID_OR_UNKNOWN: zet retention naar `null` (UI valt dan terug
     op algemene "contact je provider via hun website" tekst, niet fake mail)
c. Test `tests/providers-integrity.test.ts`: élke retention.email die niet
   null is moet een geldige email-shape hebben en de @-domain moet matchen
   met provider-website-domein (heuristiek tegen verzinsels).
d. Commit: `chore(providers): verify retention contacts, remove unverified entries`.

---

## DEEL 3 — PDF support écht implementeren

Probleem: ~50% van facturen komt als PDF. Nu wordt ALLES geskipped met
`PDF_SKIPPED_VISION_UNSUPPORTED`. Direct halve markt missen.

a. `npm install pdfjs-dist canvas --legacy-peer-deps`. Op Vercel werkt canvas
   niet out-of-the-box → kies alternatief: `pdf-to-png-converter` of
   `pdf-poppler`. Test welke installeert + werkt op de Vercel Node runtime.
   Fallback: `pdfjs-dist` headless rendering naar Buffer.
b. In `lib/ocr.ts`: vervang het PDF_SKIPPED-pad door:
   1. PDF → Buffer
   2. Render pagina 1 naar PNG-buffer, max 1500px breedte
   3. Stuur die PNG door dezelfde Groq Vision flow als gewone images
   4. Cache imageHash op de PDF-buffer, niet de gerenderde PNG (anders
      breekt re-render caching)
c. Voor PDFs >5 pagina's: render alleen pagina 1 (factuur-samenvatting staat
   meestal voorop).
d. Test `tests/ocr-pdf.test.ts`:
   - Commit `tests/fixtures/kpn.pdf` (echte KPN PDF, of zelf-gemaakte test-PDF
     met provider-naam + bedrag)
   - Verwacht: `extractBill(buf, "application/pdf")` returnt OK met provider
     en amountCents > 0
e. Commit: `feat(ocr): real PDF support via pdfjs rendering to vision`.

---

# THEMA B — TRIM-BUSTER FEATURES

## DEEL 4 — Categorie-diepe vergelijkingslogica (energie, verzekering, hypotheek)

Trim deed alleen subscription canceling. Wij gaan dieper per categorie.

a. `lib/categories/energie.ts`:
   - Type `EnergyBill { kwhPriceVast, kwhPriceVar, vastrecht, jaarverbruikKwh }`
   - `compareEnergy(bill)`: vergelijk kWh-prijs met markt-mediaan
   - Markt-data: hardcode mediaan + p25 + p75 voor NL energie (mei 2026):
     vast €0,28/kWh, variabel €0,31/kWh, vastrecht €6/mnd
   - Output: jaarbesparing als gebruiker naar mediaan-tarief gaat
b. `lib/categories/verzekering.ts`:
   - Type `InsuranceBill { type: "WA"|"WA+"|"CASCO", deductible, premium, voertuig }`
   - `compareInsurance(bill)`: kijk per type, geef 3 goedkopere alternatieven
     met dezelfde dekking
c. `lib/categories/hypotheek.ts`:
   - Type `MortgageBill { restschuld, rentePercentage, rentevasteJaren, looptijd }`
   - `compareMortgage(bill)`: vergelijk rente met huidige markt-rente
     (hardcode mei 2026 markt: 10jr vast 3,8%, 20jr 4,1%)
   - Bereken jaarbesparing bij oversluiten (met €3000 oversluit-kosten meegerekend)
d. OCR-prompt uitbreiden zodat per detected category extra velden worden
   geëxtraheerd (kWh-prijs op energie-factuur, dekking-type op verzekering, etc.)
e. `/app/onderhandel/analyse/page.tsx`: switch op `bill.category` zodat:
   - ENERGIE: toont kWh-tarief vergelijking, jaarverbruik-schatting
   - VERZEKERING: toont dekking-type chips, eigen risico, premium-percentile
   - HYPOTHEEK: toont rente vs markt-rente, oversluit-kalkulator
   - TELECOM (huidig): blijft wat 't is
f. Per categorie een aparte negotiator-prompt-context in `lib/negotiator.ts`
   die de juiste hoek inzet (energie = "tarief vast vs variabel", hypotheek =
   "oversluiten dreigen", verzekering = "dekking downgrade").
g. Tests:
   - `tests/category-energie.test.ts` — kWh-extractie + vergelijking
   - `tests/category-verzekering.test.ts` — dekking-typering + alternatieven
   - `tests/category-hypotheek.test.ts` — rente-vergelijking + oversluit-rekensom
h. Commit: `feat(categories): deep per-domain comparison for energie/verzekering/hypotheek`.

---

## DEEL 5 — AI feedback loop: was de mail effectief?

Probleem: we genereren mails maar weten niet of ze werken. Trim had dit ook niet
goed. Hier worden wij echt anders.

a. Prisma: voeg toe aan `Negotiation`:
   ```
   userRating Int?       // -1, 0, 1 — thumbs down/neutral/up direct na lezen mail
   mailUsed Boolean @default(false)   // user kopieerde/verstuurde
   providerResponded Boolean?         // user gaf aan dat provider antwoordde
   ```
   Migratie `negotiation_feedback`.
b. Op `/onderhandel/email`: na de mail twee subtle knoppen
   "👍 Goede mail" / "👎 Voelt off" → POST naar `/api/negotiations/[id]/feedback`.
c. Op `/uitkomst`: extra checkbox "Provider antwoordde" (los van success/fail).
d. Nieuwe analytics-view: `/proof?view=mail-quality` toont:
   - % mails met thumbs up
   - % mails die werden gekopieerd
   - % mails waar provider op antwoordde
   - Per strategie (RETENTIE_DREIG, SWITCH_CLAIM, etc.): success-rate
   - Per provider: success-rate
e. `scripts/prompt-tuner.ts`: nightly cron-style script dat de afgelopen
   30 dagen feedback analyseert en in `lib/negotiator.ts` voor élke strategie
   logged welke variant beter scoort. Geen automatische prompt-aanpassing
   (te risky), wel een rapport.
f. Tests: `tests/feedback-flow.test.ts` — feedback POST → DB-write → /proof
   query toont aangepaste cijfers.
g. Commit: `feat(feedback): mail rating + response tracking + quality dashboard`.

---

## DEEL 6 — Demo mode: probeer zonder upload of account

Probleem: nieuwe bezoeker → upload of donder op. Conversie killer.

a. `/app/demo/page.tsx`:
   - Hardcoded fake "Voorbeeld-factuur" (KPN €29,65, Eneco energie, Centraal
     Beheer verzekering — drie keuzes via tabs)
   - User klikt een factuur → ziet de hele analyse-flow alsof 't echt is:
     besparing, alternatieven, gegenereerde mail
   - Boven elke pagina: amber banner "Dit is een demo met een voorbeeld-factuur"
   - Knop onderaan: "Probeer met je eigen factuur" → naar /login
b. Demo data: bouw 3 fake bills + fake Negotiation results + fake mail-output
   in `lib/demo-fixtures.ts`. Geen DB-write, alles in memory.
c. Homepage CTA: nieuwe knop "Bekijk hoe het werkt (30 sec)" → naar /demo.
   Onder hoofdknop "Probeer nu gratis".
d. Tests: `tests/demo.test.tsx` — alle 3 demos renderen, geen DB-call, geen
   auth nodig.
e. Commit: `feat(demo): try-without-account flow with 3 example bills`.

---

## DEEL 7 — Referral systeem voor virale groei

Trim's grootste gemis: geen viral loop. Bij ons wel.

a. Prisma: nieuwe model `Referral`:
   ```
   model Referral {
     id        String  @id @default(cuid())
     code      String  @unique   // 6-letter slug
     ownerId   String              // referrer
     usedById  String?             // referred user
     usedAt    DateTime?
     rewardCents Int?              // korting/credit
     createdAt DateTime @default(now())
     owner User @relation(...)
   }
   ```
   Plus op `User`: `referralCode String? @unique` (auto-gegenereerd bij signup).
b. Dashboard sectie "Verdien gratis onderhandelingen":
   - Toon `degeldheld.com/uitnodiging/{code}` met copy-knop
   - Bij elke aangenomen referral: 1 gratis onderhandeling (skip paywall)
   - Counter "X mensen via jou aangesloten"
c. `/app/uitnodiging/[code]/page.tsx`: landing voor referral-link
   - Toont "{naam referrer} nodigt je uit voor DeGeldHeld — eerste onderhandeling gratis"
   - CTA naar /login met code in cookie
d. Op /login: cookie lezen → bij signup koppelen aan `Referral.usedById`.
e. WhatsApp/email pre-fill voor share: "Ik bespaarde €X via DeGeldHeld. Jij eerste
   onderhandeling gratis: {link}"
f. Tests: `tests/referral.test.ts` — referral-code generation, link-flow, reward-trigger.
g. Commit: `feat(referral): viral invite loop with free-negotiation reward`.

---

# THEMA C — DISTRIBUTIE + GROEI

## DEEL 8 — SEO landing pages per provider en per categorie

Probleem: 0 organisch verkeer. Long-tail SEO is goedkoopste kanaal.

a. Static pages genereren:
   - `/onderhandelen-met-[provider]/page.tsx` met `generateStaticParams` voor
     top 30 NL providers (KPN, Vodafone, Ziggo, Eneco, Vattenfall, etc.)
   - `/[category]-besparen/page.tsx` voor energie, verzekering, hypotheek, telecom
b. Per pagina ~800 woorden NL content (kan AI-gegenereerd via Groq):
   - "Hoe werkt onderhandelen met {provider}?"
   - "Wat je kunt besparen op {category}"
   - "5 stappen om {provider} korting te krijgen"
   - Met DeGeldHeld CTA na elke sectie
c. Sitemap.xml automatisch genereren van alle SEO pages.
d. Meta-tags + JSON-LD structured data per pagina (Article schema).
e. Internal linking: vanaf homepage naar top-5 SEO pages.
f. Robots.txt: allow all, disallow /api en /dashboard.
g. Tests: `tests/seo-pages.test.ts` — alle 34 pages renderen 200, hebben
   unieke titel en H1.
h. Commit: `feat(seo): 30 provider + 4 category landing pages with structured content`.

---

## DEEL 9 — Auto-generate social share content na elke besparing

Trim had geen virale share-flow. Wij wel.

a. Na success op `/uitkomst`: scherm "Deel je succes":
   - Auto-gegenereerde tekst: "Ik bespaarde €X bij {provider} dankzij DeGeldHeld AI 🎉"
   - 4 share-knoppen: WhatsApp / X / LinkedIn / Instagram Stories (image)
   - Voor Instagram Stories: server-side gegenereerde 1080×1920 PNG via
     `@vercel/og` met de cijfers + DeGeldHeld logo
b. Default share-text in NL, configureerbaar (gebruiker kan aanpassen)
c. UTM-tracking in elke share-link: `?utm_source=share&utm_medium=whatsapp`
d. `/proof?source=share`: filter laat zien hoeveel verkeer uit shares komt.
e. Tests: `tests/share-content.test.ts` — PNG-render werkt, share-tekst klopt.
f. Commit: `feat(viral): auto-generated share kit per successful negotiation`.

---

## DEEL 10 — Monitoring + alerts + uptime

Probleem: als productie crasht weet je 't nu pas als jij langskomt.

a. `instrumentation.ts`: Sentry init voor client + server + edge. Capture:
   - userId
   - route
   - request-id (genereer als UUID per request)
   - tags: stage (van upload route), provider (van bill), strategy
b. `lib/alert.ts`: helper `alertHigh(message, context)` die Sentry-event + optionele
   webhook naar Discord/Telegram pusht. Gebruik in: failing crons, 5xx in
   API routes, Stripe webhook failures.
c. `/api/health`: uitbreiden van simpele {ok:true} naar status-check van alle
   externe deps:
   - DB ping
   - Groq ping (cached, max 1×/5min)
   - Resend test API
   - Returns {ok, services: {db, groq, resend, stripe}, uptime}
d. UptimeRobot setup-script `scripts/setup-uptime.ts` dat via hun API een
   monitor aanmaakt voor /api/health → alert naar je email bij downtime
   (handmatige stap: hij print de API-key URL).
e. Vercel Analytics aanzetten via `@vercel/analytics`. Voeg toe in
   `app/layout.tsx`.
f. Tests: `tests/health.test.ts` — verwacht alle 4 services in response.
g. Commit: `feat(ops): full monitoring stack — sentry, health, analytics, uptime`.

---

# THEMA D — VERIFICATIE + AFRONDING

## DEEL 11 — Smoke 20-check + status-rapport + STATUS_V7.md

a. `scripts/smoke-prod.ts` uitbreiden naar 20 checks:
   1-6: bestaande
   7. `/demo` → 200 contains "voorbeeld-factuur"
   8. `/onderhandelen-met-kpn` → 200 contains "KPN"
   9. `/energie-besparen` → 200 contains "kWh"
   10. `/uitnodiging/test-code` → 200 of 404 (geen 500)
   11. `/api/health` → 200, alle 4 services OK
   12. `/sitemap.xml` → 200 met >20 URLs
   13. `/robots.txt` → 200 met "User-agent: *"
   14. `/privacy` → 200 met "AVG"
   15. POST `/api/negotiations/round` zonder body → 400
   16. POST `/api/bills/upload` zonder file → 400
   17. POST `/api/negotiations/[fake-id]/feedback` met rating → 401 of 404
   18. PDF upload e2e: lokaal fixture upload → 200 met provider
   19. Demo-pagina end-to-end: 3 fake bills laden, geen errors
   20. Lighthouse `/`: Perf ≥ 80, A11y ≥ 90, SEO ≥ 95
b. Run smoke, plak output.
c. `STATUS_V7.md`: per deeltaak 1-3 regels, lijst van bekende issues + skipped.
d. Update `README.md`: v7-status, nieuwe feature-tabel, korte "wat DeGeldHeld
   anders maakt dan Trim"-sectie.
e. Update `RUNBOOK.md`: nieuwe crons, nieuwe scripts, hoe referrals beheren.
f. Commit: `docs(v7): smoke 20/20 + status + readme + runbook`.

---

## Done-criteria

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm test -- --run` → >95% pass
- [ ] Smoke-prod 20/20 groen
- [ ] PDF upload werkt voor echte factuur
- [ ] Demo-pagina geeft volledige flow zonder login
- [ ] SEO: 30 provider + 4 category pages live met unieke content
- [ ] Referral-code werkt end-to-end
- [ ] Sentry vangt een test-error op
- [ ] /api/health geeft status van alle 4 deps
- [ ] Provider-registry heeft 0 verzonnen retentie-mails

## Wat we hierna écht beter doen dan Trim

| | Trim | Wij na deze sprint |
|---|---|---|
| Categorieën | Subscription cancel | Telecom + Energie + Verzekering + Hypotheek met domein-specifieke vergelijking |
| Multi-round | 1 call, klaar | Tot 3 rondes met AI-counter-mail |
| Transparency | Black box | Open `/proof` + mail-rating + open prompts |
| Distributie | Bank-koppeling required | Demo-mode, referral, SEO pages, social share kit |
| Pricing | 33% recurring | 10% éénmalig of €4,99 flat |
| EU/AVG | Niet beschikbaar | Privacy/voorwaarden/cookie-banner native |
| Feedback loop | Geen | Per mail thumbs + provider-response tracking |
| Monitoring | Onbekend | Sentry + health + uptime + Vercel analytics |

## Eindrapportage format

```
BEAT_TRIM_SPRINT v7 — Final report

THEMA A: stability
  DEEL 1  ✓ <hash> — N routes fixed, 0 TS errors remaining
  DEEL 2  ✓ <hash> — X providers verified, Y invalid removed
  DEEL 3  ✓ <hash> — PDF support live, fixture-test groen

THEMA B: trim-buster
  DEEL 4  ✓ <hash> — 3 categories deep, M tests
  DEEL 5  ✓ <hash> — feedback loop + quality dashboard live
  DEEL 6  ✓ <hash> — demo mode with 3 fixtures
  DEEL 7  ✓ <hash> — referral system live

THEMA C: distribution
  DEEL 8  ✓ <hash> — 34 SEO pages, sitemap updated
  DEEL 9  ✓ <hash> — share kit + PNG generator
  DEEL 10 ✓ <hash> — full monitoring stack

THEMA D: verify
  DEEL 11 ✓ <hash> — smoke 20/20, runbook updated

Skipped: <list with reason>
Open issues: <known limitations>
Bug-jacht onderweg: <surprises>
```

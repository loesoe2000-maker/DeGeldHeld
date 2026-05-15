# DeGeldHeld QA Sprint v4 — één mega-prompt

Plak deze volledige prompt in Claude Code (vanuit `/Users/bdb/alpharadar-pro/degeldheld/`).
Het script werkt zes deeltaken volgordelijk af, commit + pusht na elke deeltaak,
en sluit af met een live smoke-check tegen productie.

Regels die voor de hele sprint gelden:
- Werk de stappen 1 → 6 in volgorde. Niet skippen.
- Elke stap eindigt met `git add` van de gewijzigde bestanden, een eigen commit
  met conventional message, en `git push`. Zo gaat niets verloren bij een crash.
- Bij een falende test of build: stop, diagnoseer de échte oorzaak, fix, en hervat.
  Niet de test softer maken om groen te krijgen.
- Vermeld bij elke commit `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## START — kopieer alles hieronder in één /goal-prompt

```
Voer zes deeltaken uit in volgorde. Elke deeltaak: implementeer, voeg tests toe,
draai `npx tsc --noEmit` en `npm test -- --run` (mag falen alleen op pre-bestaande
errors die je niet raakt — alle nieuwe tests moeten groen zijn), commit, push.
Niet doorgaan naar de volgende deeltaak tot deze groen is. Bij rood: fix de
échte oorzaak.

================================================================
DEEL 1 — OCR: scheid maandelijks abonnement van factuur-totaal
================================================================
Live bug: KPN-factuur leest €29,65/mnd. Dat is totaal = €24,66 abonnement +
€4,99 eenmalige online-aankopen. We vergelijken nu het totaal i.p.v. het
abonnement → besparing structureel overschat.

a. Pas lib/ocr.ts SYSTEM_PROMPT aan: vraag het model expliciet om
   `monthly_subscription_eur` (vast maand-bedrag) EN `total_eur` (incl.
   eenmalige posten) EN `one_time_items` (string[] met labels) terug te geven.
b. Breid OcrResult uit met monthlyAmountCents en totalAmountCents.
   parseOcrJson moet beide velden parsen + valideren.
c. extractBill kiest amountCents = monthlyAmountCents ?? totalAmountCents.
d. Prisma migratie: voeg optional Int kolommen `monthlyCents` en `totalCents`
   toe aan model Bill. Run `npx prisma migrate dev --name bill_monthly_total`.
e. /app/api/bills/upload/route.ts slaat beide bedragen op in de Bill record.
f. /app/onderhandel/analyse/page.tsx: als bill.totalCents bestaat en >5%
   afwijkt van bill.monthlyCents, toon onder de "Jouw huidige situatie" kaart
   een blauwe info-balk: "Je factuur bevat €X,XX aan eenmalige posten. We
   vergelijken op je vaste maand-abonnement van €Y,YY."
g. Nieuwe test tests/ocr-monthly-vs-total.test.ts met drie inputs (mock
   het Groq response):
   - KPN: monthly=2466, total=2965, one_time_items=["Online aankopen 4,99"]
   - Vodafone simpel: monthly=2995, total=2995, one_time_items=[]
   - Energie termijn: monthly=18000, total=18000, one_time_items=[]
h. Commit: "feat(ocr): split monthly subscription from invoice total"

================================================================
DEEL 2 — Stale-factuur waarschuwing (>6 maanden oud)
================================================================
Live bug: factuur uit aug 2020 wordt vergeleken met markt 2026. Geen melding.

a. Voeg helper parseInvoiceDate(period: string | null): Date | null toe in
   lib/ocr.ts. Robuust voor: "augustus 2020", "Aug 2020", "08-2020",
   "2020-08", "2020/08", "8/2020", NL + EN + DE maandnamen. Return null
   bij parse-fail.
b. Unit-test tests/parse-invoice-date.test.ts met minstens 12 inputs
   waarvan 3 die null moeten teruggeven.
c. Sla parseInvoiceDate(ocr.period) op als nieuwe optionele DateTime kolom
   `invoiceDate` op Bill. Migratie: `bill_invoice_date`.
d. /app/onderhandel/analyse/page.tsx: bovenaan, vóór de "huidige situatie"
   kaart, render een amber banner met role="alert" als invoiceDate ouder is
   dan 180 dagen: "Deze factuur is X maanden oud — markt-prijzen kunnen
   gewijzigd zijn. Upload een recente factuur voor nauwkeurig advies."
   X = floor(dagen / 30).
e. Snapshot-test dat de banner verschijnt bij oude factuur en niet bij verse.
f. Commit: "feat(analyse): warn on stale invoices older than 180 days"

================================================================
DEEL 3 — MVNO-context in alternatieven
================================================================
Live bug: "Budget Mobiel — 5 GB op KPN" suggereert KPN-product. Klopt niet,
het is MVNO op KPN-netwerk.

a. Open lib/providers.ts. Voeg veld `network?: string` (null = eigen
   netwerk) toe aan het Provider-type. Vul NL telecom-markt in:
   - Eigen netwerk (network=null): KPN, Vodafone, Odido (T-Mobile NL)
   - MVNO op KPN: Budget Mobiel, Simyo, Hollandsnieuwe, Lebara, Lyca,
     Youfone, Aldi Talk NL, Telfort (legacy)
   - MVNO op Odido/T-Mobile: Ben, Simpel, Tele2 (legacy), hollandsnieuwe
     (correctie waar van toepassing)
   - MVNO op Vodafone: Lebara (sommige), check werkelijke netwerk
   Gebruik webfetch + groq als je twijfelt; vermijd verzinnen.
b. Werk prisma/seed.ts bij waar provider-lijst staat (indien apart).
c. components/Comparison.tsx: vervang "X GB op {provider}" door:
   - `${gb} GB · MVNO op ${network}-netwerk` als network is gezet
   - `${gb} GB · eigen netwerk` als network null is
d. Test tests/comparison-mvno.test.tsx: één KPN-plan en één Budget Mobiel
   plan, snapshot de gerenderde tekst.
e. Commit: "feat(providers): label MVNO plans with underlying network"

================================================================
DEEL 4 — DB-cleanup van mislukte uploads
================================================================
Live state: vóór de user-scoped hash fix zaten er Bill records met
provider="Onbekend" / amountCents=0 in productie. Verwijder die.

a. Schrijf scripts/cleanup-stale-bills.ts. Gebruikt @/lib/db prisma client.
   Verwijdert alle Bill waar (provider="Onbekend" OR provider="" OR
   provider IS NULL) AND amountCents=0 AND createdAt < (24 uur geleden).
   Verwijdert ook hangende Negotiation rows met onClick cascade (al via
   schema). Logt aantal verwijderd, idempotent.
b. Draai het tegen productie: laad eerst de DATABASE_URL uit Vercel
   (`vercel env pull .env.production --environment=production` indien
   beschikbaar, anders gebruik existing .env). Run:
     DATABASE_URL=$DATABASE_URL npx tsx scripts/cleanup-stale-bills.ts
   Plak output in commit-bericht.
c. Test tests/cleanup-stale-bills.test.ts: seed 4 bills (2 stale, 2 ok),
   roep cleanup aan, verifieer 2 verwijderd en 2 over.
d. Commit: "chore(db): cleanup script + initial purge of stale Onbekend bills"

================================================================
DEEL 5 — End-to-end happy-path test
================================================================
Geen huidige E2E. Risico dat een toekomstige fix iets stil breekt.

a. `npm install -D @playwright/test --legacy-peer-deps`. Run
   `npx playwright install chromium`.
b. playwright.config.ts: baseURL `http://localhost:3000`, webServer dat
   `next dev` start.
c. tests/e2e/upload-to-email.spec.ts:
   - beforeAll: maak test-user in DB met een geldig session JWT cookie
     (gebruik @/lib/auth helpers). Mock Groq Vision via msw of een env-
     flag GROQ_VISION_MOCK=1 die in lib/ocr.ts een vaste response returnt.
   - test "uploadt factuur en ziet besparing":
     1. page.goto('/onderhandel') met session cookie
     2. page.setInputFiles('#bill-file', 'tests/fixtures/kpn-sample.png')
     3. wait for url /onderhandel/analyse
     4. expect text /KPN/, /€/, /besparing/i
     5. click "Genereer onderhandel-email"
     6. expect mail-preview bevat klantnummer + bedrag
d. Commit een kleine PNG-fixture in tests/fixtures/kpn-sample.png (mag
   stockfoto zijn die bekend onleesbaar is — dan triggert de mock).
e. .github/workflows/e2e.yml: matrix Node 20, runs npm ci + playwright
   install + npm test:e2e. Run op elke push naar main.
f. package.json: voeg `"test:e2e": "playwright test"` toe.
g. Run lokaal: `npm run test:e2e` — moet groen zijn.
h. Commit: "test(e2e): playwright upload-to-email happy path + CI"

================================================================
DEEL 6 — Live smoke-check tegen productie
================================================================
a. Schrijf scripts/smoke-prod.ts. Tegen https://degeldheld.com:
   1. GET / → status 200, body contains "DeGeldHeld"
   2. GET /login → status 200, body contains 'type="email"'
   3. GET /proof → status 200, body contains "Track record"
   4. GET /api/health → status 200, JSON { ok: true }
   5. GET /api/proof → status 200, JSON met "totalSavedCents" key
   6. GET /onderhandel (zonder cookie) → status 200 of 307, eindigt op /login
   Voor elke check: groene ✓ of rode ✗ log line. Exit 0 als allemaal groen.
b. Run: `npx tsx scripts/smoke-prod.ts`. Plak de volledige output in het
   commit-bericht.
c. Als één check rood is: STOP, fix de échte oorzaak in een aparte commit
   eerst, dan smoke opnieuw, dan deze stap committen.
d. Commit: "test(smoke): live production health checks"

================================================================
AFRONDING
================================================================
- Sluit af met een korte rapportage in deze chat: per deeltaak één bullet
  met commit-hash + één-regel-resultaat (b.v. "DEEL 1 ✓ a1b2c3d — 3 nieuwe
  tests groen, KPN factuur toont nu €24,66").
- Geen mark-down emoji in code/commits.
- Geen --no-verify, geen --force push.
- Bij blockers: rapporteer kort + stop, vraag niet opnieuw om input.
```

---

## Done-criteria (visueel verifieerbaar)

- [ ] Op `/onderhandel/analyse` van een KPN-factuur €29,65 staat blauwe banner
      "€4,99 aan eenmalige posten — vergelijken op €24,66 abonnement"
- [ ] Factuur uit 2020 toont amber banner met aantal maanden oud
- [ ] Alternatief "Budget Mobiel" toont "MVNO op KPN-netwerk"
- [ ] `select count(*) from "Bill" where provider='Onbekend' and "amountCents"=0` op
      productie geeft 0
- [ ] GitHub Actions tab toont E2E workflow groen op laatste commit
- [ ] `npx tsx scripts/smoke-prod.ts` print 6× ✓

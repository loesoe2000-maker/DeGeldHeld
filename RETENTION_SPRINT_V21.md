# DeGeldHeld v21 — Retentie-motor Sprint

**Doel:** klanten terughalen + meer rekeningen per klant (jouw omzet-
hefboom bij een eenmalige fee). Drie mechanieken: multi-categorie nudge,
contract-einde radar, maandelijks geld-rapport.

**Niet-onderhandelbaar — anders breekt het je net-gefixte deliverability:**
élke e-mail in deze sprint MOET (1) een opt-out respecteren, (2) een
unsubscribe-link bevatten, en (3) **idempotent** zijn (een cron mag
dezelfde mail nooit twee keer sturen). Bouw die fundering in DEEL 1
vóórdat er één retentie-mail verstuurd wordt.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/RETENTION_SPRINT_V21.md en voer alle deeltaken uit in volgorde. DEEL 1 (anti-spam fundering) MOET af zijn voordat enige retentie-mail verstuurd kan worden. Per deeltaak: implementeer, run tests (npm test + npx tsc --noEmit), bij fail fix tot groen, commit + push. Migraties: datum-prefix + `npx prisma migrate deploy` + `npx prisma generate`. Hergebruik de bestaande mail-helper (lib/email.ts) + het geverifieerde from-adres. Alle nieuwe crons achter CRON_SECRET (zoals v20). Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 25 min: TODO-commit en door. Eindig met V21_REPORT.md.
```

---

## DEEL 1 — Anti-spam fundering (EERST, verplicht)

a. Schema (`model User`, migratie):
   ```
   marketingOptOut      Boolean   @default(false)  // globale opt-out
   unsubscribeToken     String?   @unique          // voor 1-klik uitschrijven
   lastNudgeAt          DateTime?                   // multi-cat nudge throttle
   lastMonthlyReportAt  DateTime?                   // maandrapport idempotency
   ```
   En op `model Bill`:
   ```
   contractEndDate      DateTime?                   // uit OCR of geschat
   contractAlertSentAt  DateTime?                   // contract-radar idempotency
   ```

b. **Eén centrale gate** `lib/notify.ts`:
   ```ts
   // Stuurt ALLEEN als: user heeft email, niet marketingOptOut,
   // en (optioneel) de per-type throttle niet recent getriggerd is.
   // Voegt automatisch de unsubscribe-footer toe. Retourneert
   // {sent:boolean, reason?:string}. NOOIT direct sendEmail() vanuit
   // een cron — altijd via deze gate.
   export async function sendRetentionEmail(opts: {...}): Promise<...>
   ```
   - Genereert/gebruikt `unsubscribeToken` (random, uniek) per user.
   - Footer met link `https://www.degeldheld.com/unsubscribe?token=...`.

c. Unsubscribe-endpoint + pagina:
   - `GET /api/unsubscribe?token=...` → zet `marketingOptOut = true` →
     toont een nette "je bent uitgeschreven" bevestiging. Idempotent,
     geen auth nodig (token = bewijs).
   - Op `/account`: toggle "Ontvang bespaar-tips & herinneringen" die
     `marketingOptOut` aan/uit zet.

d. Tests `tests/notify-gate.test.ts`: opt-out → niet versturen; geen
   email → niet versturen; throttle binnen window → niet versturen;
   unsubscribe-token zet opt-out; footer bevat de link.

e. Commit: `feat(notify): opt-out + unsubscribe + idempotent send gate`.

---

## DEEL 2 — Multi-categorie nudge (#1)

a. `lib/categories.ts` heeft de primary-categorieën. Bepaal per user
   welke categorieën hij NIET heeft (op basis van z'n bills).

b. Cron `app/api/cron/category-nudge/route.ts` (CRON_SECRET, schedule
   bv `0 10 * * 2` = wekelijks dinsdag 10u):
   - Voor users met ≥1 geslaagde onderhandeling én een categorie-gat,
     én `lastNudgeAt` > 14 dagen geleden (throttle):
     stuur via `sendRetentionEmail`: "Je bespaarde €X op {categorie}.
     Huishoudens besparen gemiddeld ook op {ontbrekende categorie} —
     upload 'm en we checken het gratis." Met deeplink naar `/onderhandel`.
   - Zet `lastNudgeAt = now()`.
   - Max één nudge per run per user.

c. Tests: user zonder gat → geen mail; binnen throttle → geen mail;
   opt-out → geen mail (gate dekt dit al); juiste ontbrekende-categorie
   wordt genoemd.

d. Commit: `feat(retention): multi-category nudge after a win`.

---

## DEEL 3 — Contract-einde radar (#2)

a. **Contract-einddatum vullen.** Bij OCR (lib/ocr.ts): als de factuur
   een contract-einddatum noemt ("contract loopt tot", "einde looptijd"),
   extraheer die naar `contractEndDate`. Anders: schat = `invoiceDate +
   12 maanden` (gangbare NL-contractduur) en LABEL het als schatting.
   Persisteer in `billDataFromOcr`. Niet detecteerbaar → null (geen alert).

b. Cron `app/api/cron/contract-radar/route.ts` (CRON_SECRET, dagelijks):
   - Vind bills met `contractEndDate` tussen +30 en +45 dagen vanaf nu,
     `contractAlertSentAt` null, user niet opted-out.
   - Stuur via gate: "Je {provider}-contract loopt over ~{n} weken af.
     Providers verhogen vaak de prijs bij verlenging — laat ons nu
     opnieuw onderhandelen." Deeplink naar de re-onderhandel-flow.
   - Zet `contractAlertSentAt = now()` (idempotent).

c. Tests: bill 38 dagen voor einde + niet gealerteerd → mail + stamp;
   al gealerteerd → geen tweede; geschatte vs gedetecteerde datum;
   datum null → genegeerd.

d. Commit: `feat(retention): contract-end radar alerts before renewal`.

---

## DEEL 4 — Maandelijks geld-rapport (#3)

a. Cron `app/api/cron/monthly-report/route.ts` (CRON_SECRET, `0 9 1 * *`
   = 1e vd maand 9u):
   - Voor elke user met ≥1 bill, niet opted-out, `lastMonthlyReportAt`
     niet deze maand:
     stuur digest: totaal bespaard, # lopende onderhandelingen, #
     rekeningen die opnieuw gecheckt kunnen worden, en één concrete
     call-to-action (grootste kans). Persoonlijk, kort.
   - Zet `lastMonthlyReportAt = now()`. Skip users zonder enige activiteit.
   - Batch netjes (geen duizenden tegelijk → respecteer Resend-limieten;
     verwerk in chunks met kleine pauze indien nodig).

b. Voeg de cron toe aan `vercel.json`.

c. Tests: al verstuurd deze maand → skip; opt-out → skip; user zonder
   bills → skip; bedragen kloppen met de savings-stats.

d. Commit: `feat(retention): monthly savings digest email`.

---

## DEEL 5 — "Bespaard over tijd" op dashboard

a. Op `/dashboard`: een sectie die cumulatieve besparing over tijd toont
   + een mijlpaal ("Je zit op €X — huishoudens als jij besparen €Y meer
   met hun energie/verzekering"). Hergebruik `computeSavingsStats`.
b. Subtiel een upload-CTA voor ontbrekende categorieën (sluit aan op #1),
   hergebruik `CategoryUploadGrid`.
c. Geen nieuwe data nodig — puur presentatie op bestaande stats.
d. Commit: `feat(dashboard): savings-over-time + milestone nudge`.

---

## DEEL 6 — Aggregate + rapport

a. `npm test -- --run` + `npx tsc --noEmit` groen. Alle nieuwe crons in
   `vercel.json` + achter CRON_SECRET.
b. `V21_REPORT.md`:
   - Per mechaniek: trigger, throttle, idempotency-veld
   - Bevestig: élke mail respecteert opt-out + heeft unsubscribe
   - Welke velden uit OCR komen (contract-einddatum: gedetecteerd vs
     geschat) als restpunt
   - Restpunt #4 (echte her-check) + #5 (referral-versterking) als
     latere uitbreiding genoemd
c. Commit: `docs(v21): retention engine verified — anti-spam safe`.

---

## Done-criteria

- [ ] Opt-out + unsubscribe + idempotente send-gate (DEEL 1) — fundering
- [ ] Multi-categorie nudge (throttled, na een win)
- [ ] Contract-einde radar (idempotent, 30-45 dagen vooraf)
- [ ] Maandelijks geld-rapport (1×/maand, skip inactief)
- [ ] Dashboard "bespaard over tijd" + mijlpaal
- [ ] Élke retentie-mail: opt-out gerespecteerd + unsubscribe-link aanwezig
- [ ] Alle crons in vercel.json + achter CRON_SECRET
- [ ] `npm test` + `npx tsc --noEmit` groen
- [ ] V21_REPORT.md

## Eindrapportage

```
RETENTION_V21 — Final report

DEEL 1  ✓ <hash> — opt-out + unsubscribe + idempotente gate
DEEL 2  ✓ <hash> — multi-categorie nudge
DEEL 3  ✓ <hash> — contract-einde radar
DEEL 4  ✓ <hash> — maandelijks geld-rapport
DEEL 5  ✓ <hash> — dashboard bespaard-over-tijd
DEEL 6  ✓ <hash> — rapport
```

**Na deze sprint heb je een retentie-motor die klanten terughaalt op het
juiste moment en meer rekeningen per klant oplevert — zonder je
deliverability te schaden (alles opt-out-veilig + idempotent).**

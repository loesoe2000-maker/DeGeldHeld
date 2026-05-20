# V21_REPORT — Retentie-motor Sprint

**Doel:** klanten terughalen + meer rekeningen per klant — zonder de
(net-gefixte) deliverability te schaden. Drie mechanieken bovenop één
anti-spam fundering.

## Eindrapportage

```
RETENTION_V21 — Final report

DEEL 1  ✓ 51456e8 — opt-out + unsubscribe + idempotente send-gate
DEEL 2  ✓ 30827b8 — multi-categorie nudge
DEEL 3  ✓ 13a6ec6 — contract-einde radar
DEEL 4  ✓ 633de40 — maandelijks geld-rapport
DEEL 5  ✓ b81c07b — dashboard bespaard-over-tijd + mijlpaal
DEEL 6  ✓ <dit commit> — rapport
```

## Fundering: anti-spam (DEEL 1)

Élke retentie-mail gaat verplicht door **`lib/notify.ts → sendRetentionEmail()`**.
Die gate:
- stuurt **alleen** als de user een e-mail heeft én **niet** `marketingOptOut` is;
- houdt een **per-type throttle** aan (cron geeft `lastAt` + `minHours` mee);
- zet automatisch een **unsubscribe-footer** (html + tekst) met
  `https://www.degeldheld.com/api/unsubscribe?token=…`;
- mint lazily een uniek `unsubscribeToken`.

`GET /api/unsubscribe?token=…` zet `marketingOptOut=true` (geen auth — token
= bewijs, idempotent, niet-enumereerbaar) + toont een bevestigingspagina.
Op `/account` staat een toggle "Bespaar-tips & herinneringen" (schrijft de
inverse `marketingOptOut` via `/api/account/prefs`).

Migratie `20260522000000_retention_fields` (deployed + `prisma generate`):
`User.marketingOptOut / unsubscribeToken / lastNudgeAt / lastMonthlyReportAt`,
`Bill.contractEndDate / contractAlertSentAt`.

## Per mechaniek — trigger / throttle / idempotency

| Mechaniek | Cron (vercel.json) | Trigger | Throttle / idempotency-veld |
|-----------|--------------------|---------|------------------------------|
| **Multi-categorie nudge** (#1) | `category-nudge` — `0 10 * * 2` (di 10u) | user met ≥1 geslaagde onderhandeling + een categorie-gat | `User.lastNudgeAt` > 14 dagen (gate-throttle); alleen gestamped bij verzonden |
| **Contract-einde radar** (#2) | `contract-radar` — `0 11 * * *` (dagelijks) | bill met `contractEndDate` over 30-45 dagen, niet eerder gealerteerd, user niet opted-out | `Bill.contractAlertSentAt` (alleen gezet bij verzonden → declined gate retried morgen) |
| **Maandelijks geld-rapport** (#3) | `monthly-report` — `0 9 1 * *` (1e vd maand 9u) | user met ≥1 bill, niet opted-out | `User.lastMonthlyReportAt` in dezelfde kalendermaand → skip (`sameMonth`-guard) |

Alle drie de crons:
- staan in `vercel.json` en zitten achter **`CRON_SECRET`** via de gedeelde
  `authorizeCron()` (fail-closed op productie, v20) + acquire/release
  `CronRunLog`-lock + `logCronEvent` start/done observability;
- versturen **uitsluitend** via `sendRetentionEmail` → opt-out + unsubscribe
  zijn dus per definitie gegarandeerd op élke mail;
- stampen hun idempotency-veld **alleen** bij een daadwerkelijk verzonden
  mail (declined/throttled → geen stamp → nette retry volgende run);
- zijn ook toegevoegd aan `/api/admin/cron-status` + de cron-auth
  source-guard test.

## ✅ Bevestiging anti-spam

- Élke retentie-mail respecteert `marketingOptOut` (de gate weigert anders).
- Élke retentie-mail bevat een unsubscribe-link (footer door de gate
  toegevoegd, niet door de cron).
- Geen enkele cron roept `sendEmail()` direct aan — altijd via de gate.
- Crons zijn idempotent (timestamp-velden + `CronRunLog`-lock) → een
  dubbele run stuurt nooit dezelfde mail twee keer.

## DEEL 5 — dashboard

`/dashboard` heeft een **"Bespaard over tijd"**-sectie: een lichte CSS-
bar-chart van cumulatieve besparing per maand (geen client-JS) + een
mijlpaal-regel ("Je zit op €X — huishoudens als jij besparen ~€Y meer op
hun {categorie}") die naar de hoogste-waarde ontbrekende categorie wijst.
Sluit aan op #1 via `pickNudgeCategory` + de bestaande `CategoryUploadGrid`
eronder. Puur presentatie op bestaande stats.

## Test-totaal

- `npx tsc --noEmit`: **clean**.
- `npm test -- --run`: **1692 passed**, 2 failed = de bekende pre-existing
  FAQ-failures (commit `b351a61`, BACKLOG — buiten scope).
- Nieuwe v21-tests: notify-gate (6), category-gap (5), category-nudge-cron
  (4), contract-end (5), contract-radar-cron (4), monthly-report-cron (5),
  savings-timeline (4).

## Restpunten (bewust later)

- **Contract-einddatum: gedetecteerd vs geschat.** `lib/contract-end.ts`
  detecteert een expliciete datum uit OCR-tekst ("contract loopt tot…",
  "einde looptijd…", "verloopt op…"); anders schat = `invoiceDate + 12mnd`.
  Het onderscheid wordt **nu niet** apart op de Bill opgeslagen (geen
  `isEstimate`-kolom) — de radar behandelt beide gelijk. Toekomstige
  uitbreiding: een `contractEndEstimated` boolean + zachtere copy bij een
  schatting. De inbound-bill-aanmaak (`lib/inbound-handler.ts`) vult
  `contractEndDate` nog niet (alleen de upload-route via `billDataFromOcr`).
- **#4 echte her-check** — een cron die de markt opnieuw scant en de
  besparing herberekent (nu alleen de nudge "kan opnieuw gecheckt worden").
- **#5 referral-versterking** — de retentie-mails koppelen aan de
  bestaande referral-flow (extra gratis onderhandeling bij doorverwijzen).

## 🧑 EIGENAAR — handmatige stappen

1. **Vercel env**: bevestig dat `CRON_SECRET` gezet is (de 3 nieuwe crons
   weigeren anders op productie — bewust). `EMAIL_FROM` blijft het
   geverifieerde `hallo@degeldheld.com`.
2. **Vercel → Crons**: controleer dat `category-nudge`, `contract-radar` en
   `monthly-report` op hun schema staan na deploy.
3. Niets aan DNS/Resend nodig voor v21 — hergebruikt de bestaande
   mail-helper + het geverifieerde from-adres.

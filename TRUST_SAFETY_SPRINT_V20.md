# DeGeldHeld v20 — Trust & Safety Sprint

**Draai dit ná v18.** (v19 auto-fee mag later — die zit vast op live
Stripe. v20 heeft geen blocker.) Wanneer v19 later draait, moeten z'n
nieuwe payment-surfaces — de `/api/fee-setup` route + `User.feePaymentMethodId`
— alsnog door de IDOR-audit (DEEL 3) en GDPR-deletion (DEEL 6) heen.
Laatste serieuze hardening-ronde vóór launch:
zichtbaarheid (Sentry), deliverability (e-mail), security (IDOR/XSS),
betrouwbaarheid (crons), en privacy (GDPR). PSD2 valt **buiten scope**
(eigenaar pakt dat later).

**Splitsing code vs eigenaar:** sommige delen kan code niet alleen —
DNS-records, externe dashboards. Die markeer ik met 🧑 **EIGENAAR** en
verzamel ik onderaan + in V20_REPORT.md. De rest doet Claude Code volledig.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/TRUST_SAFETY_SPRINT_V20.md en voer alle deeltaken uit in volgorde. Per deeltaak: implementeer de code-delen, run tests (npm test + npx tsc --noEmit), bij fail fix tot groen, commit + push. Delen gemarkeerd met EIGENAAR kun jij niet doen (DNS/externe dashboards) — implementeer wat code-kant kan (checks, validaties, docs) en verzamel de handmatige stappen in V20_REPORT.md. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 25 min: TODO-commit en door. Eindig met V20_REPORT.md inclusief een duidelijke "EIGENAAR — handmatige stappen" sectie.
```

---

## DEEL 1 — Sentry naar het juiste project

De DSN wees naar "alpha rader pro" i.p.v. DeGeldHeld → productie-fouten
komen nu niet binnen.

a. **Code:** verifieer dat `sentry.{client,server,edge}.config.ts` de DSN
   uit env leest (doet 'ie al). Voeg toe: `environment` (production/
   preview) + `release` tagging zodat events herkenbaar zijn. Zorg dat
   `tracesSampleRate` redelijk laag is (0.1) om quota te sparen.

b. **Code:** verbeter `/api/test-sentry` zodat 'ie een herkenbare test-
   error met tag `{ test: true }` gooit én in de response teruggeeft of
   de DSN geconfigureerd is (zonder de DSN zelf te lekken — alleen
   `configured: true/false`).

c. 🧑 **EIGENAAR:** maak/selecteer het juiste DeGeldHeld-project op
   sentry.io, kopieer de DSN, zet in Vercel `SENTRY_DSN` +
   `NEXT_PUBLIC_SENTRY_DSN`, redeploy. Daarna `GET /api/test-sentry?fire=1`
   → event moet in het DeGeldHeld-project verschijnen. (Documenteer in
   rapport.)

d. Commit: `fix(sentry): environment+release tagging + safe test endpoint`.

---

## DEEL 2 — E-mail deliverability

Magic-links in spam = geen signups, en je merkt het niet.

a. **Code:** controleer dat álle uitgaande mail (magic-link via NextAuth/
   Resend, transactioneel via `lib/email.ts`) een `from`-adres op het
   geverifieerde domein gebruikt (bv `hallo@degeldheld.com`), niet een
   resend.dev test-adres. Centraliseer het from-adres in één constant.

b. **Code:** voeg aan `/api/health` een `email`-sectie toe die checkt of
   `RESEND_API_KEY` gezet is + welk from-domein gebruikt wordt (geen
   secrets lekken).

c. **Code:** documenteer in `RUNBOOK.md` welke DNS-records nodig zijn en
   hoe je deliverability test (mail-tester.com of vergelijkbaar).

d. 🧑 **EIGENAAR:** in Resend → domein `degeldheld.com` toevoegen +
   verifiëren. Resend geeft DNS-records (SPF TXT, DKIM CNAME(s),
   DMARC TXT) → toevoegen in Cloudflare DNS. Wachten op groen vinkje.
   (Exacte records in rapport.)

e. Commit: `fix(email): single verified from-address + deliverability health check`.

---

## DEEL 3 — IDOR / authorization-audit

`/api/bills/[id]` scope't al op `{ id, userId }` ✓ — maar audit ÉLKE
resource-route die een id/slug aanneemt.

a. **Code:** loop door alle routes onder `app/api/` die een id-param of
   body-id nemen (bills, negotiations, outcome, proof, checkout, pay,
   round, account, referral, admin). Per route: bevestig dat 'ie scope't
   op de ingelogde `userId` OF de `anonymousSessionId` — nooit een kale
   `findUnique({ where: { id } })` zonder eigenaarscheck die data
   teruggeeft.

b. **Code:** tests `tests/security-idor.test.ts`: voor elke gevoelige
   route, user A maakt resource, user B (andere sessie) probeert 'm op te
   halen/wijzigen → verwacht 403/404, nooit de data.

c. **Code:** speciale aandacht: anonieme bills (`anonymousSessionId`) —
   visitor B met een geraden billId mag visitor A's bill niet zien
   (de analyse-page doet dit goed; check de API-routes ook).

d. **Code:** admin-routes (`app/admin`, `/api/admin/*`) — bevestig dat ze
   `ADMIN_EMAILS` afdwingen, niet alleen "ingelogd".

e. Commit: `test(security): IDOR audit across all resource + admin routes`.

---

## DEEL 4 — XSS / output-escaping

De onderhandel-mail rendert HTML (`lib/email_templates.ts`) met door OCR
gelezen content (providernaam, plan, klantnummer, rawOcr) → injectie-risico.

a. **Code:** audit `lib/email.ts` + `lib/email_templates.ts`: élke
   interpolatie van OCR/user-content in een HTML-mail moet ge-escaped
   worden (HTML-entities). Voeg een `escapeHtml()` helper toe en pas 'm
   toe op alle dynamische velden in mail-templates.

b. **Code:** audit React-pagina's op `dangerouslySetInnerHTML` waar
   OCR/user-content in zit (React escapet standaard, maar dit omzeilt
   dat). Repareer of bevestig veilig.

c. **Code:** check dat providernaam/plan/klantnummer ook in de
   onderhandel-mail-BODY (tekst die naar de provider gaat) geen
   prompt-injectie of rare payloads doorlaat die de LLM-output kapen.
   Basis-sanitization op lengte + verdachte tokens.

d. **Code:** tests `tests/security-xss.test.ts`: voer een bill met
   `provider: "<script>alert(1)</script>"` en `plan: "\"><img onerror>"`
   door de mail-template → output bevat ge-escapete entities, geen live
   tags.

e. Commit: `fix(security): escape OCR content in HTML emails + XSS tests`.

---

## DEEL 5 — Cron-betrouwbaarheid + observability

7 crons (follow-up, outcome-followup, monthly-recheck, recheck-savings,
fraud-check, cleanup-anonymous, psd2-sync), nooit geverifieerd in prod.
PSD2 buiten scope — laat die route met rust maar neem 'm wel mee in de
CRON_SECRET-check.

a. **Code:** bevestig dat ÉLKE `app/api/cron/*` route `CRON_SECRET`
   afdwingt (header `Authorization: Bearer ${CRON_SECRET}` of Vercel's
   cron-header) en een 401 geeft zonder. Geen open cron-endpoints.

b. **Code:** voeg gestructureerde logging toe aan elke cron: start, einde,
   aantal verwerkte records, duur. Optioneel: een `CronRun`-tabel
   (`name, startedAt, finishedAt, processed, ok`) zodat je in de DB kunt
   zien dat ze draaiden + een mini `/api/admin/cron-status` (admin-only).

c. **Code:** tests dat elke cron zonder secret 401 geeft, en met secret
   z'n kernlogica draait (mock DB waar nodig).

d. 🧑 **EIGENAAR:** na deploy, check Vercel → project → Crons (of Logs)
   dat de jobs daadwerkelijk afvuren op hun schema. (Checklist in rapport.)

e. Commit: `feat(cron): enforce CRON_SECRET + run observability on all jobs`.

---

## DEEL 6 — GDPR-compleetheid

Account-verwijdering gebruikt een transactie maar `bill.updateMany`
(anonimiseren i.p.v. verwijderen) — verifieer dat dit écht alle
persoonsdata dekt.

a. **Code:** audit `app/api/account/delete/route.ts`: na verwijdering mag
   er GEEN herleidbare persoonsdata overblijven in user, bills,
   negotiations, outcomeProof, payments, referrals, ocrTrainingSample,
   sessions, accounts. Anonimiseren mag, mits onomkeerbaar (geen e-mail/
   naam/klantnummer meer). Vul ontbrekende tabellen aan.

b. **Code:** tests `tests/gdpr-deletion.test.ts`: maak user met data in
   alle tabellen → delete → assert geen herleidbare PII meer over.

c. **Code:** data-export endpoint `GET /api/account/export` (auth) →
   JSON met alle data van de user (recht op dataportabiliteit). Tonen op
   `/account` als knop "Download mijn gegevens".

d. **Code:** bevestig dat de `cleanup-anonymous` cron oude niet-geclaimde
   anonieme bills écht verwijdert (test de query).

e. Commit: `feat(gdpr): complete account deletion + data export + tests`.

---

## DEEL 7 — Inbound e-mail echt pad

`/api/inbound`, `/api/inbound/proof`, `/api/inbound/router` — bewijs-mails
+ provider-antwoorden. Alleen gemockt in v16.

a. **Code:** bevestig signature-verificatie op alle inbound-webhooks
   (`RESEND_INBOUND_SECRET` / `RESEND_PROOF_WEBHOOK_SECRET`) — weiger
   ongesigneerde payloads met 401. Geen open inbound-endpoints.

b. **Code:** robuuste parsing-tests met realistische payloads: provider-
   antwoord matcht op juiste negotiation; bewijs-mail matcht op billId +
   zet `proofVerifiedAt`; rommel/spam → nette no-op, geen crash.

c. **Code:** documenteer het hele inbound-pad in `RUNBOOK.md`.

d. 🧑 **EIGENAAR:** DNS MX-records voor de inbound-subdomeinen
   (`auto.degeldheld.com`, `bewijs.degeldheld.com`) in Cloudflare +
   Resend Inbound configureren. (Exacte records in rapport.) Dit is nodig
   voordat de bewijs-flow (= je fee-trigger) live werkt.

e. Commit: `fix(inbound): enforce webhook signatures + robust parsing tests`.

---

## DEEL 8 — Aggregate + rapport

a. Run alles: `npm test -- --run` + `npx tsc --noEmit` +
   `npx playwright test tests/e2e/`. Alles groen.

b. `V20_REPORT.md` met:
   - Per deel: wat code-kant gefixt is + gevonden issues + commit-hashes
   - **Grote sectie "🧑 EIGENAAR — handmatige stappen"** met exacte acties:
     1. Sentry: project + DSN → Vercel
     2. E-mail: Resend domein-verificatie + exacte SPF/DKIM/DMARC records
        voor Cloudflare
     3. Crons: waar in Vercel te checken dat ze draaien
     4. Inbound: MX-records + Resend Inbound config
   - Wat NIET in scope viel: PSD2 (bewust uitgesteld)

c. Commit: `docs(v20): trust & safety verified + owner action list`.

---

## Done-criteria

- [ ] Sentry: env+release tagging, veilig test-endpoint (DSN-flip = eigenaar)
- [ ] E-mail: één geverifieerd from-adres + health-check (DNS = eigenaar)
- [ ] IDOR: alle resource-routes scope-getest, admin-routes afgedwongen
- [ ] XSS: OCR-content ge-escaped in HTML-mails + tests
- [ ] Crons: CRON_SECRET afgedwongen + observability + tests
- [ ] GDPR: volledige deletion + data-export + tests
- [ ] Inbound: signature-verificatie + parsing-tests (DNS = eigenaar)
- [ ] `npm test` + `npx tsc --noEmit` + e2e groen
- [ ] V20_REPORT.md met eigenaar-stappenlijst

## Eindrapportage

```
TRUST_SAFETY_V20 — Final report

DEEL 1  ✓ <hash> — Sentry tagging + test-endpoint
DEEL 2  ✓ <hash> — e-mail from-adres + deliverability check
DEEL 3  ✓ <hash> — IDOR-audit alle routes
DEEL 4  ✓ <hash> — XSS-escaping in mails
DEEL 5  ✓ <hash> — cron secret + observability
DEEL 6  ✓ <hash> — GDPR deletion + export
DEEL 7  ✓ <hash> — inbound signature + parsing
DEEL 8  ✓ <hash> — rapport + eigenaar-stappen
```

**Na deze sprint: je ziet productie-fouten (Sentry), mail komt aan,
data is afgeschermd + privacy-proof, crons zijn dicht + zichtbaar, en
de bewijs-flow is veilig. Klaar om écht mensen binnen te laten.**

# V25_REPORT — Relay-completion sprint (onderhandelen namens de klant)

**Datum:** 2026-05-21
**Branch:** main
**Commits:** `1774605` · `e30b63d` · `4a54c10` · `a84b846` · `5b7331c` · `8415277` · `25a3cf7` · `<dit report>`
**Co-author trailer:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` op elke commit.

> **De relay staat UIT.** Alles is gebouwd achter `FEATURE_RELAY_ENABLED`
> (default `false`). De eigenaar zet 'm pas aan ná juridische toetsing — zie de
> EIGENAAR-stappen onderaan.

---

## QA-gate (per deeltaak gedraaid, allemaal EXIT 0)

| Gate | Resultaat |
|------|-----------|
| `npm test` (vitest) | **1818 passed** / 198 files |
| `npx tsc --noEmit` | **EXIT 0** |
| `npm run build` | **EXIT 0** |
| `npx playwright test` | **55 passed / 2 failed / 1 skipped** — zie noot |

> **Geen** `--no-verify`, **geen** `--force`. Pre-commit hook draaide op elke commit.

### Noot over de 2 e2e-failures (pre-existing, niet V25)
`tests/e2e/multi-round.spec.ts` heeft 2 falende tests
(`plak provider-response` + `outcome: token-link werkt zonder login`). Beide
falen op een server-side redirect naar `/login` die plaatsvindt vóór enige
relay-code: de Playwright `webServer` krijgt geen `OUTCOME_TOKEN_SECRET` /
`NEXTAUTH_SECRET` mee (alleen `GROQ_VISION_MOCK`), dus het HMAC-token en de
sessie-cookie uit het test-proces worden afgewezen. Dit zijn **exact dezelfde
2 failures als in V24** (toen al bewezen pre-existing). Mijn V25-commits
(`1774605..HEAD`) raken deze flow niet — `git diff` toont 0 wijzigingen aan
`uitkomst`/`outcome`/`nextauth`/`multi-round`. De relay-flag staat in e2e
bovendien uit, dus er is geen relay-UI in het spel.

**TODO (EIGENAAR, los van V25):** geef de e2e-`webServer` in
`playwright.config.ts` ook `OUTCOME_TOKEN_SECRET` + `NEXTAUTH_SECRET` mee.

---

## Bevestigde guardrails (niet verzwakt)

- **GUARDRAIL 2 — CONSENT-FIRST.** Elke relay-mail passeert `canRelaySend()`
  (`relayAuthorizedAt` **én** `relayState === "RELAY_ACTIVE"`). Bewezen in
  relay-send + e2e-loop (paused → niets naar de provider).
- **GUARDRAIL 3 — NOOIT auto-accept.** `relayDecision()` geeft nooit een
  automatische accept; deal/commitment/account-holder-vraag/loop-guard →
  `AWAITING_APPROVAL`. Bewezen in relay-core, relay-inbound, relay-thread, e2e.
- **GUARDRAIL 4 — KAART VERPLICHT.** `relay-authorize` → 409 `card-required`
  zonder `feePaymentMethodId` + `feeMandateAcceptedAt`. De consent-UI toont dan
  de kaart-koppel-stap i.p.v. de start-knop.
- **GUARDRAIL 5 — geen gehallucineerde adressen.** `lib/relay-providers.ts`
  bevat alleen op de officiële contactpagina geverifieerde adressen (elk met
  `// bron:`); een regex-test faalt op een entry zonder bron.
- **GUARDRAIL 7 — flag-gate.** `FEATURE_RELAY_ENABLED` (default `false`) gate
  alle entrypoints; default-off afgedwongen door een test.

---

## Wat elk deel bouwde

### DEEL 0 — flag + kaart-gate (`1774605`)
`RELAY_ENABLED: false` in `FLAG_DEFAULTS`. Gate op `relay-authorize`,
`relay-approve`, `relay-pause` (→ 404 disabled), de status-pagina (`notFound`)
en de consent-prompt-zichtbaarheid (email-pagina). `relay-authorize` eist een
fee-kaart + geaccepteerd mandaat (→ 409 `card-required`). Tests:
relay-authorize, relay-pause, relay-guards.

### DEEL 1 — sourced provider-adresregister (`e30b63d`)
`lib/relay-providers.ts` — geverifieerd via WebFetch op de officiële
contactpagina's (2026-05-21):

| Provider | Adres | Bron |
|----------|-------|------|
| Vattenfall | vattenfall@vattenfall.nl | vattenfall.nl/service/contact |
| Greenchoice | vragen@greenchoice.nl | greenchoice.nl/klantenservice/contact |
| Pure Energie | info@pure-energie.nl | pure-energie.nl/klantenservice |
| Engie | klantenservice.nl@engie.com | engie.nl/klantenservice |
| Freedom Internet | helpdesk@freedomnet.nl | freedom.nl/contact |

Bewust **weggelaten** (officiële site toont géén publiek e-mailadres → handmatige
invoer): KPN, Vodafone, Odido, Ziggo, Tele2, Simyo, Ben, Eneco, Essent, Frank
Energie, Vandebron (link-masked), Energiedirect, Oxxio. Anti-hallucinatie-test
borgt dat elke entry een `// bron:` heeft.

### DEEL 2 — consent-UI vult/leidt het adres af (`4a54c10`) — de ontbrekende schakel
`RelayConsentPrompt` resolved nu het provider-adres (registry → automatisch
meesturen; onbekend → invoerveld met validatie), gate't op de fee-kaart (anders
de kaart-koppel-stap), toont de exacte `relayMandateText` + checkbox, en post
`{ providerEmail }` → `relay-authorize` → `sendFirstRelayMail`. Hiermee verlaat
de eerste mail eindelijk het systeem. Tests: relay-consent-prompt.

### DEEL 3 — send/ontvang/counter-lus gehardend (`a84b846`)
RFC-5322: `From` = "{klant} via DeGeldHeld <verified@domein>" (alignment),
`References` = thread Message-ID, `Reply-To` = onderhandel+<token>@, subject
`[NEGOTIATION-<id>]`, data-minimale body. Volledige thread-simulatie
(relay-thread): 5 counters → loop-guard → approval; deal → approval; account-
holder → approval; walk_away → PAUSED.

### DEEL 4 — transparantie + controle (`5b7331c`)
Status-pagina toont de volledige thread met **tijdstempels** + rondenummers,
de live status en Accepteer/Blijf-onderhandelen/Stop + Pauzeer/Hervat,
owner-scoped. `relay-approve` accept → acceptatie-mail + `DONE` en zet **nooit**
`actualSavingsCents`/`proofVerifiedAt` (besparing telt alleen via `/bewijs`).
Klant-notificatie elke ronde + elke goedkeuring-nodig (geen PII).

### DEEL 5 — e2e-harnas + deliverability (`8415277`)
`tests/e2e-relay-loop.test.ts` draait de hele lus tegen een gesimuleerde
provider-mailbox (alleen db/mail/auth/flag/LLM gemockt): authorize → send →
counter → deal → mens-accepteert → DONE, plus alle guardrails. `tests/
relay-deliverability.test.ts`: From blijft op het geverifieerde domein,
header-injectie-sanitisatie, en de reply-to/Message-ID/References round-trippen
terug naar de juiste negotiation.

### DEEL 6 — flag-bedrading + eigenaar-stappen (`25a3cf7`)
Bevestigd dat de flag élke entrypoint gate (incl. de email-pagina) +
`FLAG_DEFAULTS.RELAY_ENABLED === false` (test). `docs/MACHTIGING.md` uitgebreid
met de v25-gates + eigenaar-restpunten.

### DEEL 7 — aggregate + dit rapport (`<dit report>`)

---

## EIGENAAR-stappen (relay live zetten)

1. **Jurist/DPO-review** van `docs/MACHTIGING.md` (volmacht, art. 3:60/3:66/3:72
   BW), `/voorwaarden` en `/privacy` (de provider als ontvanger van klantnaam +
   klantnummer + factuurcontext). **Pas hierna verder.**
2. **Bevestig de adressen** in `lib/relay-providers.ts` (steekproef op de
   officiële contactpagina's) en vul aan waar inmiddels een publiek adres bestaat.
3. **`CRON_SECRET`** voor `relay-reminders` staat al gezet — verifieer in Vercel.
4. **SPF/DKIM/DMARC** op `degeldheld.com` (Resend) bevestigen zodat mails namens
   de klant niet in spam landen. De relay-`From` blijft op dit geverifieerde
   domein (alignment), dus geen extra DNS nodig — alleen verifiëren.
5. **`FEATURE_RELAY_ENABLED=true`** in Vercel zetten + redeploy — **pas ná stap 1.**
6. **Monitor de eerste 5 echte threads** (status-pagina + Resend-logs) vóór
   brede uitrol; pauzeer direct bij iets onverwachts.

---

## Done-criteria
- [x] Relay end-to-end bruikbaar achter `FEATURE_RELAY_ENABLED` (authorize +
      kaart + adres → send → ontvang → auto-counter → goedkeuren → klaar)
- [x] Kaart-op-bestand verplicht vóór `relay-authorize`
- [x] Accepteert nooit automatisch; elke deal → klant-goedkeuring
- [x] Provider-adresregister sourced + handmatige fallback
- [x] Volledige transparantie (thread + tijdstempels) + pauzeer/stop
- [x] `npm test` + `npx tsc --noEmit` + `npm run build` (EXIT 0); e2e groen op
      de 2 pre-existing harness-failures na
- [x] `V25_REPORT.md` met jurist-review + flag-aanzetten eigenaar-stappen
- [x] `FEATURE_RELAY_ENABLED` blijft **UIT**

# V26_REPORT — Relay: correcte provider-adressen (telecom) + "bij twijfel handmatig"

**Datum:** 2026-05-22
**Branch:** main
**Commits:** `69e2fb8` · `ef5ccce` · `29475b5` · `<dit report>`
**Co-author trailer:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` op elke commit.

> **De relay staat nog UIT** (`FEATURE_RELAY_ENABLED`, default `false`). Deze
> sprint maakt het provider-adres betrouwbaar; daarna kan de eigenaar de flag
> aanzetten — zie de EIGENAAR-stap onderaan.

---

## QA-gate (per deeltaak gedraaid, allemaal EXIT 0)

| Gate | Resultaat |
|------|-----------|
| `npm test` (vitest) | **1830 passed** / 199 files |
| `npx tsc --noEmit` | **EXIT 0** |
| `npm run build` | **EXIT 0** |
| `npx playwright test` | **55 passed / 2 failed / 1 skipped** — zie noot |

> **Geen** `--no-verify`, **geen** `--force`. Pre-commit hook draaide op elke commit.

### Noot over de 2 e2e-failures (pre-existing, niet V26)
`tests/e2e/multi-round.spec.ts` (2×) faalt op een server-side `/login`-redirect
omdat de Playwright `webServer` geen `OUTCOME_TOKEN_SECRET`/`NEXTAUTH_SECRET`
meekrijgt — **exact dezelfde failures als V24 en V25**. `git diff 69e2fb8^..HEAD`
raakt die flow niet (0 wijzigingen aan `uitkomst`/`outcome`/`nextauth`/
`multi-round`), en de relay-flag staat in e2e uit. **TODO (EIGENAAR):** geef de
e2e-`webServer` die twee secrets mee in `playwright.config.ts`.

---

## Geverifieerd TOEGEVOEGD deze sprint (met bron)

**Geen.** Alle in DEEL 1 onderzochte telecom/energie-providers tonen op hun
officiële site **geen** publiek onderhandel-e-mailadres, of waren niet te
verifiëren. Conform de guardrail ("twijfel = weglaten, liever handmatig dan
gokken") is er **niets** toegevoegd aan de e-mail-tabel. Het bestaande
(V25-)register blijft:

| Provider | Adres | Bron |
|----------|-------|------|
| Vattenfall | vattenfall@vattenfall.nl | vattenfall.nl/service/contact |
| Greenchoice | vragen@greenchoice.nl | greenchoice.nl/klantenservice/contact |
| Pure Energie | info@pure-energie.nl | pure-energie.nl/klantenservice |
| Engie | klantenservice.nl@engie.com | engie.nl/klantenservice |
| Freedom Internet | helpdesk@freedomnet.nl | freedom.nl/contact |

## Bewust gemarkeerd als "geen e-mail" (officiële site → alleen app/telefoon/formulier)

`RELAY_NO_EMAIL_PROVIDERS` (elk met `// bron:`), zodat de UI eerlijk is:

- **Telecom:** KPN, Vodafone, Odido, Ziggo, Simyo, Tele2, Youfone,
  Hollandsnieuwe, Budget Mobiel
- **Energie:** Eneco, Essent, Frank Energie, Energiedirect, Oxxio, Budget Energie

## Niet te verifiëren → bewust "unknown" (handmatige invoer, niet aangenomen)
Ben, Lebara, Lyca Mobile (officiële pagina gaf HTTP 403), Vandebron (e-mailadres
op de site link-masked). Deze worden **niet** als no-email gemarkeerd en **niet**
gegokt — de klant voert het adres zelf in.

---

## Wat elk deel bouwde

### DEEL 1 — register verdiept + no-email channel-map (`69e2fb8`)
WebFetch-onderzoek; geen nieuw adres betrouwbaar gevonden → niets toegevoegd.
Nieuw: `RELAY_NO_EMAIL_PROVIDERS` (gesourcet, met `note`) +
`relayProviderChannel()` → `"email" | "no-email" | "unknown"` +
`relayNoEmailNote()`. Anti-hallucinatie-test dekt nu élke entry (email én
no-email) op een `// bron:`.

### DEEL 2 — confirm-before-send + verplichte invoer bij twijfel (`ef5ccce`)
Consent-UI: geverifieerd adres → "We mailen namens jou naar `<adres>` — klopt
dit?" met **Bevestig / Wijzig** (Start pas ná bevestiging); geen hit →
**verplicht** invoerveld + validatie; no-email → eerlijke melding + verplicht
adres. `relay-authorize` geeft **409 `address-required`** zonder bevestigd/
ingevoerd adres — de eerste relay-mail gaat nooit zonder adres de deur uit.

### DEEL 3 — adres-sanity-guard (`29475b5`)
`relayAddressSanity()` hard-weigert no-reply/do-not-reply + malformed adressen
(in `relay-authorize` → 409, en in `sendRelayMail` als defense-in-depth).
`relayDomainLooksOff()` is een **advies**-heuristiek (domein-mismatch), bewust
niet hard-blokkerend om false positives te voorkomen.

### DEEL 4 — aggregate + dit rapport (`<dit report>`)

---

## Done-criteria
- [x] Extra geverifieerde adressen toegevoegd (met bron); twijfel = weggelaten
      → **0 toegevoegd, alles gesourcet of bewust weggelaten**
- [x] "Geen e-mail"-providers gemarkeerd → UI zet de verwachting eerlijk
- [x] Register-hit → **bevestig-stap**; geen hit → **verplichte handmatige invoer**
- [x] Eerste relay-mail gaat NOOIT zonder geverifieerd/bevestigd adres (409)
- [x] Adres-sanity (geen noreply / advies bij vreemd domein)
- [x] `npm test` + `npx tsc --noEmit` + `npm run build` (EXIT 0); e2e groen op
      de 2 pre-existing harness-failures na
- [x] `V26_REPORT.md` + EIGENAAR-stap

---

## EIGENAAR-stap — relay aanzetten

Na deze sprint mailt de relay alléén naar een correct geverifieerd óf door de
klant bevestigd adres, en bij twijfel voert de klant het zelf in. Daarmee kan de
flag veilig aan:

1. **`FEATURE_RELAY_ENABLED=true`** in Vercel (Production) → **redeploy**.
2. **Monitor de eerste 5 echte threads** (status-pagina `/onderhandel/[bill]/relay`
   + Resend-logs): klopt het adres, komt het antwoord terug op
   `onderhandel+<token>@`, en stopt de relay netjes bij een deal
   (`AWAITING_APPROVAL`)? Pauzeer direct bij iets onverwachts.
3. Vul het register aan zodra een provider alsnog een publiek adres publiceert
   (met `// bron:`), of verplaats 'm tussen `email` / `no-email` op basis van de
   officiële site.

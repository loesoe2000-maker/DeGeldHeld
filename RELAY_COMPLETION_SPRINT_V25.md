# DeGeldHeld v25 — Relay (onderhandelen namens de klant) compleet + bruikbaar

De relay-kern bestaat al (v23: `lib/relay.ts`, `relay-authorize`, `relay-send`,
`relay-inbound`, `relay-approve`, inbound-routing op `onderhandel+<token>@`),
maar is **end-to-end nog niet bruikbaar**:

1. De consent-knop (`components/RelayConsentPrompt.tsx`) post een **lege body**
   → geen `providerEmail` → `sendFirstRelayMail` vuurt nooit → er gaat niks de
   deur uit. **Dit is de ontbrekende schakel.**
2. Er is **geen provider-e-mailregister**, dus zelfs mét de UI moet het adres
   ergens vandaan komen.
3. De relay is **niet achter een kaart-gate** — terwijl "wij doen het werk"
   betekent dat een bewezen besparing afschrijfbaar moet zijn (anders revenue-leak).
4. De volledige lus (send → ontvang → auto-counter → goedkeuring → klaar) is
   **nooit end-to-end getest**.
5. De relay hoort **niet live** te zijn vóór juridische toetsing van de volmacht.

Deze sprint maakt de relay compleet, veilig en bruikbaar — **achter een
feature-flag die UIT blijft tot een jurist de volmacht heeft getoetst**.

**Draai dit ná de huidige `main`** (off-session-fix + rate-limit staan live).

---

## ⚠️ GUARDRAILS (niet onderhandelbaar — relay raakt geld én handelt namens de klant)

1. **`npm run build` (EXIT 0) + `npx tsc --noEmit` + `npm test` groen vóór élke commit.**
2. **CONSENT-FIRST, ALTIJD.** Geen enkele relay-mail verlaat het systeem zonder
   `canRelaySend()` (`relayAuthorizedAt` **én** `relayState === "RELAY_ACTIVE"`).
   De v23-guardrail blijft; verzwak 'm nooit.
3. **NOOIT automatisch een deal accepteren of een definitieve mail sturen.**
   `relayDecision()` mag **nooit** auto-accept teruggeven. Deal / commitment /
   "bent u de contracthouder?" / loop-guard → **`AWAITING_APPROVAL`**. Mens-in-
   de-lus bij élke verbintenis.
4. **KAART VERPLICHT vóór relay.** Relay = wij doen het werk → een bewezen
   besparing moet afschrijfbaar zijn. `relay-authorize` MOET een gekoppelde
   fee-kaart eisen (`feePaymentMethodId` + `feeMandateAcceptedAt`). Geen kaart →
   geen relay (stuur naar de kaart-koppel-stap).
5. **GÉÉN gehallucineerde provider-adressen.** Het register bevat alleen
   geverifieerde adressen (WebFetch de officiële contactpagina; per entry een
   `// bron: <URL>`-comment). Niet zeker → adres weglaten → handmatige invoer.
6. **AVG / data-minimalisatie.** De relay-mail bevat alleen wat nodig is om te
   onderhandelen (klantnaam, klantnummer, huidig contract/bedrag). **Nooit** de
   factuur-afbeelding, nooit kaart/financiële data. Maskeer in analytics
   (`.ph-no-capture`).
7. **Volmacht = OWNER/jurist-gate.** Bouw achter **`FEATURE_RELAY_ENABLED`
   (default `false`)**. **Zet 'm NIET aan.** De machtigingstekst + voorwaarden +
   privacyverklaring moeten juridisch getoetst zijn vóór activering
   (`docs/MACHTIGING.md`).
8. Geen `--no-verify`, geen `--force`. Co-author trailer:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## START
```
Lees /Users/bdb/alpharadar-pro/degeldheld/RELAY_COMPLETION_SPRINT_V25.md en voer alle deeltaken in volgorde uit. Per deel: npm test + npx tsc --noEmit + npm run build (EXIT 0) groen vóór de commit. De guardrails (consent-first, kaart-verplicht, NOOIT auto-accept) mogen NOOIT verzwakt worden. Geen gehallucineerde provider-adressen — sourced of weglaten. Bouw achter FEATURE_RELAY_ENABLED (default false) en zet 'm NIET aan. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force. Bij blocker na 30 min: TODO-commit en door. Eindig met V25_REPORT.md inclusief EIGENAAR-stappen (jurist-review + flag aanzetten).
```

---

## DEEL 0 — Feature-flag + kaart-verplicht-gate

a. Voeg `RELAY_ENABLED: false` toe aan `FLAG_DEFAULTS` in `lib/feature-flags.ts`
   (env-var `FEATURE_RELAY_ENABLED`). **Alle** relay-entrypoints worden hierdoor
   gegate: de consent-prompt-zichtbaarheid, `relay-authorize`, de status-pagina,
   `relay-approve`, `relay-pause`. Uit → de bestaande **handmatige** flow blijft
   (kopieer-knop), zónder enige relay-UI.
b. `app/api/negotiations/[id]/relay-authorize/route.ts`:
   - 404/`disabled` als `!isEnabled("RELAY_ENABLED")`.
   - **Kaart-gate:** laad de user; als geen `feePaymentMethodId` óf geen
     `feeMandateAcceptedAt` → **409** `{ reason: "card-required" }`. Geen relay
     zonder afschrijfbare kaart.
c. Tests: flag uit → relay-UI verborgen + authorize geeft disabled; flag aan +
   geen kaart → 409 card-required; flag aan + kaart → toegestaan.
d. Commit: `feat(relay): FEATURE_RELAY_ENABLED gate + card-required before authorize`.

---

## DEEL 1 — Provider-e-mailregister (sourced) + handmatige invoer

a. Maak `lib/relay-providers.ts`: een register dat een canonieke NL-provider
   mapt naar een **geverifieerd** klantenservice-/retentie-e-mailadres, met per
   entry een `// bron: <URL>`-comment. **Alleen** adressen die je via WebFetch op
   de officiële contactpagina bevestigt. Niet zeker → entry weglaten.
   Richt je op de grote NL-providers (telecom/mobiel/internet/energie) die in de
   provider-registry zitten.
b. `relayProviderEmail(providerCanonical: string): string | null` —
   case-insensitive lookup. Onbekend → `null`.
c. Tests: lookup hit/miss; **élke** entry heeft een `// bron:`-comment
   (regex-test die faalt op een entry zonder bron — anti-hallucinatie).
d. Commit: `feat(relay): sourced provider retention-email registry`.

---

## DEEL 2 — Consent-UI vult/leidt het provider-adres af (de ontbrekende schakel)

a. `components/RelayConsentPrompt.tsx`: bij opt-in het provider-adres bepalen —
   eerst `relayProviderEmail(provider)`; gevonden → meesturen (geen invoer
   tonen). Niet gevonden → een **invoerveld** ("E-mailadres klantenservice van
   {provider} — staat vaak op je factuur") met validatie.
b. **Kaart-preflight:** is er nog geen fee-kaart gekoppeld → toon "koppel eerst
   je kaart" met een link naar de kaart-koppel-stap (sluit aan op de DEEL 0-gate
   + de bestaande `EmailPreviewLocked`/`FeeMandatePrompt`).
c. Toon de exacte `relayMandateText(provider)` + link naar `/voorwaarden`. De
   expliciete checkbox blijft verplicht. Post `{ providerEmail }` naar
   `relay-authorize`; die roept (bestaand) `sendFirstRelayMail` aan.
d. Track `relay_authorized` (geen PII).
e. Tests: register-hit → geen invoerveld + authorize krijgt het adres;
   register-miss → invoerveld + validatie (leeg/ongeldig → nette fout);
   geen kaart → kaart-prompt i.p.v. start-knop.
f. Commit: `feat(relay): consent UI resolves provider email (registry + manual)`.

---

## DEEL 3 — De lus send → ontvang → beslis → counter (hardenen + verifiëren)

a. Verifieer `sendFirstRelayMail` (lib/relay-send.ts): correcte RFC-5322 —
   `From` "namens {klant} via DeGeldHeld", `Reply-To` `onderhandel+<token>@`,
   stabiele thread (`providerThreadId`), subject `[NEGOTIATION-<id>]`, een
   **data-minimale** onderhandel-body (geen factuur-afbeelding).
b. Verifieer dat `inbound-handler` `onderhandel+<token>@` → `handleRelayReply`
   routeert → `relayDecision`:
   - `auto_counter` → stuur de volgende counter namens de klant, `relayAutoRounds++`,
     **notificeer de klant elke ronde** (transparantie).
   - `needs_approval` → `AWAITING_APPROVAL` + mail de klant met Accepteer /
     Blijf onderhandelen / Stop (link naar de status-pagina).
   - `stop` (walk_away) → `PAUSED` + klant geïnformeerd.
   - loop-guard `MAX_AUTO_ROUNDS=5` → `needs_approval`.
c. Tests (volledige thread-sim): eerste send → provider "kan niet" →
   `auto_counter` → provider "deal voor €X" → `AWAITING_APPROVAL` (**nooit**
   auto-accept) → klant accepteert → acceptatie-mail + `DONE`. Plus:
   account-holder-vraag → `AWAITING_APPROVAL`; walk_away → `PAUSED`; loop-guard
   op ronde 5.
d. Commit: `feat(relay): harden + verify the send/receive/counter loop`.

---

## DEEL 4 — Transparantie + controle (status-pagina, pauzeer/stop, notificaties)

a. `/onderhandel/[bill]/relay`: toon de **volledige thread** (elke relay-mail +
   provider-antwoord, tijdstempels, rondenummers), de huidige state, en de
   knoppen Accepteer / Blijf onderhandelen / Stop + Pauzeer/Hervat. Alles
   owner-scoped.
b. `relay-approve`: **accept** → acceptatie-mail + `DONE`, maar zet **NOOIT**
   `actualSavingsCents`/`proofVerifiedAt` (besparing blijft via het bewijs-pad
   `/bewijs` → v19-fee). **continue** → volgende ronde (`RELAY_ACTIVE`).
   **stop** → `PAUSED`. pause/resume.
c. Notificaties: elke ronde + elke goedkeuring-nodig → mail de klant (geen PII;
   link naar de status-pagina).
d. Tests: thread rendert; niet-eigenaar → 403; accept → acceptatie-mail + `DONE`
   + **géén** `actualSavings` gezet; pause stopt sends.
e. Commit: `feat(relay): full transparency thread + pause/stop controls`.

---

## DEEL 5 — End-to-end test-harnas + deliverability

a. Een integratietest die de héle lus tegen een **gesimuleerde** provider-mailbox
   draait (geen echte provider): authorize (kaart + providerEmail) → eerste send
   → simuleer provider-antwoorden via de inbound-handler → assert beslissingen +
   state-overgangen + dat **geen** mail zonder consent verstuurd wordt + **nooit**
   auto-accept.
b. Deliverability: bevestig SPF/DKIM/DMARC op het verzend-domein (al gezet) en
   dat de relay-mail valide `From`/`Reply-To`/`Message-ID`/`References` heeft.
   Test op de mail-structuur.
c. Commit: `test(relay): full end-to-end loop harness + deliverability checks`.

---

## DEEL 6 — Feature-flag-bedrading + eigenaar-activering

a. Bevestig dat `FEATURE_RELAY_ENABLED` **alle** relay-entrypoints gate
   (consent-prompt zichtbaarheid, authorize, status-pagina, approve, pause).
   Uit → uitsluitend de handmatige flow, nul relay-UI.
b. `V25_REPORT.md` EIGENAAR-stappen: (1) **jurist-review** van machtiging +
   voorwaarden + privacy (`docs/MACHTIGING.md`); (2) bevestig de adressen in het
   provider-register; (3) `CRON_SECRET` voor `relay-reminders` (al gezet);
   (4) `FEATURE_RELAY_ENABLED=true` in Vercel **pas** na juridisch akkoord;
   (5) monitor de eerste 5 echte threads vóór brede uitrol.
c. Commit: `docs(relay): feature-flag wiring + owner enablement steps`.

---

## DEEL 7 — Aggregate + rapport
a. `npm test -- --run` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** +
   `npx playwright test tests/e2e/`. Alles groen.
b. `V25_REPORT.md`: wat elk deel bouwde, de bevestigde guardrails (consent-first,
   kaart-verplicht, nooit-auto-accept), de register-dekking, en de eigenaar-stappen.
c. Commit: `docs(v25): relay completion verified`.

---

## Done-criteria
- [ ] Relay end-to-end bruikbaar achter `FEATURE_RELAY_ENABLED`: authorize
      (kaart + provider-adres) → send → ontvang → auto-counter → goedkeuren → klaar
- [ ] Kaart-op-bestand **verplicht** vóór `relay-authorize`
- [ ] Accepteert **nooit** automatisch; elke deal/commitment → klant-goedkeuring
- [ ] Provider-adresregister sourced (geen gehallucineerde adressen) + handmatige fallback
- [ ] Volledige transparantie (thread) + pauzeer/stop
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] `V25_REPORT.md` met jurist-review + flag-aanzetten eigenaar-stappen
- [ ] `FEATURE_RELAY_ENABLED` blijft **UIT** (eigenaar zet 'm aan ná juridisch akkoord)

## Eindrapportage
```
RELAY_COMPLETION_V25 — Final report
DEEL 0 ✓ <hash> — feature-flag + kaart-verplicht-gate
DEEL 1 ✓ <hash> — provider-e-mailregister (sourced)
DEEL 2 ✓ <hash> — consent-UI vult provider-adres
DEEL 3 ✓ <hash> — send→ontvang→counter-lus gehardend
DEEL 4 ✓ <hash> — transparantie + controle
DEEL 5 ✓ <hash> — e2e-harnas + deliverability
DEEL 6 ✓ <hash> — feature-flag-bedrading + eigenaar-stappen
DEEL 7 ✓ <hash> — aggregate + rapport
```

**Na deze sprint kan de relay écht onderhandelen namens de klant — veilig
(consent-first, kaart-verplicht, nooit auto-accept), transparant (volledige
thread), en achter een flag die je pas aanzet ná juridische toetsing.**

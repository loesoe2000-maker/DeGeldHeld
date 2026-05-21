# DeGeldHeld v23 — Automatische onderhandeling namens de klant (Optie 2)

**Doel:** de Trim-achtige ervaring — DeGeldHeld stuurt de onderhandel-mails
**namens de klant** naar de provider, provider-antwoorden komen automatisch
binnen en de AI counter't automatisch — **maar de klant keurt de eind-deal
en elke definitieve/committende mail eerst goed.** Routine-counters mogen
automatisch; alles wat een deal vastlegt of besparing finaliseert NIET.

De motor is half gebouwd: `lib/auto-pingpong.ts` (discriminate + dispatch),
de inbound-router voor `[NEGOTIATION-x]`, `lib/email-thread.ts`. Staat uit
(`FEATURE_AUTO_PINGPONG: false`) + de lus is niet gesloten. Dit is bedrading.

## ⚠️ HARDE GUARDRAILS (niet onderhandelbaar)
1. **Toestemming-eerst:** NOOIT een mail namens de klant sturen zonder
   expliciete machtiging (DEEL 1). Geen machtiging = geen relay.
2. **Human-in-the-loop op commitment:** NOOIT automatisch een deal
   accepteren, een definitieve/committende mail sturen, of een besparing
   als "behaald" vastleggen zonder expliciete goedkeuring van de klant
   (DEEL 4). Alleen routine "kun je beter?"-counters mogen auto.
3. **`npm run build` (EXIT 0) vóór élke commit.**
4. **Geen live Stripe-keys.** Alleen telecom/energie/etc. (hyp/verz blijft
   gegate — geen AFM-risico).
5. Migraties met datum-prefix + `prisma migrate deploy` + `generate`.
6. Geen `--no-verify`/`--force`; co-author trailer.

## START
```
Lees /Users/bdb/alpharadar-pro/degeldheld/AUTO_NEGOTIATION_SPRINT_V23.md en voer alle deeltaken in volgorde uit. De HARDE GUARDRAILS (toestemming-eerst + human-in-the-loop op elke deal/definitieve mail) zijn de kern — bouw die als eerste en laat geen pad toe dat ze omzeilt. Per deel: npm test + npx tsc --noEmit + npm run build (EXIT 0) groen voor je commit. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force. Bij blocker na 30 min: TODO-commit en door. Eindig met V23_REPORT.md.
```

---

## DEEL 0 — Juridische basis (volmacht + consument + AVG)

Bouw de machtiging op de juiste juridische grondslag — niet placeholder.
Bronnen: Burgerlijk Wetboek Boek 3 (volmacht) + AVG. Markeer alles als
"concept — jurist laten checken", maar zet de juiste structuur neer.

a. **Volmacht (art. 3:60 BW):** de klant (volmachtgever) machtigt DeGeldHeld
   (gevolmachtigde) om **in zijn naam** rechtshandelingen te verrichten —
   specifiek: namens hem onderhandelen over zijn **bestaande contract** bij
   de genoemde provider. De machtiging-tekst moet dit expliciet zo formuleren.
b. **Scope strikt beperken — KERN:** onder art. 3:66 BW binden de handelingen
   van de gevolmachtigde de volmachtgever. Daarom mag de volmacht **NIET** het
   accepteren/aangaan van een nieuw contract omvatten. De volmacht dekt alleen
   **onderhandelen + corresponderen**; het **accepteren van een deal blijft een
   eigen handeling van de klant** (de goedkeuring-gate in DEEL 4). Leg dit
   expliciet vast in de tekst zodat de klant nooit ongewild gebonden wordt.
c. **Herroepbaar (art. 3:72 BW):** de machtiging eindigt bij herroeping. De
   klant kan 'm **altijd intrekken** (= de pauzeer/stop-knop, DEEL 5). Tekst
   moet dit benoemen.
d. **Consumentenrecht:** duidelijke dienst-voorwaarden, herroepingsrecht op de
   DeGeldHeld-dienst, geen oneerlijke handelspraktijk. Link naar /voorwaarden.
e. **AVG:** grondslag voor het verwerken/relayen van de klantdata =
   uitvoering van de overeenkomst + expliciete toestemming voor de relay.
   Neem op in de privacyverklaring (welke data, waarom, naar wie = provider).
f. Maak `docs/MACHTIGING.md` met de concept-tekst + de BW-artikel-verwijzingen,
   zodat de jurist het snel kan toetsen.
g. Commit: `feat(legal): volmacht-based machtiging foundation (3:60/3:66/3:72 BW)`.

---

## DEEL 1 — Machtiging (toestemming om namens te onderhandelen)

a. Schema (`model Negotiation`, migratie):
   ```
   relayAuthorizedAt  DateTime?   // wanneer klant machtiging gaf
   relayAuthText      String?     // exacte tekst die klant accepteerde (audit)
   relayToken         String?  @unique  // routeert provider-antwoorden terug
   relayState         String?     // RELAY_ACTIVE / AWAITING_APPROVAL / PAUSED / DONE
   ```
b. **Machtiging-UI** (op de email-pagina, ná de fee-kaart-stap): een duidelijk
   blok: "Wil je dat DeGeldHeld namens jou met {provider} onderhandelt? We
   sturen e-mails namens jou en jij keurt de eind-deal goed. Je kunt altijd
   pauzeren/stoppen." Checkbox "Ik machtig DeGeldHeld" → knop "Start
   automatisch onderhandelen".
c. Sla machtiging op (timestamp + exacte tekst + scope = deze provider/
   negotiation). Genereer een unieke `relayToken`.
d. **Gate:** geen enkele relay-send zonder `relayAuthorizedAt`. Zonder
   machtiging blijft de huidige handmatige flow (one-click copy) bestaan.
e. Markeer de machtiging-tekst als "concept — jurist laten checken".
f. Commit: `feat(relay): negotiate-on-behalf authorization + consent gate`.

---

## DEEL 2 — Relay outbound (mail namens de klant)

a. Stuur de eerste onderhandel-mail via Resend vanaf een relay-afzender,
   met **reply-to = `onderhandel+<relayToken>@degeldheld.com`** zodat
   provider-antwoorden terugkomen in de inbound. Subject bevat
   `[NEGOTIATION-<negId>]` voor routing.
b. In de mailtekst: de **naam + klantnummer van de klant** (provider praat
   met de klant via ons), en een nette ondertekening "namens {klant}".
c. Sla de thread op (`lib/email-thread.ts`: message-id / references) zodat
   vervolg-mails in dezelfde thread blijven.
d. Vereist een MX/inbound-route voor `onderhandel@` of de apex (inbound
   werkt al). Documenteer eventuele DNS-stap in V23_REPORT (EIGENAAR).
e. Commit: `feat(relay): send first negotiation email on behalf + thread`.

---

## DEEL 3 — Inbound → auto-pingpong (analyseren + counteren)

a. Zet `FEATURE_AUTO_PINGPONG` aan (of een per-negotiation flag
   `relayState === RELAY_ACTIVE`). De inbound-router vangt het
   `[NEGOTIATION-x]`-antwoord → `discriminate` → AI analyseert
   (constructief / concreet bod / afwijzend / stalling) → draft volgende stap.
b. **Routine-counter** (nog aan het onderhandelen, géén acceptabele deal):
   → automatisch versturen via de relay-thread. Dit is het "automatische" deel.
c. **Notificeer de klant elke ronde** (mail + in-app): "Provider antwoordde,
   we hebben namens jou gecounterd. Status: …" — volledige transparantie.
d. Tests: provider-antwoord → juiste discriminatie → routine-counter
   auto-verzonden; thread blijft intact.
e. Commit: `feat(relay): auto-counter routine provider replies via inbound`.

---

## DEEL 4 — Goedkeuring-gate op deal/definitieve mail (KERN)

a. Wanneer de AI een **concreet acceptabel bod** detecteert (een deal) OF
   een stap die committeert (akkoord/acceptatie): **NIET automatisch sturen.**
   - `relayState = AWAITING_APPROVAL`
   - Notificeer de klant: "Provider biedt €X/maand (€Y/jaar besparing).
     Wil je dit accepteren?" met drie knoppen: **[Accepteer deal]**,
     **[Blijf onderhandelen]**, **[Stop]**.
b. Alleen op **[Accepteer deal]** → stuur de acceptatie-mail namens de klant
   + leg de uitkomst vast (→ bestaande proof/uitkomst-flow → v19 fee op
   geverifieerde besparing). [Blijf onderhandelen] → nog een counter-ronde.
   [Stop] → `relayState = PAUSED`, geen mails meer.
c. **Nooit** een besparing als "behaald/geverifieerd" vastleggen zonder deze
   goedkeuring + het bestaande bewijs. (De fee blijft op bewezen besparing.)
d. **Timeout op goedkeuring:** reageert de klant niet binnen X dagen op een
   AWAITING_APPROVAL → NIET auto-accepteren; stuur een reminder en laat 't
   in AWAITING_APPROVAL staan (de deal verloopt liever dan ongewild geaccepteerd).
e. Tests: concreet bod → AWAITING_APPROVAL + notificatie, géén auto-accept;
   alleen [Accepteer] verstuurt + legt vast; timeout → reminder, geen accept.
f. Commit: `feat(relay): human approval gate on deal/definitive email`.

---

## DEEL 5 — Klant-controle + transparantie

a. Op de negotiation/uitkomst-pagina: toon de **volledige thread** (elke mail
   die namens de klant is verstuurd + elk provider-antwoord). Niks verborgen.
b. **Pauzeer/Stop-knop** altijd beschikbaar (`relayState = PAUSED`) → stopt
   alle automatische mails per direct.
c. Status-badge: "Automatisch onderhandelen actief / wacht op jouw
   goedkeuring / gepauzeerd / klaar".
d. Commit: `feat(relay): full thread transparency + pause/stop control`.

---

## DEEL 6 — Provider-pushback + deliverability

a. Detecteer als de provider vraagt om bevestiging door de rekeninghouder
   ("bent u de contracthouder?", "we hebben uw akkoord nodig") → zet
   `AWAITING_APPROVAL` + notificeer: "Provider wil dat jij bevestigt — doe
   dit even zelf" (met instructie). Niet zelf doen alsof.
b. Bevestig SPF/DKIM dekt de relay-afzender (anders deliverability-issue) —
   documenteer DNS-restpunt voor de eigenaar.
c. Rate-limit/loop-guard: max N auto-rondes per negotiation (bv 5) → daarna
   altijd naar de klant. Voorkomt eindeloze AI-pingpong.
d. **Inbound-idempotency:** dedupe op message-id → verwerk hetzelfde
   provider-antwoord nooit twee keer (geen dubbele counter).
e. **Anti-abuse:** alleen de eigenaar van de bill kan de relay machtigen;
   `relayToken` moet onraadbaar zijn (crypto-random); een token routeert
   alleen naar zíjn negotiation. Je onderhandelt per definitie alleen over
   de eigen factuur van de klant.
f. Commit: `feat(relay): handle provider account-holder checks + loop guard + idempotency`.

---

## DEEL 7 — Aggregate + rapport

a. `npm test -- --run` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** +
   `npx playwright test tests/e2e/`. Alles groen.
b. `V23_REPORT.md`:
   - Hoe de flow loopt (machtiging → relay → auto-counter → goedkeuring-gate)
   - Bevestig: geen pad stuurt zonder machtiging; geen pad accepteert een
     deal zonder goedkeuring
   - EIGENAAR-restpunten: machtiging-tekst juridisch laten checken; evt.
     DNS voor relay-afzender; FEATURE_AUTO_PINGPONG / relay aanzetten in prod
c. Commit: `docs(v23): auto-negotiation on behalf — consent + approval verified`.

---

## Done-criteria
- [ ] Machtiging verplicht vóór elke relay-send (geen machtiging = handmatige flow)
- [ ] Mails gaan namens de klant met reply-to-token → antwoorden komen binnen
- [ ] Routine-counters auto; **deal/definitieve mail altijd via goedkeuring-gate**
- [ ] Besparing nooit als behaald vastgelegd zonder goedkeuring + bewijs
- [ ] Volledige thread zichtbaar + pauzeer/stop altijd mogelijk
- [ ] Loop-guard (max auto-rondes) + provider-pushback-detectie
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] V23_REPORT.md met eigenaar-restpunten

## Eindrapportage
```
AUTO_NEGOTIATION_V23 — Final report
DEEL 1  ✓ <hash> — machtiging + consent-gate
DEEL 2  ✓ <hash> — relay outbound namens klant
DEEL 3  ✓ <hash> — auto-counter routine antwoorden
DEEL 4  ✓ <hash> — goedkeuring-gate op deal/definitief
DEEL 5  ✓ <hash> — thread-transparantie + pauzeer/stop
DEEL 6  ✓ <hash> — provider-pushback + loop-guard
DEEL 7  ✓ <hash> — rapport + eigenaar-restpunten
```

**Na deze sprint: de onderhandeling loopt grotendeels vanzelf — DeGeldHeld
mailt namens de klant en counter't automatisch — maar de klant machtigt
vooraf en keurt elke deal/definitieve mail goed. Hands-off waar het kan,
mens-in-de-lus waar het telt.**

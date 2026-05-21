# V23_REPORT — Automatische onderhandeling namens de klant (Optie 2)

DeGeldHeld onderhandelt **namens de klant** met de provider en counter't
routine-antwoorden automatisch — **maar de klant machtigt vooraf en keurt
elke deal/definitieve mail zelf goed.** Hands-off waar het kan, mens-in-de-lus
waar het telt.

## Eindrapportage

```
AUTO_NEGOTIATION_V23 — Final report
DEEL 0  ✓ 19404b1 — volmacht-basis (3:60/3:66/3:72 BW) + docs/MACHTIGING.md
DEEL 1  ✓ efed77d — machtiging + consent-gate (canRelaySend)
DEEL 2  ✓ 38f3ef5 — relay outbound namens klant + reply-to-token + thread
DEEL 3  ✓ 9dc1346 — auto-counter routine antwoorden via inbound
DEEL 4  ✓ d57b8a4 — goedkeuring-gate op deal/definitief (KERN) + timeout-reminder
DEEL 5  ✓ 687ee67 — thread-transparantie + pauzeer/stop
DEEL 6  ✓ 53c58be — provider-pushback + loop-guard + idempotency + anti-abuse
DEEL 7  ✓ <dit commit> — aggregate + rapport
```

## Hoe de flow loopt

1. **Machtiging (consent-first).** Op `/onderhandel/email` toont
   `RelayConsentPrompt` een opt-in: "Laat DeGeldHeld namens jou
   onderhandelen". Akkoord → `POST /api/negotiations/[id]/relay-authorize`
   (owner-only) slaat de exacte machtigingstekst + timestamp op, genereert een
   crypto-random `relayToken`, en zet `relayState = RELAY_ACTIVE`.
2. **Relay outbound.** `sendRelayMail` stuurt namens de klant naar de provider
   met `reply-to = onderhandel+<token>@degeldheld.com`, subject
   `[NEGOTIATION-<id>]`, een stabiele RFC-5322 thread en een "namens {klant}"-
   ondertekening.
3. **Provider antwoordt** → komt binnen op `onderhandel+<token>@` → de
   canonieke inbound-handler routeert op token naar `handleRelayReply`.
4. **Beslissing (`relayDecision`).**
   - Routine "kun je beter?"-counter → **automatisch verstuurd** namens de
     klant; klant wordt elke ronde genotificeerd (transparantie).
   - Concreet acceptabel bod / committerende stap / provider vraagt om
     account-holder-bevestiging / loop-guard bereikt → **`AWAITING_APPROVAL`**;
     klant krijgt een mail + ziet op `/onderhandel/[bill]/relay` de knoppen
     **Accepteer / Blijf onderhandelen / Stop**.
   - Provider wijst af → relay **PAUSED**, klant geïnformeerd.
5. **Goedkeuring (mens-in-de-lus).** `POST .../relay-approve`:
   - **Accepteer** → acceptatie-mail namens de klant + relay `DONE`. De
     besparing wordt **niet** als behaald vastgelegd — dat blijft via het
     bestaande bewijs-pad (`/bewijs`) → v19-fee op geverifieerde besparing.
   - **Blijf onderhandelen** → nog een counter-ronde (`RELAY_ACTIVE`).
   - **Stop** → `PAUSED`.

## ✅ Guardrails — bevestigd, geen pad omzeilt ze

- **Geen send zonder machtiging.** Élke outbound relay loopt door
  `canRelaySend()` (vereist `relayAuthorizedAt` **én** `relayState ===
  RELAY_ACTIVE`). Bewezen in `relay-core`/`relay-send` tests; bron-guard in
  `relay-guards`.
- **Geen deal zonder goedkeuring.** `relayDecision()` retourneert **nooit** een
  automatische "accept"; deals/commitments/pushback/loop-guard → altijd
  `AWAITING_APPROVAL`. Alleen het expliciete `relay-approve`-endpoint
  (owner-only) verstuurt een acceptatie. `relay-inbound`/`relay-approve` tests.
- **Besparing nooit "behaald" zonder bewijs.** `relay-approve` accept zet géén
  `actualSavingsCents`/`proofVerifiedAt` — getest. De fee blijft op
  geverifieerde besparing (v19).
- **Timeout → reminder, geen auto-accept.** Cron `relay-reminders` (dagelijks)
  herinnert na 3 dagen `AWAITING_APPROVAL` en accepteert nooit zelf.
- **Volledige transparantie + altijd opzegbaar.** `/onderhandel/[bill]/relay`
  toont de hele thread; `relay-pause` (pause/resume) is altijd beschikbaar.
- **Anti-abuse.** Alleen de bill-eigenaar machtigt/keurt/pauzeert (owner-scoped
  queries); `relayToken` is crypto-random en routeert alleen naar zíjn
  negotiation; inbound is idempotent op Message-ID.

## Verificatie
- `npx tsc --noEmit`: **clean**.
- `npm run build`: **EXIT 0** vóór élke commit.
- `npm test -- --run`: **1749 passed**. 8 failed = **pre-existing**, niet-v23:
  Hero/FAQ/a11y tests die niet zijn bijgewerkt na de signup/FAQ-herontwerp-
  commits `3878fa6` + `7203907` (bewezen via `git stash` op de commit vóór
  v23). Tracken in BACKLOG.
- `npx playwright test tests/e2e/`: **64 passed**, 2 failed = **pre-existing**
  `multi-round` auth-secret/env-mismatch in de lokale e2e-harness (sessie-
  cookie ≠ dev-server `AUTH_SECRET`), niet v23-gerelateerd.
- Migratie (deployed + `prisma generate`): `20260525000000_relay`
  (Negotiation.relayAuthorizedAt / relayAuthText / relayToken[unique] /
  relayState / relayAutoRounds / providerEmail).

## 🧑 EIGENAAR — restpunten
1. **Machtigingstekst + voorwaarden + privacyverklaring juridisch laten
   toetsen** (concept). De volmacht-structuur staat in `docs/MACHTIGING.md`.
2. **Relay-afzender deliverability**: bevestig SPF/DKIM/DMARC op het
   verzend-domein zodat mails "namens de klant" niet in spam landen, en zet
   inbound MX voor `onderhandel@`/de apex zodat `onderhandel+<token>@`-replies
   binnenkomen (Resend inbound — zie INBOUND_FIX_REPORT).
3. **Provider-adres-discovery**: voor de allereerste mail moet het
   provider-contactadres bekend zijn (`providerEmail`). Nu: meegeven bij
   machtiging, of geleerd uit het eerste provider-antwoord. Een
   provider→retentie-emaillijst is een latere uitbreiding.
4. **Aanzetten in prod**: de relay werkt per-negotiation op consent +
   `relayState` (niet op de globale `FEATURE_AUTO_PINGPONG`-vlag). Zet de
   `relay-reminders`-cron-secret + monitor de eerste echte threads voordat je
   breed uitrolt.
5. **Pre-existing testschuld** (Hero/FAQ/a11y) opruimen — los van v23.

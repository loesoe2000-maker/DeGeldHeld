# DeGeldHeld v26 — Relay: correcte provider-adressen (telecom) + "bij twijfel handmatig"

Jurist akkoord op de volmacht → de relay mag aan. Vóór het aanzetten moet het
**provider-adres kloppen**: een mail namens de klant naar een fout/algemeen
adres = mislukte onderhandeling + reputatieschade.

V25's register (`lib/relay-providers.ts`) dekt energie/internet (Vattenfall,
Greenchoice, Pure Energie, Engie, Freedom Internet). **Telecom is bewust leeg** —
KPN/Vodafone/Odido/Ziggo/Tele2/Simyo/Ben publiceren géén onderhandel-e-mailadres
(alleen app/chat/telefoon/formulier). Deze sprint:
1. voegt **geverifieerde** adressen toe wáár ze betrouwbaar bestaan (incl. de
   telecom/energie die V25 nog niet checkte),
2. maakt **"bij twijfel → klant voert zelf het adres in"** robuust + duidelijk,
3. voegt een **bevestig-vóór-versturen**-stap toe (de eerste relay-mail gaat
   nooit naar een niet-bevestigd adres),
4. zet bij providers die aantoonbaar **geen e-mail** doen de **verwachting eerlijk**.

**Draai dit ná de huidige `main` (V25 staat erop). Zet FEATURE_RELAY_ENABLED pas
aan ná deze sprint** (zie eigenaar-stap) zodat telecom meteen goed werkt.

---

## ⚠️ GUARDRAILS
1. **`npm run build` (EXIT 0) + `npx tsc --noEmit` + `npm test` groen vóór élke commit.**
2. **GÉÉN gehallucineerde adressen.** Alleen adressen die je via **WebFetch** op
   de officiële contact/opzeg-pagina bevestigt, elk met `// bron: <URL>`.
   Twijfel of niet vindbaar → **weglaten** → handmatige invoer. Liever de klant
   laten invoeren dan gokken.
3. **Bevestig-vóór-versturen.** De eerste relay-mail (`sendFirstRelayMail`) mag
   NOOIT de deur uit zonder een adres dat ófwel uit het geverifieerde register
   komt ófwel door de klant is ingevoerd/bevestigd. Sluit aan op `canRelaySend`
   (consent-first blijft).
4. **Eerlijke verwachting.** Providers die alleen telefoon/app/formulier doen →
   de UI zegt dat e-mail daar minder goed werkt; niet doen alsof het altijd lukt.
5. Geen `--no-verify`/`--force`. Co-author trailer:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## START
```
Lees /Users/bdb/alpharadar-pro/degeldheld/RELAY_TELECOM_ADDRESS_SPRINT_V26.md en voer alle deeltaken in volgorde uit. Per deel: npm test + npx tsc --noEmit + npm run build (EXIT 0) groen vóór de commit. GÉÉN gehallucineerde adressen — alleen WebFetch-geverifieerd met // bron:, twijfel = weglaten. De eerste relay-mail nooit zonder een geverifieerd óf door de klant bevestigd adres. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force. Bij blocker na 30 min: TODO-commit en door. Eindig met V26_REPORT.md incl. welke adressen geverifieerd toegevoegd zijn (met bron), welke bewust weggelaten, en de EIGENAAR-stap (FEATURE_RELAY_ENABLED=true).
```

---

## DEEL 1 — Adressen onderzoeken + register verdiepen (sourced)

a. **WebFetch** de officiële klantenservice/opzeg/contactpagina van elke grote
   NL-provider die nog niet in `lib/relay-providers.ts` staat:
   - Telecom/mobiel/internet: KPN, Vodafone, Odido, Ziggo, Tele2, Simyo, Ben,
     hollandsnieuwe, Lebara, Lyca, Youfone, Budget Mobiel, Ben.
   - Energie die V25 nog niet checkte: Eneco, Essent, Frank Energie, Vandebron,
     Energiedirect, Oxxio, Budget Energie.
b. Voeg in `RELAY_PROVIDER_EMAILS` ALLEEN adressen toe die je op de officiële
   pagina bevestigt, met `// bron: <URL>`. Geen betrouwbaar adres (de meeste
   telecom doet app/telefoon/formulier) → **niet toevoegen**.
c. Breid het type uit met een **expliciete lijst van "geen e-mail"-providers**
   (`RELAY_NO_EMAIL_PROVIDERS`) — de providers waarvan je op de officiële site
   bevestigt dat er géén publiek e-mailadres is (alleen app/telefoon/formulier),
   plus een korte `note`. Zo kan de UI eerlijk zijn i.p.v. te gokken.
d. `relayProviderEmail()` blijft; voeg `relayProviderChannel(provider)` toe →
   `"email" | "no-email" | "unknown"`.
e. Tests: elke register-entry heeft een `// bron:`-comment (anti-hallucinatie
   regextest); lookup case-insensitive; de bekende telecom zit in de
   "geen e-mail"-lijst; onbekend → `"unknown"`.
f. Commit: `feat(relay): deepen verified address registry + no-email channel map`.

---

## DEEL 2 — Bevestig-vóór-versturen + verplichte invoer bij twijfel (UI)

a. `components/RelayConsentPrompt.tsx` (krijgt al `resolvedProviderEmail`):
   - **Geverifieerd adres (register-hit):** toon het + **"We mailen namens jou
     naar `<adres>` — klopt dit?"** met **Bevestig / Wijzig**. Pas ná bevestiging
     mag "Start automatisch onderhandelen".
   - **Geen hit (`unknown`):** **verplicht** invoerveld "E-mailadres
     klantenservice van {provider} — staat op je factuur of in de app/account"
     + validatie. Geen adres → geen start.
   - **`no-email`-provider:** eerlijke melding, bijv. "KPN behandelt
     onderhandelingen meestal via telefoon/de app; e-mail werkt hier minder
     goed. Vul een adres in als je het hebt — anders kun je deze beter zelf doen."
b. `app/api/negotiations/[id]/relay-authorize`: weiger te starten (409
   `address-required`) zonder een bevestigd óf ingevoerd adres. `providerEmail`
   blijft verplicht vóór `sendFirstRelayMail`.
c. Tests: hit → bevestig-stap vóór start; miss → verplichte invoer; no-email →
   waarschuwing getoond; leeg/ongeldig → nette fout, geen send.
d. Commit: `feat(relay): confirm-before-send + required manual entry on doubt`.

---

## DEEL 3 — Adres-sanity (nooit naar een fout/no-reply adres)

a. Lichte validatie vóór de eerste send (in `relay-authorize`/`relay-send`):
   weiger `noreply@`/`no-reply@`/`donotreply@`, eis geldig e-mailformaat, en geef
   een **zachte waarschuwing** als het domein totaal niet bij de provider lijkt
   te passen (heuristiek; bij twijfel terug naar bevestig/invoer, niet hard
   blokkeren op een false positive).
b. Tests: `noreply@kpn.com` → geweigerd; een gewoon adres → toegestaan.
c. Commit: `feat(relay): address sanity guard before first relay send`.

---

## DEEL 4 — Aggregate + rapport
a. `npm test -- --run` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** +
   `npx playwright test tests/e2e/`. Alles groen.
b. `V26_REPORT.md`: welke adressen **geverifieerd toegevoegd** (met bron), welke
   bewust **weggelaten** (geen publiek e-mail → handmatig), en de EIGENAAR-stap:
   **`FEATURE_RELAY_ENABLED=true` in Vercel → redeploy → monitor de eerste 5
   echte threads.**
c. Commit: `docs(v26): verified addresses + confirm-before-send + manual-on-doubt`.

---

## Done-criteria
- [ ] Extra geverifieerde adressen toegevoegd (met bron); twijfel = weggelaten
- [ ] "Geen e-mail"-providers gemarkeerd → UI zet de verwachting eerlijk
- [ ] Register-hit → **bevestig-stap**; geen hit → **verplichte handmatige invoer**
- [ ] Eerste relay-mail gaat NOOIT zonder geverifieerd/bevestigd adres
- [ ] Adres-sanity (geen noreply / fout domein)
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] `V26_REPORT.md` + EIGENAAR-stap (flag aanzetten)

## Eindrapportage
```
RELAY_TELECOM_ADDRESS_V26 — Final report
DEEL 1 ✓ <hash> — register verdiept + no-email channel-map (sourced)
DEEL 2 ✓ <hash> — bevestig-vóór-versturen + verplichte invoer bij twijfel
DEEL 3 ✓ <hash> — adres-sanity guard
DEEL 4 ✓ <hash> — rapport + flag-aanzet-stap
```

**Na deze sprint mailt de relay namens de klant alléén naar een correct
geverifieerd óf door de klant bevestigd adres — en bij twijfel voert de klant
het zelf in. Dán kun je `FEATURE_RELAY_ENABLED` veilig aanzetten.**

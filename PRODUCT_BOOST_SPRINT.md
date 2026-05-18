# DeGeldHeld v12 — Product Boost: pingpong + multi-page PDF + tone matching

Drie focused features, ~4–6 uur. Eén commit per deel.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/PRODUCT_BOOST_SPRINT.md en voer alle vier deeltaken uit in volgorde. Per deeltaak: implementeer, schrijf tests, run `npx tsc --noEmit` en `npm test -- --run`, commit + push. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify, geen --force push. Bij blocker na 25 min: TODO-commit en door. Migraties: lokaal `prisma migrate dev`, daarna `npx prisma migrate deploy`.
```

---

## DEEL 1 — Auto-pingpong activeren (feature-flag aan, end-to-end testen)

Infrastructuur staat (v10 DEEL 4). Nu live zetten: Resend inbound webhook, HMAC verify, AI-counter generatie, user-confirm-gate.

a. **Resend inbound webhook setup** in `MANUAL_SETUP_REQUIRED.md` documenteren:
   - MX-record voor `auto.degeldheld.com` → Resend inbound
   - Webhook URL: `https://degeldheld.com/api/inbound/router`
   - HMAC secret naar Vercel env als `RESEND_INBOUND_SECRET`

b. **/api/inbound/router/route.ts** uitbreiden zodat het werkt voor zowel
   email-pingpong als bewijs-uploads. Discriminate op subject:
   - `[PROOF-{billId}]` → proof-flow (bestaande v11)
   - `[NEGOTIATION-{negotiationId}]` of `In-Reply-To` matching thread → auto-pingpong
   - Anders → log + ack 200

c. **AutoPingpong-flow** in `lib/auto-pingpong.ts`:
   1. Parse inbound mail body + attachments
   2. Match `Negotiation` via `providerThreadId`
   3. Run `analyseProviderResponse()` (bestaand uit v5)
   4. Genereer counter via `generateEmail({...input, roundContext: N+1})`
   5. Maak `NegotiationRound` met outcome=AWAITING_USER_CONFIRM
   6. Stuur user mail "Provider antwoordde — bekijk de voorgestelde counter"
   7. **NIET zelf versturen** — user moet klikken op `/onderhandel/[billId]/ronde/[n]`

d. **Feature flag** `FEATURE_AUTO_PINGPONG=false` default. Test eerst met curl:
   ```bash
   curl -X POST https://degeldheld.com/api/inbound/router \
     -H "Content-Type: application/json" \
     -H "X-Resend-Signature: <hmac>" \
     -d '{"from":"klantbehoud@kpn.com","subject":"[NEGOTIATION-XYZ]","body":"We bieden €30..."}'
   ```
   Verwacht: NegotiationRound aangemaakt, user-notif mail verstuurd.

e. **Tests**:
   - `tests/auto-pingpong-flow.test.ts` — 3 mock-replies (constructief, afwijzend, stalling) → juiste counter
   - `tests/auto-pingpong-no-autosend.test.ts` — verify confirm-gate werkt (geen mail uit zonder user-click)
   - `tests/inbound-router-discriminate.test.ts` — proof vs negotiation routing

f. Commit: `feat(auto-pingpong): activate inbound flow with confirm gate`.

---

## DEEL 2 — Multi-page PDF support (jaarafrekeningen!)

Probleem: huidige PDF-pad rendert alleen pagina 1. Jaarafrekeningen (Eneco
warmte e.d.) hebben totaal-bedrag op pagina 1 maar specificatie op pagina 7+.
Soms zit alle relevante data verspreid.

a. **`lib/ocr.ts` PDF-pad uitbreiden**:
   - Pak pagina-count uit PDF (pdfjs-dist)
   - Render pagina 1 ALTIJD (samenvatting meestal hier)
   - Render extra pagina's tot max 5 totaal als pagina 1 OCR geen amount geeft
   - Voor élke pagina: render naar PNG (1500px max-breedte)
   - Stuur **alle PNG's tegelijk** naar Groq Vision in één multi-image call:
     ```ts
     content: [
       { type: "text", text: SYSTEM_PROMPT },
       { type: "image_url", image_url: { url: page1DataUrl } },
       { type: "image_url", image_url: { url: page2DataUrl } },
       // ...
     ]
     ```
   - Llama 4 Scout/Maverick accepteren multi-image input

b. **System prompt update**: vermeld expliciet dat input meerdere pagina's kan
   zijn van dezelfde factuur. AI moet over de pagina's heen het juiste
   maandbedrag vinden (vaak alleen op pagina 1, soms berekend uit pagina 2+).

c. **Test-fixture** `tests/fixtures/bills-pdf/eneco-warmte-jaar.pdf` (9 pagina's,
   uit echte test-case). Verwacht: provider="Eneco", monthlyCents > 0,
   period correct.

d. **Cost-guard**: meer pagina's = meer tokens = duurder. Hard-limit 5 pagina's
   per request, log warning bij PDF >5 pagina's.

e. Commit: `feat(ocr): multi-page PDF rendering up to 5 pages, multi-image Groq call`.

---

## DEEL 3 — Provider-tone matching in negotiator

Doel: KPN-mail formeler dan Bunq-mail. Mail voelt natuurlijker = hogere
slaag-rate.

a. **`lib/providers.ts`** uitbreiden met per-provider `tone` field:
   ```ts
   tone?: "formal" | "neutral" | "casual"
   ```
   Vul in voor top-30 NL providers:
   - **Formal**: KPN, ABN, Centraal Beheer, Aegon, Allianz, ING, Rabobank
   - **Neutral**: Vodafone, Eneco, Vattenfall, Univé, FBTO, Ziggo
   - **Casual**: Bunq, Knab, T-Mobile, Budget Mobiel, Spotify, Netflix

b. **`lib/negotiator.ts`** — in `buildPrompt()`:
   - Lees provider.tone
   - Override `tonality` parameter waar provider expliciet tone heeft
   - Pas system-prompt aan: "Stem stijl af op de provider. KPN is formeel,
     Bunq is informeel."
   - Voorbeeld-mails per tone in system prompt (zoals signal naar LLM)

c. **`lib/categories.ts`** — voeg `negotiationVocabulary` per category toe:
   - ENERGIE: "kWh-tarief", "vast tarief", "voorschot", "jaarafrekening"
   - VERZEKERING: "premie", "dekking", "eigen risico", "polisvoorwaarden"
   - HYPOTHEEK: "rente", "oversluiten", "rentevaste periode"
   - TELECOM: "abonnement", "bundel", "klantbehoud-team"

d. **Negotiator prompt** gebruikt deze vocab als hint zodat AI categorie-juiste
   termen pakt. Pre-fixen: "Gebruik bij {category} expliciet termen zoals: ..."

e. **Tests**:
   - `tests/tone-matching.test.ts` — KPN mail bevat "Geachte", Bunq mail bevat "Hoi"
   - `tests/vocab-matching.test.ts` — ENERGIE mail noemt "kWh" of "voorschot"

f. Commit: `feat(negotiator): provider-tone matching + category-specific vocabulary`.

---

## DEEL 4 — Smoke + STATUS_V12

a. Smoke uitbreiden naar 42 checks:
   - 1-40 bestaande
   - 41. POST `/api/inbound/router` met negotiation-payload → 200, NegotiationRound aangemaakt
   - 42. Upload multi-page PDF fixture → provider+amount extracted

b. Run smoke, plak output.

c. `STATUS_V12.md` per deel commit-hash + 1-regel resultaat.

d. **MANUAL_SETUP_REQUIRED.md** update:
   - Resend inbound MX + webhook URLs
   - `RESEND_INBOUND_SECRET` env
   - `FEATURE_AUTO_PINGPONG=true` zet aan in Vercel ZODRA Resend inbound werkt
     (test eerst met 1 dummy negotiation)

e. Commit: `docs(v12): smoke 42 + status + manual-setup for inbound webhook`.

---

## Done-criteria

- [ ] Eneco jaarafrekening (de echte 9-pagina PDF) → OCR pakt provider + bedrag
- [ ] KPN-mail van negotiator gebruikt "Geachte heer/mevrouw" + "u-vorm"
- [ ] Bunq-mail van negotiator gebruikt "Hoi" + "jij-vorm"
- [ ] Energie-mail bevat term "kWh" of "voorschot"
- [ ] Auto-pingpong: curl-test → NegotiationRound aangemaakt
- [ ] User krijgt notif-mail bij provider-response, MOET klikken om counter te versturen
- [ ] Smoke 42/42 groen

## Eindrapportage

```
PRODUCT_BOOST_SPRINT v12 — Final report

DEEL 1  ✓ <hash> — auto-pingpong live achter feature-flag
DEEL 2  ✓ <hash> — multi-page PDF (up to 5 pages) — Eneco-fixture pass
DEEL 3  ✓ <hash> — provider-tone matching + category vocab
DEEL 4  ✓ <hash> — smoke 42/42, runbook updated
```

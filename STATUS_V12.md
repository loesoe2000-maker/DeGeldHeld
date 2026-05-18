# STATUS V12 — Product Boost: pingpong + multi-page PDF + tone matching

Sprint: `PRODUCT_BOOST_SPRINT.md` — vier deelfasen. Branch `main`.

## DEEL 1 — Auto-pingpong met discriminate router  ✓
- Commit `8767837` — feat(auto-pingpong): activate inbound flow with
  confirm gate.
- Nieuwe `lib/auto-pingpong.ts` met pure `discriminate()` + `dispatch()`.
  Eén Resend webhook muxt nu proof (`[PROOF-<billId>]`) en
  auto-pingpong (`[NEGOTIATION-<negId>]` of In-Reply-To-thread).
- `lib/email-thread.ts` krijgt `extractProofSubjectToken()` +
  `extractNegotiationSubjectToken()`.
- `/api/inbound/router` zet feature-flag gate alleen op de
  negotiation-branch — proof werkt onafhankelijk.
- Hard rule blijft: auto-pingpong verstuurt nooit autonoom; alleen
  `/api/negotiations/round/[id]/confirm-send` zet een counter-mail
  op de lijn.
- 22 nieuwe tests (router-discriminate matrix, 3 mock-replies,
  no-autosend contract).

## DEEL 2 — Multi-page PDF (tot 5 pagina's)  ✓
- Commit `427741d` — feat(ocr): multi-page PDF rendering up to 5
  pages, multi-image Groq call.
- `lib/pdf_extract.ts` leest tot `MAX_PDF_PAGES = 5` (was 1). Per
  pagina een `--- page N ---` marker zodat de LLM cross-page kan
  redeneren. Cost-guard: Sentry warning bij PDFs >5 pagina's.
- OCR system-prompt expliciet over multi-page input + page-markers.
- `tryModel()` accepteert nu `string | string[]` zodat een
  toekomstig PDF→PNG renderer (canvas-based) multi-image vision
  calls kan doen.
- Eneco jaarafrekening tekst-path werkt nu out-of-the-box.
- 6 nieuwe tests (cost-guard contract + multi-image signature pin).

## DEEL 3 — Provider-tone matching + category vocab  ✓
- Commit `d1af4c9` — feat(negotiator): provider-tone matching +
  category-specific vocabulary.
- `lib/providers.ts`: nieuwe `ProviderTone` union + `PROVIDER_TONE_MAP`
  voor top-30 NL providers (formal/neutral/casual). `providerTone()`
  lookup met category-fallback voor untagged providers.
- `lib/categories.ts`: `NEGOTIATION_VOCAB` per categorie + `vocabFor()`
  helper. ENERGIE → kWh-tarief/voorschot; VERZEKERING → premie/
  dekking; HYPOTHEEK → rente/oversluiten.
- `lib/negotiator.ts`: `tonalityForProvider()` override — KPN met
  caller=CASUAL blijft formal, Bunq met caller=FORMEEL blijft casual.
  Fallback NL body schakelt nu jij/u + Hoi/Geachte heer/mevrouw +
  embed vocab line.
- Bestaande v3 tests bijgewerkt (Bunq i.p.v. KPN voor CASUAL;
  "Hallo" → "Hoi" voor sprint done-criteria).
- 21 nieuwe tests (tone-matching 13 + vocab-matching 8).

## DEEL 4 — Smoke 42 + STATUS_V12 + manual setup  ✓
- `scripts/smoke-prod.ts` van 40 → 42 checks:
   41. POST `/api/inbound/router` met `[NEGOTIATION-...]` + bad sig → 401
   42. GET `/onderhandelen-met-kpn` → 200 (oefent providerTone)
- `MANUAL_SETUP_REQUIRED.md` §9 (auto-pingpong activation) + §10
  (multi-page PDF) toegevoegd.
- Deze STATUS_V12.md.

## Test totaal
- Baseline (vóór sprint): 1312 passed.
- Na sprint: 1361 passed, 2 pre-existing FAQ-component failures
  (commit `b351a61`, vóór deze sprint — buiten scope).
- Nieuwe tests: 49 (22 DEEL 1 + 6 DEEL 2 + 21 DEEL 3).

## Manual follow-ups
- `RESEND_INBOUND_SECRET` env op Vercel (apart van proof-secret).
- `FEATURE_AUTO_PINGPONG=true` flippen ná 1 dummy negotiation
  end-to-end test (curl smoke in MANUAL_SETUP_REQUIRED.md §9).
- Optioneel: `@napi-rs/canvas` dep toevoegen voor PDF→PNG vision
  fallback (scan-PDFs zonder text-layer).
- `tests/components.test.tsx` FAQ-failures (commit b351a61) zijn
  pre-existing; repareren in een follow-up.

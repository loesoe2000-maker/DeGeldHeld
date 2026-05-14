# BUG_AUDIT.md — DeGeldHeld v2

**Datum:** 2026-05-14
**Sessie:** /goal "DeGeldHeld v2 — fix bugs + polish"
**Baseline:** v1 (10 commits, 282 tests scaffolded)

## F0 Bug scan resultaat

In dit document: alle bekende issues uit v1 codebase, plus fixes per fase.

---

## P0 — Blokkerende bugs (must-fix)

### B1. `/pay/[id]` form POST faalt → user ziet JSON
**File:** `app/pay/[id]/page.tsx:74`
**Symptoom:** `<form action="/api/checkout" method="POST">` submit → browser navigeert naar `/api/checkout` → toont raw JSON response in plaats van Stripe checkout.
**Root cause:** `/api/checkout` returnt `{ ok, checkoutUrl }` JSON, geen 303 redirect.
**Fix in F7:** vervang form door client-side fetch + `window.location.href = checkoutUrl`.

### B2. NextAuth JWT strategy zonder JWT callback → session.user.id leeg
**File:** `lib/auth.ts:11`
**Symptoom:** `session.user.id` is undefined → dashboard query `where: { userId }` returnt niks → user ziet altijd empty state.
**Root cause:** session strategy gewijzigd naar `jwt`, maar de `session()` callback leest `user.id` van NextAuth `user` arg (database mode) en niet van `token` (JWT mode). In JWT mode wordt `user` alleen meegeleverd op signin event.
**Fix in F1:** voeg `jwt()` callback toe die `token.id = user.id` zet op signin, en `session()` callback leest `token.sub` of `token.id`.

### B3. OCR weigert PDF (spec eist support)
**File:** `lib/ocr.ts:128-130`
**Symptoom:** rekeningen als PDF (default v.r.b.b. KPN/Ziggo) → 400 "Alleen JPG/PNG/WebP/HEIC".
**Fix in F2:** voeg `application/pdf` toe; bij PDF skip Groq Vision (kan geen PDFs) en zet `needsManual=true`.

---

## P1 — UX bugs (high priority)

### B4. BillUpload toont niet welk bestand geselecteerd is
**File:** `components/BillUpload.tsx`
**Fix in F1:** toon filename na selectie, voor upload.

### B5. Bill upload geen retry bij Groq error
**File:** `lib/ocr.ts:106` (`extractBill` catch return zonder retry)
**Fix in F2:** 1× retry met exponential backoff, dan fallback naar handmatige invoer.

### B6. Geen cascade van Groq vision models
**File:** `lib/ocr.ts:33` (alleen llama-3.2-90b-vision)
**Spec:** v2 wil `90b → 11b → manual` fallback.
**Fix in F2:** probeer in volgorde: 90b → 11b → returnt needsManual.

### B7. Negotiator geen output-validatie
**File:** `lib/negotiator.ts:96-103` (parseNegotiatorJson)
**Symptoom:** lege subject of <100 char body komt door naar UI.
**Fix in F4:** valideer subject.length > 5 én body.length >= 100, anders fallback.

### B8. Welcome email niet branded
**File:** `lib/email.ts:30` (welcomeEmailHtml)
**Symptoom:** basic HTML zonder brand kleuren/logo.
**Fix in F6:** branded template (groen+wit, headers, CTA).

### B9. Geen toast feedback op succes/error
**Fix in F5:** lightweight Toast component + ToastProvider.

### B10. Geen loading skeletons op dashboard / analyse
**Fix in F5:** `<Skeleton />` component per stat card / row.

### B11. Vandebron ontbreekt in providers
**File:** `lib/providers.ts`
**Spec v2:** providers list noemt expliciet Vandebron.
**Fix in F2:** toevoegen aan ENERGIE categorie.

---

## P2 — Polish / nice-to-have

### B12. Hero form submit zonder optimistic UI
**Fix in F5:** disable button + spinner direct.

### B13. /api/proof: geen counter animation
**Fix in F8:** number-up animation op landing en /proof page.

### B14. Stripe checkout: cancel/success URLs vaag
**Fix in F7:** dedicated success page met dank-bericht.

### B15. Follow-up email geen "Ja gelukt"/"Niet gelukt" buttons in NL
**File:** `lib/follow_up_email.ts`
**Status:** wel "Bespaard!" / "Geen deal" / "Nog wachten" — labels prima maar mappen-target labels v2 anders.
**Fix in F6:** rename labels naar "✓ Ja gelukt" / "✗ Niet gelukt" / "⏳ Nog wachten".

---

## Status fixes per fase

| Bug | Fase | Status |
|---|---|---|
| B1 form POST → JSON | F7 | TODO |
| B2 JWT session.user.id | F1 | TODO |
| B3 PDF support | F2 | TODO |
| B4 filename preview | F1 | TODO |
| B5 OCR retry | F2 | TODO |
| B6 model cascade | F2 | TODO |
| B7 negotiator validation | F4 | TODO |
| B8 branded welcome | F6 | TODO |
| B9 toast | F5 | TODO |
| B10 skeletons | F5 | TODO |
| B11 Vandebron | F2 | TODO |
| B12 hero spinner | F5 | TODO |
| B13 counter animation | F8 | TODO |
| B14 stripe pages | F7 | TODO |
| B15 follow-up labels | F6 | TODO |

---

## Env vars vereist (compleet)

Per `lib/env.ts` zod schema:

| Var | F0 status (in .env.local mock) |
|---|---|
| `DATABASE_URL` | ✓ stub |
| `NEXTAUTH_SECRET` | ✓ stub |
| `NEXTAUTH_URL` | ✓ stub |
| `RESEND_API_KEY` | ✓ stub |
| `EMAIL_FROM` | ✓ stub |
| `GROQ_API_KEY` | ✓ stub |
| `STRIPE_SECRET_KEY` | ✓ stub |
| `STRIPE_WEBHOOK_SECRET` | ✓ stub |
| `SENTRY_DSN` | optional |
| `APP_URL` | default localhost:3000 |
| `CRON_SECRET` | TODO toevoegen aan env.ts schema (gebruikt in cron route) |

**Fix in F0:** `CRON_SECRET` toevoegen aan zod schema in lib/env.ts (optional).

---

## Toolchain notitie (zelfde als v1)

Node 20+ blijft een externe vereiste. v2 fixes verbreken `npm install` workflow niet — alle changes zijn TS/TSX edits, geen nieuwe deps.

Wanneer user `npm install` doet en `npm test` draait: alle 282 v1 tests + ~95 nieuwe v2 tests zouden groen moeten zijn.

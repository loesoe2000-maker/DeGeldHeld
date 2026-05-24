# DeGeldHeld v30 — Accuracy-boost op V29 (proof-back + Plus-cron + telecom-honest + PostCheckCta)

> **🟢 Status (2026-05-24) — V29 is af.** Box 3 + NS + Zorgkostenaftrek +
> "vind al je geld"-hub zijn gebouwd en gepushed in commits `5f56d0f` (Box 3)
> · `d5d0ebe` (NS) · `67489d8` (zorgkosten) · `0aef66d` (hub) · `851c26a`
> (V29_REPORT). 1981 tests pass, alle flags default UIT.
>
> **V30 voegt GEEN nieuwe features toe.** V30 maakt élke revenue-stream
> **code-deterministisch** — geen vage beloftes, geen handmatige
> fee-collect, geen ethisch grijs gebied. Vier mechanismen op bestaande
> features.

**Lees eerst:**
- `V29_REPORT.md` — wat er al staat + commit-hashes per deel
- `MONEYFINDER_EXPANSION_SPRINT_V29.md` + `docs/V29_DATA_2026.md` — context
- `lib/outcome-proof.ts` + `lib/payments.ts` — bestaand patroon voor
  proof-detection + off-session NCNP-fee-charge (HERGEBRUIKEN, niet dupliceren)
- `lib/category-strategy.ts` — V27 strategie-map (TYPE A/B/C); te corrigeren
  in DEEL 3
- `lib/box3.ts` + `app/box3-check/` — V29-output, basis waarop DEEL 1 voortbouwt
- `lib/plus.ts` + `app/plus/page.tsx` — V29-output, basis waarop DEEL 2 voortbouwt

## Waarom V30 — accuracy ≠ features

V29 leverde 3 nieuwe checks + hub. Goed voor top-of-funnel, MAAR:
- **Box 3 NCNP** triggert nu handmatig (klant zegt "ik kreeg X terug" → wij
  charge'n via Stripe-dashboard?). Dat is hoe revenue lekt. Fix: proof-back
  upload-flow → OCR → auto-charge.
- **Plus** belooft "her-scan elke maand" maar er draait géén cron. Pure
  marketing-tekst. Fix: echte Vercel cron + Resend-mail met concrete delta.
- **Telecom** zit nog op `fee: true` in `lib/category-strategy.ts`, maar de
  V27-lever is "klant belt zelf met ons script" → 20% NCNP daarop is ethisch
  grijs. Fix: TELECOM → `fee: false`, wordt Plus-pijler #6.
- **Gratis tools** hebben elk een eigen ad-hoc CTA. Fix: één
  `PostCheckCta`-component, hergebruikt in alle 6 checks, met PostHog-tracking
  → meetbare conversie.

## ⚠️ GUARDRAILS

1. **`npm run build` (EXIT 0) + `npx tsc --noEmit` + `npm test` groen vóór élke commit.**
2. **Géén verzonnen cijfers.** Alle bedragen blijven uit `docs/V29_DATA_2026.md`
   en `docs/BENEFITS_DATA_2026.md`. V30 raakt geen forfaits/drempels aan —
   alleen mechanismen.
3. **Proof-back is de revenue-loop (KERN van V30)**: voor élke NCNP-claim
   bouwen we een bewijs-upload-flow die het werkelijk teruggehaalde bedrag
   detecteert en de fee deterministisch triggert via `chargeFeeOffSession`.
   Hergebruik `lib/outcome-proof.ts`-DNA, dupliceer niet.
4. **AVG-uitzondering toegelicht**: voor de proof-back-flow slaan we **wél**
   een `Box3Claim`-record + uploaded-bewijs op. AVG-rechtvaardiging:
   noodzakelijk voor de uitvoering van de overeenkomst (NCNP-fee). Documenteer
   in `V30_REPORT.md` + privacy-pagina-update is owner-werk.
5. **Telecom-reframe is geen feature-removal — het is fee-integriteit.**
   Bestaande telecom-onderhandelingen (als die er zijn) krijgen geen
   retro-actieve fee. Check `lib/payments.ts` `shouldChargeVerifiedFee`.
6. **Plus-cron blijft gated tot eigenaar Resend-templates heeft gereviewed +
   KvK/KYC rond is** (anders géén Plus-users om te scannen).
7. **Géén providergeld** (model B). **Géén hyp/verz** (AFM-gate).
8. **Flags blijven default UIT**:
   - `PLUS_RESCAN_CRON_ENABLED` (nieuw, default false)
   - bestaande V29-flags blijven onveranderd
9. Géén `--no-verify`/`--force`. Co-author trailer:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## START

```
Lees /Users/bdb/alpharadar-pro/degeldheld/MONEYFINDER_EXPANSION_SPRINT_V30.md, V29_REPORT.md, MONEYFINDER_EXPANSION_SPRINT_V29.md, docs/V29_DATA_2026.md, lib/outcome-proof.ts, lib/payments.ts, lib/category-strategy.ts, lib/box3.ts, lib/plus.ts. V29 is al af (commits 5f56d0f→851c26a) — bouw NIET opnieuw, alleen accuracy-boosts. Voer DEEL 1 t/m 4 uit in volgorde. Per deel: npm test + npx tsc --noEmit + npm run build (EXIT 0) groen vóór de commit. DEEL 1 = Box 3 proof-back NCNP-loop (Prisma Box3Claim model, /api/box3/claim + /api/box3/proof-back routes, OCR → chargeFeeOffSession, HARDE €500-gate). DEEL 2 = Plus her-scan cron (Prisma PlusRescan, /api/cron/plus-rescan met CRON_SECRET, runRescanForUser, Resend-mail, vercel.json cron-entry). DEEL 3 = telecom-reframe (category-strategy.ts TELECOM → fee:false, update tests, Plus-pijler #6 in app/plus/page.tsx) + PostCheckCta-component (hergebruikt in alle 6 check-Clients). DEEL 4 = V30_REPORT.md. Privacy-uitzondering documenteren (Box3Claim mag opgeslagen, vereist voor fee). Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>. Geen --no-verify/--force.
```

---

## DEEL 1 — Box 3 proof-back NCNP-loop

a. **Prisma**: voeg `Box3Claim`-model toe:
   ```
   model Box3Claim {
     id                       String   @id @default(cuid())
     userId                   String
     jaar                     Int
     verwachteTeruggaveCents  Int
     status                   String   // INTENT | AWAITING_PROOF | PROOF_RECEIVED | CHARGED | FAILED
     werkelijkTeruggaveCents  Int?
     proofUploadedAt          DateTime?
     chargedAt                DateTime?
     stripePaymentIntentId    String?
     createdAt                DateTime @default(now())
     updatedAt                DateTime @updatedAt
     user                     User     @relation(fields: [userId], references: [id])
     @@index([userId, status])
   }
   ```
   Migrate (`npm run prisma:migrate -- --name v30_box3_claim`).
b. **Route** `POST /api/box3/claim` (auth-gated):
   - Body: `{ jaar, verwachteTeruggaveCents }`.
   - Valideer: gebruiker is ingelogd, jaar ∈ [2017, 2024], `verwachteTeruggaveCents >= 50_000`
     (HARDE €500-gate uit guardrail 5 van V29). Onder de drempel → **422 +
     reden** "DIY-pad, geen NCNP". Niet stilletjes accepteren.
   - Maak `Box3Claim` met status `AWAITING_PROOF`.
   - Stuur **herinneringsmail** via Resend ("upload je Belastingdienst-beschikking
     zodra die binnen is — link naar /box3-check/proof/[claimId]").
c. **Route** `POST /api/box3/proof-back` (auth-gated):
   - Upload: PDF (Belastingdienst-beschikking).
   - OCR via bestaande `pdfjs`-route → detecteer toegekend bedrag (regex op
     "toegekend bedrag" / "teruggave" patroon in NL-beschikking).
   - Detectie OK + bedrag ≥ € 500 → status `PROOF_RECEIVED` → trigger
     `chargeFeeOffSession(userId, fee=25% × bedrag, cap=€500)` →
     status `CHARGED` + `stripePaymentIntentId` opslaan.
   - Detectie OK + bedrag < € 500 → status `CHARGED` met fee € 0 (eerlijk:
     werkelijke uitkomst < drempel = geen fee, ook al was indicatie hoger).
   - Detectie faalt → status `FAILED` + e-mail naar eigenaar voor handmatige
     review. **Géén stille uitkering.**
d. **UI** `/box3-check/proof/[claimId]` — server-page (auth-gated):
   - Toont claim-status + upload-formulier (bestaande `BillUpload`-component
     hergebruiken indien mogelijk).
   - Bij `CHARGED` → "klaar, fee was € X (25% van € Y) of € 0 want < drempel".
   - Bij `FAILED` → "we kunnen je beschikking niet automatisch uitlezen,
     iemand neemt contact op".
e. **Update `app/box3-check/Box3CheckClient.tsx`**: bij keuze "NCNP" →
   POST naar `/api/box3/claim` → toon "ok, we hebben je een mail gestuurd
   met de upload-link voor zodra de Belastingdienst-beschikking binnen is".
f. **Analytics**: extend `AnalyticsEvent`-union:
   - `box3_claim_created`
   - `box3_proof_uploaded`
   - `box3_fee_charged` (props: `{ feeCents, basisCents }` — geen userId/PII)
   - `box3_proof_failed`
g. **Tests** `tests/box3-claim.test.ts`:
   - INTENT → AWAITING_PROOF → PROOF_RECEIVED → CHARGED happy path
   - < € 500 verwachte teruggave bij POST /api/box3/claim → 422
   - Proof-back met werkelijk bedrag < € 500 → CHARGED met fee € 0
   - OCR-faal → FAILED, géén Stripe-charge
   - Auth: zonder sessie → 401 op beide routes
h. Commit: `feat(box3): proof-back NCNP-loop (deterministic fee via OCR + Stripe)`.

---

## DEEL 2 — Plus her-scan cron (werkende loop)

a. **Prisma**: voeg `PlusRescan`-model toe:
   ```
   model PlusRescan {
     id           String   @id @default(cuid())
     userId       String
     runAt        DateTime @default(now())
     findingsJson Json     // delta vs vorige run, JSON-shape gedocumenteerd in lib/plus-rescan.ts
     notifiedAt   DateTime?
     user         User     @relation(fields: [userId], references: [id])
     @@index([userId, runAt])
   }
   ```
   Migrate.
b. **Engine** `lib/plus-rescan.ts`:
   - `runRescanForUser(userId): Promise<RescanResult>` — leest user-Plus-prefs
     (laatst opgegeven check-inputs uit een `PlusPrefs`-veld op `User`, of
     uit V29's `lib/moneyfinder-hub.ts` als die opslag heeft). Roept pure
     check-engines aan: `estimateBenefits`, `estimateBox3Restitution`,
     `estimateZorgkostenAftrek`, plus spookabonnement-scan.
   - Vergelijk met laatste `PlusRescan.findingsJson` → bereken delta:
     `{ nieuw: [...], gewijzigd: [...], verdwenen: [...] }`.
   - `formatRescanFindings(delta)` → NL e-mail-tekst (concreet, géén
     marketing-speak): "Deze maand vonden we 2 nieuwe items voor je: tot
     € X toeslag mogelijk, tot € Y kindgebonden budget mogelijk".
c. **Cron-route** `app/api/cron/plus-rescan/route.ts`:
   - Vereist header `Authorization: Bearer ${CRON_SECRET}` (zelfde patroon
     als andere cron-routes — check er een in repo). Zonder → 401.
   - Gated door `PLUS_RESCAN_CRON_ENABLED` flag. Uit → 503.
   - Loop door alle Plus-users (`subscription.status === "active"`).
   - Per user: `runRescanForUser` → bij niet-lege delta: push Resend-mail
     + sla `PlusRescan`-record op met `notifiedAt`.
   - Return JSON: `{ scanned: N, notified: M, errors: E }`.
d. **vercel.json**: voeg cron-entry toe (maandelijks, 1e van de maand 07:00 UTC):
   ```json
   { "crons": [{ "path": "/api/cron/plus-rescan", "schedule": "0 7 1 * *" }] }
   ```
   Géén effect bij flag uit (cron klopt 503, geen werk).
e. **Update `app/plus/page.tsx`**: de 5 her-scan-pijlers expliciet noemen
   (toeslagen + box 3 + zorgkosten + spookabonnementen + NS auto-claim
   = positionering). Concreet, geen marketing-speak. Dit is **wat de cron
   echt doet**.
f. **Tests** `tests/plus-rescan.test.ts`:
   - `runRescanForUser` met nieuwe vondsten → niet-lege delta
   - Zonder veranderingen → lege delta + geen notificatie
   - Cron zonder secret → 401
   - Cron met secret + flag uit → 503
   - Cron met secret + flag aan → roept rescan per ACTIVE user
g. **Feature-flag**: `PLUS_RESCAN_CRON_ENABLED` (default false) in
   `lib/feature-flags.ts`. **Eigenaar-stap**: `CRON_SECRET` in Vercel env
   zetten voor activatie.
h. Commit: `feat(plus): real monthly rescan cron (concrete value over vague promise)`.

---

## DEEL 3 — Telecom-reframe + PostCheckCta-component

a. **Telecom-reframe** (fee-integriteit):
   - Update `lib/category-strategy.ts`: TELECOM `fee: true` → `fee: false`.
     Update commentaar: "Belscript-flow betekent klant doet zelf het gesprek
     — NCNP daarop is grijs; in V30 herframed als Plus-pijler."
   - Update `tests/category-strategy.test.ts` (of vergelijkbaar): TELECOM →
     `fee: false`.
   - **Migratie-veiligheid**: check dat geen bestaande telecom-onderhandeling
     retro-actief fee krijgt of verliest. Realistisch geen issue (geen
     bevestigde TELECOM-fee tot nu toe), maar verifieer expliciet in test.
   - Update `app/plus/page.tsx`: voeg telecom-belscript-pijler toe ("elk
     jaar genereren we een nieuw retentie-belscript voor je").
b. **PostCheckCta-component** `components/PostCheckCta.tsx`:
   - Props:
     ```ts
     type Props = {
       fromCheck: "geld" | "box3" | "ns" | "zorgkosten" | "vluchtclaim" | "spookabonnementen";
       vondstCents?: number | null;    // optioneel — toon "€X gevonden"
       vondstLabel?: string;            // bv "toeslag mogelijk"
       toonOnderhandel?: boolean;       // standaard true
       toonPlus?: boolean;              // standaard true
     };
     ```
   - Render: 1 Plus-kaart ("we checken dit elke maand opnieuw — Plus €2,99-4,99/mnd")
     + optioneel 1 onderhandel-kaart ("laat ons ook je rekeningen verlagen —
     20% op bewezen besparing"). Brand-consistent.
   - `track("plus_cta_clicked", { fromCheck })` of `"onderhandel_cta_clicked"`
     bij klik (toevoegen aan `AnalyticsEvent`-union).
c. **Integratie** — voeg `<PostCheckCta fromCheck="..." />` toe onderaan
   de results-section van:
   - `app/geld-check/GeldCheckClient.tsx`
   - `app/box3-check/Box3CheckClient.tsx`
   - `app/ns-check/NsCheckClient.tsx`
   - `app/zorgkosten-check/ZorgkostenCheckClient.tsx`
   - `app/vluchtclaim/VluchtclaimClient.tsx`
   - `app/spookabonnementen/page.tsx`
d. **Tests** `tests/post-check-cta.test.tsx`:
   - Rendert Plus-kaart altijd
   - Onderhandel-kaart conditioneel (toonOnderhandel)
   - Klik fire't track-event met juiste `fromCheck`-prop
   - Per `fromCheck`-waarde rendert de juiste copy
e. Commit: `feat(v30): telecom-as-Plus-pillar (fee integrity) + PostCheckCta everywhere`.

---

## DEEL 4 — V30_REPORT.md + finale gate

a. `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen.
b. `V30_REPORT.md`: per mechanisme uitleggen wat er verandert in revenue-accuracy:
   - **Box 3 proof-back**: van handmatige NCNP-collect → deterministische
     auto-charge via OCR. Eigenaar-stap: privacy-pagina updaten (Box3Claim +
     uploaded beschikking opslag, AVG-grondslag "uitvoering overeenkomst").
   - **Plus-cron**: van vage belofte → maandelijkse concrete delta-mail.
     Eigenaar-stap: `CRON_SECRET` in Vercel zetten, Resend-template
     reviewen, `FEATURE_PLUS_RESCAN_CRON_ENABLED=true` ná KvK/KYC.
   - **Telecom-reframe**: van ethisch grijs NCNP-trigger → Plus-pijler.
     Geen eigenaar-actie behalve `lib/category-strategy.ts`-review.
   - **PostCheckCta**: meetbare conversie (PostHog events) — eerste
     conversie-cijfers na 1-2 weken zichtbaar in PostHog.
c. Commit: `docs(v30): accuracy-boost on V29 verified (proof-back + cron + telecom)`.

---

## Done-criteria

- [ ] `Box3Claim` Prisma model + migratie + /api/box3/claim + /api/box3/proof-back
- [ ] OCR-detectie van toegekend bedrag uit Belastingdienst-beschikking
- [ ] HARDE €500-gate in /api/box3/claim (422 onder drempel)
- [ ] `chargeFeeOffSession` triggert deterministisch bij PROOF_RECEIVED ≥ €500
- [ ] `PlusRescan` Prisma model + migratie + /api/cron/plus-rescan (CRON_SECRET-gated)
- [ ] `runRescanForUser` + `formatRescanFindings` + Resend-mail
- [ ] vercel.json cron-entry (maandelijks, gated door flag)
- [ ] `lib/category-strategy.ts`: TELECOM → `fee: false` + tests aangepast
- [ ] `components/PostCheckCta.tsx` + integratie in alle 6 check-Clients
- [ ] AVG-uitzondering gedocumenteerd in `V30_REPORT.md`
- [ ] Flags allemaal default UIT
- [ ] Géén providergeld, géén hyp/verz, géén gehallucineerde cijfers
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] `V30_REPORT.md` met accuracy-mechanismen + eigenaar-stappen

## Eindrapportage

```
MONEYFINDER_EXPANSION_V30 — Final report (accuracy-boost op V29)
DEEL 1 ✓ <hash> — Box 3 proof-back NCNP-loop (deterministic fee)
DEEL 2 ✓ <hash> — Plus real monthly rescan cron (concrete delta)
DEEL 3 ✓ <hash> — telecom-as-Plus-pillar + PostCheckCta everywhere
DEEL 4 ✓ <hash> — V30_REPORT.md
```

**Na deze sprint is élke revenue-stream code-deterministisch:** Box 3 NCNP via
OCR → auto-charge, Plus levert maandelijks concrete vondsten via cron, telecom
is herframed als Plus-pijler (eerlijke fee-integriteit), en élke gratis check
stuurt expliciet naar Plus + onderhandeling (meetbare conversie via PostHog).
Géén providergeld, géén hyp/verz, alles flag-gated tot eigenaar de
privacy-/Resend-/CRON_SECRET-stappen heeft afgerond.

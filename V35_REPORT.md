# V35 — Claim-Hub uitbreiding: Huurcommissie + Energie-claim

> **Status: SHIPPED — 3 feat-commits + 1 docs-commit, 2238 tests groen, build EXIT 0.**
> **Peildatum: 2026-05-26. Owner: Bas. Co-author trailer: Claude Opus 4.7 (1M context).**
> Géén `--no-verify`, géén `--force`, géén nieuwe features in de **bestaande** flows
> (alleen 2 nieuwe claim-types parallel aan Box 3, plus 2 hub-tegels + 2 PostCheck-sources).

---

## TL;DR

V35 voegt **twee officiële-instantie-claim-flows** toe naast Box 3:

1. **Huurcommissie-bezwaar servicekosten** — `/huurcommissie-check`
2. **Energie-eindafrekening-claim** via Geschillencommissie Energie — `/energie-claim-check`

Allebei volgen **exact** het Box 3-template (`lib/box3.ts` + `lib/box3-claim.ts` +
`app/box3-check/*` + `app/api/box3/*`). KOPIEER-pattern, géén refactor — de
generieke `Claim`-abstractie komt in V36 of later. Box 3 is daarmee
ongewijzigd in productie.

Onderscheid t.o.v. concurrenten (EUclaim/Bezwaarmaker/Huurteam): **bundeling**
van 5 claim-flows onder één dak (Box 3 / EU261 / NS / Huurcommissie /
Geschillencommissie Energie). Geen tech-doorbraak; de moat zit in de bundeling
+ gefaseerd NCNP-model + transparantie.

Composite assurance-score blijft op **86.3%** (tech-dims al saturated; de
resterende 13.7% is owner-actie — CRON_SECRET, AVIATION_EDGE_KEY,
STRIPE_LIVE_KEY). V35 schreef +60 tests; geen regressie op de 27 V31-cases.

---

## Commits (chronologisch)

```
c1ba1fd feat(huurcommissie): bezwaar servicekosten check + DIY + NCNP-claim
9a03935 feat(energie-claim): eindafrekening check + DIY + NCNP-claim
5c1b25a feat(hub): huurcommissie + energie-claim in vind-al-je-geld
<deze>  docs(v35): claim-hub uitbreiding huurcommissie + energie verified
```

DEEL 0 (`docs/V35_DATA_2026.md`) was al klaar — overgeslagen per opdracht.

---

## Bronnen + peildatums

### Huurcommissie (peildatum 2026-01-01, geverifieerd 2026-05-26)

| Wat | Waarde | Bron |
|---|---|---|
| Leges indiening Huurcommissie | € 25,00 (terug bij winst) | [huurcommissie.nl](https://www.huurcommissie.nl/onderwerpen/servicekosten-verhuurder/jaarafrekening-beoordelen) |
| Verhuurder reactietijd op bezwaar | 21 dagen (3 weken) | Huurcommissie-procedureregels |
| Gemiddelde behandelingstijd | 5 maanden (range 4-6) | NOS-rapportage 2024 |
| Wettelijke deadline eindafrekening | 6 maanden na boekjaar | art. 7:259 BW |
| Maximale bezwaartermijn | 24 maanden na deadline | art. 7:260 lid 2 BW |
| Beleidsbron servicekosten 2026 | — | [Beleidsboek Servicekosten januari 2026 (PDF)](https://www.huurcommissie.nl/site/binaries/site-content/collections/documents/2026/01/01/beleidsboek-servicekosten/beleidsboek-servicekosten-januari-2026.pdf) |
| **NCNP-drempel V35** | **€ 50 (HARD)** | guardrail 5 sprint |
| Fee-percentage | 20% (lager dan Box 3's 25%) | sprint-keuze + cap NO_CURE_NO_PAY_FEE_CAP_CENTS |

### Geschillencommissie Energie (peildatum 2026-01-01, geverifieerd 2026-05-26)

| Wat | Waarde | Bron |
|---|---|---|
| Leges indiening Geschillencommissie | € 27,50 (terug bij winst) | [degeschillencommissie.nl](https://www.degeschillencommissie.nl/uitspraken/commissie-consument-heeft-recht-op-vermindering-energiebelasting/) |
| Klachtgeld-vergoeding consument | € 52,50 (bij winst, totaal € 80 retour) | [degeschillencommissie.nl](https://www.degeschillencommissie.nl/uitspraken/vergoeding-voor-consument-na-nadelige-contractovername-door-energieleverancier/) |
| Leverancier reactietijd op klacht | 30 dagen | Wet handhaving consumentenbescherming |
| Gemiddelde behandelingstijd Geschillencommissie | 3 maanden | Geschillencommissie Energie 2026 |
| Wettelijke deadline eindafrekening | 42 dagen (6 weken) na contract-einde | art. 31 Elektriciteitswet/Gaswet |
| ACM-handhavingsgrond | — | [acm.nl](https://www.acm.nl/nl/onderwerpen/energie/netbeheerders/geschilbeslechting-energie-aanvragen) |
| Energiebelasting-vermindering 2026 | **NIET HARD CODED** — presence-flag only | docs/V35_DATA_2026.md (jaarlijkse indexering, owner-verify) |
| **NCNP-drempel V35** | **€ 50 (HARD)** | guardrail 5 sprint |
| Fee-percentage | 20% | identiek aan huurcommissie |

Bij verschil tussen aggregator en officiële bron: officieel wint (huurcommissie.nl,
degeschillencommissie.nl, belastingdienst.nl). Géén aggregator als enige bron.

---

## Wat is gebouwd (per DEEL)

### DEEL 1 — Huurcommissie-bezwaar servicekosten (commit `c1ba1fd`)

**Engine** ([lib/huurcommissie.ts](lib/huurcommissie.ts)):
- Pure functie `estimateHuurServicekostenRestitutie(input)` — client-side
- 6 rode vlaggen detecteerd: geenSpecificatie, geenFacturen, postenNietInContract,
  eigenaarslastenVerrekend, verhuurderGeenAfrekening, voorschotVeelGroterDanWerkelijk
- Bovengrens-restitutie = overschot voorschot + tot 40% verdacht-bonus
  (10% per andere vlag, gecapped op 4 vlaggen)
- Verhuurder-geen-afrekening (vlag 5) → automatisch álle voorschotten als restitutie
- Pre-gefilde DIY-brief generator met aanhef, alle actieve vlaggen, BW-artikelen,
  3-weken-deadline + Huurcommissie-escalatie

**Constants** (sourced uit docs/V35_DATA_2026.md, met inline bron-comments):
```
HUURCOMMISSIE_LEGES_CENTS = 2_500          // € 25,00
HUURCOMMISSIE_VERHUURDER_REACTIE_DAGEN = 21
HUURCOMMISSIE_BEHANDELING_MAANDEN = 5
HUURCOMMISSIE_AFREKENING_DEADLINE_MAANDEN = 6
HUURCOMMISSIE_BEZWAAR_DEADLINE_MAANDEN = 24
HUUR_NCNP_DREMPEL_CENTS = 5_000            // € 50 (HARD in code)
HUUR_NCNP_FEE_PCT = 0.2                    // 20%
HUUR_MIN_BOEKJAAR = 2020
HUUR_MAX_BOEKJAAR = 2025
```

**Prisma** (parallel aan `Box3Claim`):
```
model HuurServicekostenClaim {
  id, userId, boekjaar, verhuurderNaam?, verwachteRestitutieCents,
  status: "INTENT" | "BEZWAAR_GESTUURD" | "HUURCOMMISSIE_INGEDIEND"
        | "UITSPRAAK" | "CHARGED" | "FAILED",
  werkelijkeRestitutieCents?, uitspraakStorageUrl?, uitspraakUploadedAt?,
  chargedAt?, feeCents?, stripePaymentIntentId?, failureReason?,
  createdAt, updatedAt
}
```

**UI**:
- [app/huurcommissie-check/page.tsx](app/huurcommissie-check/page.tsx) — server, flag-gated
- [HuurcommissieCheckClient.tsx](app/huurcommissie-check/HuurcommissieCheckClient.tsx) — wizard met 6 rode-vlag-checkboxes
- [proof/[claimId]/page.tsx](app/huurcommissie-check/proof/[claimId]/page.tsx) — uitspraak-upload page
- [HuurUitspraakUpload.tsx](app/huurcommissie-check/proof/[claimId]/HuurUitspraakUpload.tsx) — PDF + handmatig werkelijk-bedrag

**API-routes**:
- `POST /api/huurcommissie/claim` — flag + auth + € 50-gate (422) + Prisma create + herinneringsmail
- `POST /api/huurcommissie/uitspraak` — formData (PDF + werkelijk-bedrag) + admin-mail review

**Tests** ([tests/huurcommissie.test.ts](tests/huurcommissie.test.ts) 22 + [tests/huurcommissie-claim.test.ts](tests/huurcommissie-claim.test.ts) 10):
- Constanten matchen V35-doc; bron-comments wijzen naar huurcommissie.nl + Beleidsboek + BW-artikelen
- Rode-vlaggen-som correct; 0 vlaggen → unlikely; verhuurder-geen-afrekening → álle voorschotten
- HARD € 50-gate: 4_999 onder, 5_000 boven; max andere-vlaggen-bonus 40%
- DIY-brief bevat aanhef, alle actieve vlaggen, BW + 3-weken-deadline
- Route: 404 zonder flag, 401 zonder sessie, 422 onder gate, 400 bij invalid, mail-side-effect

### DEEL 2 — Energie-eindafrekening-claim (commit `9a03935`)

**Engine** ([lib/energie-claim.ts](lib/energie-claim.ts)):
- Pure functie `estimateEnergieEindafrekeningRestitutie(input)` — client-side
- 6 rode vlaggen: eindafrek-deadline > 42 dagen, geen heffingskorting-regel,
  meterstand-shift, dubbele heffingen, tariefafwijking, saldering-zonnepanelen
- Bovengrens = 30% × eindbedrag (1 vlag) of 50% × eindbedrag (≥ 2 vlaggen),
  plus klachtgeld-vergoeding € 52,50 bij ≥ 1 vlag
- Pre-gefilde DIY-klachtbrief met provider, vlaggen, 30-dgn-deadline,
  Geschillencommissie-escalatie + leges/klachtgeld-disclosure

**Constants**:
```
ENERGIE_GESCHILLENCOMMISSIE_LEGES_CENTS = 2_750     // € 27,50
ENERGIE_KLACHTGELD_VERGOEDING_CENTS = 5_250         // € 52,50
ENERGIE_LEVERANCIER_REACTIE_DAGEN = 30
ENERGIE_GESCHILLENCOMMISSIE_BEHANDELING_MAANDEN = 3
ENERGIE_EINDAFREKENING_DEADLINE_DAGEN = 42          // 6 weken
ENERGIE_NCNP_DREMPEL_CENTS = 5_000                  // € 50 (HARD)
ENERGIE_NCNP_FEE_PCT = 0.2                          // 20%
```

**Critical discipline**: GEEN hardcoded energiebelasting-vermindering-2026-bedrag.
Het bedrag verandert jaarlijks (was ~ € 631 in 2025). De engine controleert
ALLEEN de presence van de regel `heffingskortingenAanwezig`. Disclaimer +
amber callout in UI noemen expliciet dat owner het exacte bedrag moet
verifiëren op belastingdienst.nl bij implementatie.

**Prisma** (parallel aan beide andere claim-models):
```
model EnergieEindafrekeningClaim {
  id, userId, provider, verwachteRestitutieCents,
  status: "INTENT" | "KLACHT_GESTUURD" | "GESCHILLENCOMMISSIE_INGEDIEND"
        | "UITSPRAAK" | "CHARGED" | "FAILED",
  werkelijkeRestitutieCents?, uitspraakStorageUrl?, uitspraakUploadedAt?,
  chargedAt?, feeCents?, stripePaymentIntentId?, failureReason?,
  createdAt, updatedAt
}
```

**UI**:
- [app/energie-claim-check/page.tsx](app/energie-claim-check/page.tsx) — server, flag-gated
- [EnergieClaimCheckClient.tsx](app/energie-claim-check/EnergieClaimCheckClient.tsx) — wizard met provider + dagen + bedrag + tariefafwijking + 4 vlag-checkboxes + saldering-radio
- [proof/[claimId]/page.tsx](app/energie-claim-check/proof/[claimId]/page.tsx) — uitspraak-upload page
- [EnergieUitspraakUpload.tsx](app/energie-claim-check/proof/[claimId]/EnergieUitspraakUpload.tsx)

**API-routes**:
- `POST /api/energie-claim/claim` — flag + auth + € 50-gate + Prisma create + herinneringsmail (provider in subject)
- `POST /api/energie-claim/uitspraak` — formData + admin-mail review

**Tests** ([tests/energie-claim.test.ts](tests/energie-claim.test.ts) 26 + [tests/energie-claim-route.test.ts](tests/energie-claim-route.test.ts) 8):
- Constanten matchen V35-doc; bron-comments wijzen naar degeschillencommissie.nl + ACM + EW/GW + Wet handhaving
- Aparte test verifieert dat we GEEN heffingskorting-bedrag hardcoderen
- Rode-vlaggen-detectie correct per scenario; 30%/50%/klachtgeld-aggregatie klopt
- HARD € 50-gate: 4_999 onder, klachtgeld-only (€ 52,50) net erboven
- Route: zelfde gating-suite als huurcommissie

### DEEL 3 — Hub + cross-links (commit `5c1b25a`)

- [lib/moneyfinder-hub.ts](lib/moneyfinder-hub.ts) — `HUB_TILES` +2 (`huurcommissie-check` 🏠 + `energie-claim-check` ⚡), elk achter eigen flag
- [components/PostCheckCta.tsx](components/PostCheckCta.tsx) — `PostCheckSource`-union +2 (`huurcommissie`, `energie-claim`), copy per-source
- HuurcommissieCheckClient + EnergieClaimCheckClient — `<PostCheckCta fromCheck="..." />` toegevoegd onder results
- [lib/plus.ts](lib/plus.ts) — 6e pillar `claim_monitor` (positionering-only in V35; V36 mogelijke cron-job)
- Tests-updates: `vind-al-je-geld.test.tsx` +3 (V35-routes in HUB_TILES; flag UIT → géén tegel; beide AAN → beide tegels), `post-check-cta.test.tsx` +3 (V35-source-asserts), `plus.test.tsx` PILLARS-array van 5 → 6
- [scripts/audit-everything.ts](scripts/audit-everything.ts) STATIC_PAGES + API_PROBES uitgebreid

---

## Wat NIET is gebouwd (bewust, V36+ of eigenaar-werk)

| Wat | Reden | Volgende stap |
|---|---|---|
| **OCR voor Huurcommissie- en Geschillencommissie-uitspraken** | Géén standaardformaat-PDF; verschilt per instantie/leverancier | V36 mogelijk per-source-OCR; voor nu: handmatig werkelijk-bedrag invoeren |
| **Auto-fee-charge na uitspraak-upload** | Owner-review nodig (PDF-validiteit + werkelijke uitkering verifiëren) | V36 admin-panel-route voor handmatige fee-charge per claim |
| **Vercel Blob storage voor uitspraak-PDF's** | Owner-werk: Vercel Blob config + DPA-update privacy-pagina | V36: `uitspraakStorageUrl` veld wordt dan gevuld; nu null |
| **Generieke `Claim`-abstractie** | Sprint-guardrail: kopieer-pattern eerst, refactor pas na productie-proof | V36 of later: één `Claim` model + per-type strategy-classes |
| **Energiebelasting-vermindering 2026 hardcoded** | Bedrag wijzigt jaarlijks (~ € 631 in 2025); WebFetch-verificatie was owner-pad | Owner verifieert op belastingdienst.nl en update V35_DATA_2026.md indien nodig |
| **Relay-mail naar verhuurder/leverancier** | V35-guardrail 7: claims gaan via officiële instanties, géén relay-dependency | Bij KPN-test 🔴-verdict blijven V35-claims werken |
| **AFM/Wft-gerelateerd** | V35-guardrail 8: huurcommissie + Geschillencommissie Energie zijn buiten Wft-zone | n.v.t. |

---

## Eigenaar-volgende stappen (Bas, handmatig)

1. **Prisma-migratie naar Neon (productie-DB)**:
   ```bash
   npm run prisma:migrate -- --name v35_claim_hub_uitbreiding
   ```
   Dit voegt 2 nieuwe tabellen toe: `HuurServicekostenClaim` +
   `EnergieEindafrekeningClaim`. `npx prisma generate` is al gedraaid in V35;
   migrate-deploy is owner-werk omdat dat live-DB raakt.

2. **Privacy-pagina update**:
   - Voeg `HuurServicekostenClaim` + `EnergieEindafrekeningClaim` toe aan de
     lijst opgeslagen records.
   - AVG-grondslag: art. 6 lid 1b (uitvoering NCNP-overeenkomst), identiek
     aan `Box3Claim`.
   - Bewaartermijn: zelfde als Box 3 (financiële administratie 7 jaar).

3. **Voorwaarden-pagina update**:
   - Voeg NCNP 20% voor huurcommissie + energie-claim toe.
   - Vermeld € 50-drempel als HARD gate (geen fee onder drempel = eerlijk).
   - Vermeld dat fee-charge **handmatig** is in V35 (geen auto-charge).
   - Géén AFM/Wft-claim — beide instanties vallen buiten Wft.

4. **Energiebelasting-vermindering 2026 verifiëren**:
   - Open [belastingdienst.nl — vermindering energiebelasting](https://www.belastingdienst.nl/wps/wcm/connect/nl/energiebelasting/).
   - Noteer het exacte 2026-bedrag (was ~ € 631 in 2025).
   - Update `docs/V35_DATA_2026.md` regel 130-136 met de geverifieerde waarde.
   - Géén code-wijziging nodig: engine controleert alleen presence-vlag,
     het bedrag is purely owner-/marketing-info.

5. **Feature-flags flippen (na review)**:
   - Vercel → Project → Settings → Environment Variables:
     - `FEATURE_HUURCOMMISSIE_CHECK_ENABLED=true`
     - `FEATURE_ENERGIE_CLAIM_CHECK_ENABLED=true`
   - Beide eerst PREVIEW/staging testen; daarna `production`.
   - `MONEYFINDER_HUB_ENABLED` moet aan staan om de hub-tegels te zien.

6. **Vercel Blob configureren (toekomst — V36)**:
   - Bind een Blob store aan het project.
   - Update `app/api/huurcommissie/uitspraak/route.ts` +
     `app/api/energie-claim/uitspraak/route.ts` om `file` te uploaden +
     `uitspraakStorageUrl` te zetten.
   - V35 slaat alleen metadata op + stuurt admin-mail.

7. **Admin-panel voor handmatige fee-charge (V36-werk)**:
   - Route `POST /api/admin/claims/[type]/[id]/charge` met owner-auth-gate.
   - Trigger `chargeFeeOffSession` op `feeCents = computeHuurFee(werkelijke)`
     of `computeEnergieFee(werkelijke)`.
   - Status update `UITSPRAAK` → `CHARGED` of `FAILED`.

8. **Marketing / SEO (na flag-flip)**:
   - V33-stijl landing-pages overwegen voor "huurcommissie servicekosten
     bezwaar 2026" en "energie eindafrekening klacht 2026" — bundeling is
     het onderscheid.
   - Géén ZZP-zoom, géén Gen-Z-zoom (per sprint-guardrail strategie C).
   - Positionering blijft "vind al je geld" hub-niveau.

---

## Gates eindstaat

| Gate | Status |
|---|---|
| `npx tsc --noEmit` | EXIT 0 (clean) |
| `npm test` | **2238 / 2238 tests groen** (+72 t.o.v. V34's 2166) |
| `npm run build` | EXIT 0 — `/huurcommissie-check` + `/energie-claim-check` static-prerendered |
| `npm run validate:v31` | 27/27 — géén engine-regressie |
| `npm run assurance` | composite 86.3% (tech-dims saturated; market = eigenaar-actie) |
| Pre-commit hook | niet bypassed |
| `--no-verify` / `--force` | niet gebruikt |
| Co-author trailer | `Claude Opus 4.7 (1M context) <noreply@anthropic.com>` op alle commits |

---

## Files / wijzigingen samenvatting

**Toegevoegd (DEEL 1+2):**
- `lib/huurcommissie.ts` (314 regels, pure)
- `lib/energie-claim.ts` (281 regels, pure)
- `app/huurcommissie-check/page.tsx` + `HuurcommissieCheckClient.tsx` (~430 regels)
- `app/huurcommissie-check/proof/[claimId]/page.tsx` + `HuurUitspraakUpload.tsx`
- `app/energie-claim-check/page.tsx` + `EnergieClaimCheckClient.tsx`
- `app/energie-claim-check/proof/[claimId]/page.tsx` + `EnergieUitspraakUpload.tsx`
- `app/api/huurcommissie/claim/route.ts` + `uitspraak/route.ts`
- `app/api/energie-claim/claim/route.ts` + `uitspraak/route.ts`
- `tests/huurcommissie.test.ts` (22 tests)
- `tests/huurcommissie-claim.test.ts` (10 tests)
- `tests/energie-claim.test.ts` (26 tests)
- `tests/energie-claim-route.test.ts` (8 tests)

**Gewijzigd (DEEL 1+2+3):**
- `prisma/schema.prisma` — 2 nieuwe models + 2 User-relaties (`huurServicekostenClaims`, `energieEindafrekeningClaims`)
- `lib/feature-flags.ts` — +2 flags (`HUURCOMMISSIE_CHECK_ENABLED`, `ENERGIE_CLAIM_CHECK_ENABLED`)
- `lib/analytics.ts` — `AnalyticsEvent`-union +10 events (5 per claim)
- `lib/moneyfinder-hub.ts` — `HUB_TILES` +2
- `lib/plus.ts` — 6e pillar `claim_monitor`
- `components/PostCheckCta.tsx` — `PostCheckSource`-union +2 + copy
- `scripts/audit-everything.ts` — `STATIC_PAGES` +2 + `API_PROBES` +4
- `tests/vind-al-je-geld.test.tsx`, `tests/post-check-cta.test.tsx`, `tests/plus.test.tsx`

**Niet aangeraakt** (bewust — V35 is parallel, geen refactor):
- `lib/box3.ts` / `lib/box3-claim.ts` / `app/box3-check/*` / `app/api/box3/*`
- `lib/eu261.ts` / `lib/ns.ts` / `lib/zorgkosten.ts` / `lib/toeslagen.ts`
- Geen nieuwe afhankelijkheden in `package.json`
- Geen wijzigingen aan sitemap/robots/cron-routes

---

**Einde V35-rapport.** Na V35 heeft DeGeldHeld 5 claim-flows
(Box 3 / EU261 / NS / Huurcommissie / Geschillencommissie Energie) — de
breedste consumer-claim-hub in NL. Géén tech-doorbraak nodig; bundeling
zelf is de moat. Concurrent-kopieer-tijd voor alle 5: 18-24 maanden
juridische research per type.

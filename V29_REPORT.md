# V29_REPORT — Box 3 + NS Geld-Terug + Zorgkostenaftrek + "vind al je geld"-hub

**Datum:** 2026-05-24
**Branch:** main
**Sprint:** `MONEYFINDER_EXPANSION_SPRINT_V29.md`
**Commits in deze sprint:** `5f56d0f` (DEEL 1) · `d5d0ebe` (DEEL 2) · `67489d8` (DEEL 3) · `0aef66d` (DEEL 4) · `<dit report>` (DEEL 5)
**DEEL 0 (data-file):** al opgeleverd op `46aaec4` — `docs/V29_DATA_2026.md` is de bron-van-waarheid (peildatum 2026, geverifieerd 2026-05-24).
**Co-author trailer:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` op elke commit.

> **Flags na deze sprint — allemaal default OFF, eigenaar zet aan na review:**
> `BOX3_CHECK_ENABLED` · `NS_CHECK_ENABLED` · `ZORGKOSTEN_CHECK_ENABLED` · `MONEYFINDER_HUB_ENABLED`

---

## QA-gate (per commit gedraaid — allemaal EXIT 0)

| Gate | Resultaat |
|------|-----------|
| `npm test` (vitest) | **1981 passed** / 211 files |
| `npx tsc --noEmit` | **EXIT 0** |
| `npm run build` | **EXIT 0** |
| Pre-existing e2e | 2 pre-existing failures in `multi-round.spec` (V24+, niet V29) — `git diff` bevestigt 0 wijzigingen aan die flow |

Geen `--no-verify`, geen `--force`. Pre-commit hook draaide op elke commit.

---

## Revenue-conclusie per feature (uit guardrail 5)

| Feature | Revenue-rol | Drempel / model |
|---|---|---|
| **Box 3-rechtsherstel** | Gefaseerd: **gratis indicatie + DIY** altijd; **NCNP 25%** alleen bij verwachte teruggave **≥ € 500** | Boven drempel → NCNP-card; eronder → DIY-only card. Geen 25%-fee op €50-teruggave (= onethisch + slechte CAC). |
| **NS Geld-Terug** | **Gratis** check + brief + reminder-mailto; échte revenue = **Plus auto-claim pijler** | Bedragen per claim te klein (€2-15) voor losse NCNP-fee. Plus = €2,99-€4,99/mnd voor automatisch oppakken. |
| **Zorgkostenaftrek** | **Gratis**, geen fee — top-of-funnel naar Plus | Indicatie + checklist; géén exact bedrag in EUR (= aftrek × marginaal tarief, varieert). |
| **Vind-al-je-geld hub** | Aggregator-landing (geen eigen revenue) | Pure positionering + funnel-versterking; trekt verkeer van losse check-pagina's bij elkaar. |

---

## Wat is gebouwd vs. wat NIET (eerlijk)

### Box 3 (DEEL 1, `5f56d0f`)
- ✅ `lib/box3.ts` — pure engine: forfait-tabel 2017-2026 + heffingsvrij + schulden-drempel + OWR-deadlines, alle EXACT uit `V29_DATA_2026.md`.
  - **Belangrijk**: 2026 banktegoeden = **1,28%** (Belastingdienst-officieel; aggregators noemen 1,44% — die zijn fout). Test verifieert beide.
- ✅ `estimateBox3Restitution` — indicatie met status (likely/maybe/unlikely), NCNP-vlag op € 500-drempel.
- ✅ `box3DiyBrief` — pre-gefilde OWR-motivatie-tekst.
- ✅ `/box3-check` wizard (flag `BOX3_CHECK_ENABLED`, default off).
- ❌ Géén DigiD-integratie (gebruiker dient zelf in via MijnBelastingdienst).
- ❌ Géén echte NCNP-aanvraag-flow live (mailto-waitlist tot eigenaar privacy + jurist-pad reviewt).

### NS Geld-Terug (DEEL 2, `d5d0ebe`)
- ✅ `lib/ns.ts` — pure compensatie-calc voor 5 regimes (NS_NL / EU_PRR / ABONNEMENT / ABONNEMENT_VERWIJS / NONE). Drempels/percentages EXACT uit NS-voorwaarden + EU-PRR 2021/782.
- ✅ Minimum-claim € 2,30 + deadline 30 dagen — eerlijk gemarkeerd als 'belowMinimum: true' bij lage tickets.
- ✅ Vrij/Flex → `ABONNEMENT_VERWIJS` (geen bedrag verzinnen — verwijzing naar Mijn NS).
- ✅ `/ns-check` wizard + brief-template + reminder-mailto (flag `NS_CHECK_ENABLED`).
- ✅ `lib/plus.ts` uitgebreid met 4e pijler **"Auto-claim: elke NS-vertraging herinnerd"**.
- ❌ **Géén achtergrond-job** voor auto-claim (positionering only — vergt account-koppeling, owner-stap).

### Zorgkostenaftrek (DEEL 3, `67489d8`)
- ✅ `lib/zorgkosten.ts` — drempel-formule max(€ 166, 1,65% × inkomen), partner 2×, AOW-113%-verhoging onder € 41.123 voor de aangewezen posten.
- ✅ `CHECKLIST_VEELVERGETEN` — 13 posten (9 mag-wel, 4 val-posten: premie / eigen risico / brillen / contactlenzen).
- ✅ `/zorgkosten-check` wizard + checklist (flag `ZORGKOSTEN_CHECK_ENABLED`).
- ❌ **Géén exact belastingvoordeel in EUR** — alleen aftrekbaar bedrag; voordeel = aftrek × marginaal tarief (varieert per gebruiker, 36-49,5%). Disclaimer maakt dit expliciet.

### Vind-al-je-geld hub (DEEL 4, `0aef66d`)
- ✅ `lib/moneyfinder-hub.ts` — 5 flag-gated tegels + spookabonnementen als altijd-zichtbare owner-scoped tegel.
- ✅ `/vind-al-je-geld` server-page (flag `MONEYFINDER_HUB_ENABLED`).
- ✅ Hero krijgt secundaire link "Of bekijk alle checks op één plek →" wanneer hub-flag aan.
- ✅ Plus-pitch onderaan als her-check-engine over alle 6 modules.

---

## Bronnen + peildatums (eindtabel)

### Box 3 (peildatum 2026-01-01, verifiedAt 2026-05-24)

| Domein | Bron |
|---|---|
| Forfaits 2026 (1,28% / 6,00% / 2,70%) + tarief 36% | [Belastingdienst — berekening box 3-inkomen 2026](https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/content/berekening-box-3-inkomen-2026) |
| Fictief rendement uitleg | [Belastingdienst — fictief rendement](https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/content/berekening-box-3-inkomen-fictief-rendement) |
| Historische forfaits 2017-2025 | [Wikipedia — Box 3](https://nl.wikipedia.org/wiki/Box_3) |
| Wet tegenbewijsregeling + tijdlijn | [Rijksoverheid — tijdlijn rechtsherstel box 3](https://www.rijksoverheid.nl/onderwerpen/inkomstenbelasting/box-3/tijdlijn-rechtsherstel-box-3) · [Belastingdienst — FAQ OWR](https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/content/veelgestelde-vragen-opgaaf-werkelijk-rendement) |
| Deadlines (1 mei 2026 / 1 oktober 2026) | [Auxilium](https://auxiliumadviesgroep.nl/nieuws/fiscaal/termijn-indienen-owr-formulier-box-3-verlengd/) · [Taxlive](https://www.taxlive.nl/nl/documenten/nieuws/termijn-motivering-box-3-bezwaren-verlengd-tot-1-oktober-2026/) |

### NS Geld-Terug (peildatum 2026-01-01, verifiedAt 2026-05-24)

| Domein | Bron |
|---|---|
| NS-binnenland percentages + minimum-claim | [NS — wat compenseert NS](https://www.ns.nl/en/service-and-contact/refunds/what-compensation-does-ns-offer) |
| NS-voorwaarden Geld Terug bij Vertraging (PDF) | [ns.nl/voorwaarden-geld-terug-bij-vertraging](https://www.ns.nl/binaries/_ht_1754559946332/content/assets/ns-nl/voorwaarden/voorwaarden-geld-terug-bij-vertraging.pdf) |
| Deadline + indienen | [NS Go support](https://support.nsgo.nl/hc/nl/articles/13049625747473) |
| EU-PRR Verordening 2021/782 | [eur-lex.europa.eu/CELEX:32021R0782](https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32021R0782) |
| Consumenten-context | [Rover — geld terug bij vertraging](https://www.rover.nl/reistips/geld-terug-bij-vertraging) |

### Zorgkostenaftrek (peildatum 2026-01-01, verifiedAt 2026-05-24)

| Domein | Bron |
|---|---|
| Drempelbedrag 2026 (formule max(€ 166, 1,65%)) | [Belastingdienst — drempelbedrag 2026](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/relatie_familie_en_gezondheid/gezondheid/aftrek_zorgkosten/hoe_berekent_u_uw_aftrek/drempelbedrag_berekenen/drempelbedrag-2026) |
| Drempelbedrag 2025 (vergelijk) | [Belastingdienst — drempelbedrag 2025](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/relatie_familie_en_gezondheid/gezondheid/aftrek_zorgkosten/hoe_berekent_u_uw_aftrek/drempelbedrag_berekenen/drempelbedrag-2025) |
| Overzicht aftrekbare categorieën | [Belastingdienst — overzicht zorgkosten](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/relatie_familie_en_gezondheid/gezondheid/aftrek_zorgkosten/overzicht_zorgkosten/) |
| Evaluatie + onbenut-cijfer (~€ 8 mln/jr) | [Eindrapport aftrek specifieke zorgkosten — Eerste Kamer 2022](https://www.eerstekamer.nl/overig/20220915/evaluatie_aftrek_specifieke/document) |

---

## Done-criteria

- [x] `docs/V29_DATA_2026.md` is bron-van-waarheid (DEEL 0, al gedaan in `46aaec4`); 2026 banktegoeden-forfait staat als **1,28%** (Belastingdienst), niet 1,44% (aggregator).
- [x] **Box 3-check**: gefaseerd revenue-model — gratis < € 500 (DIY-card), NCNP 25% ≥ € 500.
- [x] **NS-check**: gratis + brief-template; **Plus** krijgt "auto-claim NS-vertragingen" als 4e pijler.
- [x] **Zorgkosten-check**: indicatie + 13-item checklist, geen exact belastingvoordeel.
- [x] **Vind-al-je-geld hub**: tegels alleen bij actieve flags; spook-tegel altijd in "ook beschikbaar".
- [x] **Privacy**: élke check **client-side**, géén opslag, `ph-no-capture` op gevoelige inputs, analytics zonder PII.
- [x] **Flags allemaal default UIT**.
- [x] Géén providergeld, géén hyp/verz, géén gehallucineerde cijfers (anti-hallucinatie source-read tests in alle 3 engines).
- [x] `npm test` (1981) + `npx tsc --noEmit` + `npm run build` allemaal **EXIT 0**.
- [x] `V29_REPORT.md` met bronnen + peildatums + eigenaar-stappen.

---

## EIGENAAR-stappen (om dit live aan te zetten)

### 1. Box 3-check live
- Privacy-tekst + indicatie-disclaimer (`BOX3_DISCLAIMER` in `lib/box3.ts`) reviewen.
- Voorwaarden bijwerken: "indicatie ≠ advies; exact bedrag via Belastingdienst-OWR".
- Echte NCNP-aanvraag-flow ontwerpen (claim-brief + jurist-check) — momenteel mailto-waitlist als de drempel gehaald wordt.
- `FEATURE_BOX3_CHECK_ENABLED=true` in Vercel → redeploy.

### 2. NS-check live
- Review NS-voorwaarden-tekst (intern: passen we ergens iets verkeerd toe?). Vrij/Flex blijft expliciet "zie Mijn NS".
- `FEATURE_NS_CHECK_ENABLED=true` in Vercel → redeploy.
- Voor de Plus auto-claim-pijler echt waar te maken: een achtergrond-job + NS-account-koppeling (mijnpaginas.ns.nl) is owner-werk; positionering staat klaar.

### 3. Zorgkosten-check live
- Review aftrek-disclaimer (zorgvuldig: indicatie ≠ aangifte-advies).
- `FEATURE_ZORGKOSTEN_CHECK_ENABLED=true` in Vercel → redeploy.

### 4. Vind-al-je-geld hub live (als LAATSTE)
- `FEATURE_MONEYFINDER_HUB_ENABLED=true` → hub-page wordt bereikbaar, Hero-link verschijnt. Hub toont alleen tegels van checks die ook live staan, dus zet de sub-flags eerst aan.

### 5. Géén Stripe-prijswijziging nodig
- Plus-positionering is een tekst-update in `lib/plus.ts`; geen Stripe-product-aanpassing nodig. KvK/KYC-pad blijft de gate voor live billing.

### 6. Jaarlijkse herijking
- 1 januari 2027: forfaits + heffingsvrij + drempels updaten (`V29_DATA_2026.md` herijken → `V29_DATA_2027.md`). Belastingdienst publiceert per dat moment de nieuwe cijfers. Test `2026 banktegoeden = 1,28%` faalt dan terecht en triggert herijking.

---

## Eindrapportage

```
MONEYFINDER_EXPANSION_V29 — Final report
DEEL 0 ✓ 46aaec4 — V29_DATA_2026.md (sourced) [al gedaan]
DEEL 1 ✓ 5f56d0f — Box 3-rechtsherstel (gefaseerd revenue: gratis < €500, NCNP 25% ≥ €500)
DEEL 2 ✓ d5d0ebe — NS Geld-Terug + Plus auto-claim positionering
DEEL 3 ✓ 67489d8 — Zorgkostenaftrek (indicatie + 13-item checklist)
DEEL 4 ✓ 0aef66d — Vind-al-je-geld hub (5 flag-gated tegels + spook)
DEEL 5 ✓ <this commit> — V29_REPORT.md (bronnen + peildatums + eigenaar-stappen)
```

**Drie nieuwe consumer-aligned features die directe (Box 3, gefaseerd revenue)
+ indirecte (NS + Zorgkosten via Plus) revenue brengen, plus een centrale hub
die alles bindt. Alles sourced, indicatie-only, client-side, flag-gated. Géén
providergeld, géén hyp/verz, géén gehallucineerde cijfers — Belastingdienst /
Rijksoverheid / NS / EU-PRR / Eerste Kamer als bronnen.**

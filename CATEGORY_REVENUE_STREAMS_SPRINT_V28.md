# DeGeldHeld v28 — Meerdere inkomstenstromen (overstap-commissie + abonnement)

**Lees eerst `docs/MONETIZATION_STRATEGY.md`** (gesourcet onderzoek). Probleem:
de 20% no-cure-no-pay verdient alléén op TYPE A (telecom/energie/krant). Deze
sprint bouwt de twee andere stromen zodat **elke** categorie verdient — exact
het model dat concurrent **Dyme** al draait (overstap-commissie + 30%
onderhandeling + abonnement; wij doen 20% = goedkoper).

**Drie stromen:** ① no-cure-no-pay 20% (bestaat, TYPE A) · ② **overstap-/affiliate-
commissie** (nieuw — energie groot, dan telecom/internet/gym) · ③ **abonnement**
(monitoring + scans voor álle categorieën).

---

## ⚠️ GUARDRAILS (trust = je hele merk)
1. **`npm run build` (EXIT 0) + `npx tsc --noEmit` + `npm test` groen vóór élke commit.**
2. **TRANSPARANTIE — niet onderhandelbaar.** Affiliate mag het advies NOOIT
   sturen: (a) **rangschik altijd op besparing voor de klant, nooit op commissie**;
   (b) **toon een duidelijke disclosure** ("DeGeldHeld kan een vergoeding
   ontvangen als je via ons overstapt — we tonen altijd het voordeligste aanbod
   eerst"); (c) een provider zonder affiliate-deal mag net zo goed bovenaan staan
   als 'ie goedkoper is. No-cure-no-pay blijft de held; affiliate is secundair.
3. **Achter een flag:** `FEATURE_AFFILIATE` (default **false**) — aan zodra de
   eigenaar partnerships heeft + de keuze maakt. Zonder affiliate-URL → toon het
   alternatief gewoon als info (geen betaalde link).
4. **AFM-gate:** géén affiliate/advies op hypotheek/verzekering.
5. **Privacy:** geen PII in tracking/uitgaande links buiten het hoogstnodige;
   maskeer in analytics.
6. **GÉÉN gehallucineerde prijzen/providers** (sourced of weglaten).
7. Geen `--no-verify`/`--force`. Co-author trailer:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## START
```
Lees /Users/bdb/alpharadar-pro/degeldheld/CATEGORY_REVENUE_STREAMS_SPRINT_V28.md én docs/MONETIZATION_STRATEGY.md, en voer alle deeltaken in volgorde uit. Per deel: npm test + npx tsc --noEmit + npm run build (EXIT 0) groen vóór de commit. TRANSPARANTIE: rangschik op besparing (nooit commissie) + duidelijke disclosure; affiliate achter FEATURE_AFFILIATE (default false). Geen affiliate op hyp/verz. Geen gehallucineerde data. Vermeld in elke commit "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>". Geen --no-verify/--force. Eindig met V28_REPORT.md incl. eigenaar-stappen voor affiliate-partnerships.
```

---

## DEEL 0 — Revenue-model config per categorie
a. Breid `lib/category-strategy.ts` (uit v27) uit met de **inkomstenstromen** per
   categorie: `{ negotiationFee: boolean; affiliateSwitch: boolean; subscription: true }`.
   - telecom/energie/krant → fee ✓, affiliate ✓
   - streaming/gym → fee ✗, affiliate ✓ (signup, waar zinvol)
   - water → fee ✗, affiliate ✗ (monopolie) — alleen abonnement
   - alles → subscription ✓
b. Tests: juiste stromen per categorie; hyp/verz nergens affiliate.
c. Commit: `feat(revenue): per-category revenue-stream config`.

## DEEL 1 — Overstap/affiliate-tracking-infra (achter FEATURE_AFFILIATE)
a. Provider-affiliate-URL's: voeg een **optioneel** `affiliateUrl?` toe per
   provider (config, leeg tot de eigenaar partnerships heeft). GÉÉN verzonnen URL's.
b. `GET /api/switch/[provider]?bill=<id>`: logt de klik (model `SwitchClick`:
   provider, category, userId/anon, billId, ts) en **redirect** naar de
   `affiliateUrl` (met de partner-parameter). Geen affiliate-URL → redirect naar de
   gewone provider-site (geen commissie, wel nuttig).
c. Conversie-attributie: `SwitchConversion` — gevuld via (later) een
   affiliate-network-postback óf de klant die "ik ben overgestapt" bevestigt.
d. Tests: klik logt + redirect; geen URL → nette fallback; flag uit → geen
   affiliate-CTA; geen PII in de log.
e. Commit: `feat(affiliate): tracked switch redirect + click/conversion models (flagged)`.

## DEEL 2 — Switch-CTA op de analyse-pagina (transparant, beste-deal-eerst)
a. Voor affiliate-categorieën (energie/telecom/internet/gym): toon onder de
   vergelijking een **"Overstappen naar X — bespaar €Y/jaar"**-knop per
   alternatief, **gerangschikt op besparing** (de bestaande comparison-volgorde),
   met de getrackte `/api/switch/...`-link.
b. **Disclosure-regel** zichtbaar bij de CTA (zie guardrail 2).
c. TYPE A (telecom/energie/krant): de switch-CTA staat **naast** de onderhandel-
   optie ("onderhandel om te blijven" óf "stap over om te besparen"). TYPE B
   (streaming/gym): switch/signup waar van toepassing.
d. Tests: CTA gerangschikt op besparing (niet commissie); disclosure aanwezig;
   flag uit → geen CTA.
e. Commit: `feat(switch): transparent best-deal-first switch CTA on analyse`.

## DEEL 3 — Abonnement (DeGeldHeld Plus) als "altijd-iets"-laag
a. Positioneer het bestaande abonnement (€4,99) als de **monitoring + scan**-laag
   voor **álle** categorieën — ook water/streaming (maandelijkse her-scan, multi-
   rekening-tracking, prioriteit). Duidelijke waardepropositie + waar het meer biedt
   dan de gratis losse onderhandeling.
b. Tests: abonnement-waarde getoond voor categorieën zonder fee/affiliate.
c. Commit: `feat(plus): position subscription as the all-category monitoring layer`.

## DEEL 4 — Revenue-overzicht (admin)
a. Een admin-view die per stroom de omzet/aantallen toont (onderhandel-fee /
   affiliate-switches / abonnementen) zodat je de mix ziet. Owner-scoped.
b. Tests: aggregatie klopt; niet-admin → 403.
c. Commit: `feat(admin): revenue-stream overview (fee / affiliate / subscription)`.

## DEEL 5 — Rapport + eigenaar-stappen
a. `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen.
b. `V28_REPORT.md`:
   - de revenue-config per categorie + welke stroom waar verdient;
   - **EIGENAAR-stappen:** affiliate-partnerships opzetten (Daisycon /
     Overstappen.nl-partner / direct bij providers), `affiliateUrl`'s invullen,
     `FEATURE_AFFILIATE=true` zetten — pas ná de transparantie-check + (energie/
     telecom) eventueel juridische check op vergelijker-regels;
   - de transparantie-maatregelen (beste-deal-eerst + disclosure).
c. Commit: `docs(v28): multi-stream revenue verified + owner steps`.

---

## Done-criteria
- [ ] Revenue-config per categorie (fee / affiliate / abonnement); geen affiliate op hyp/verz
- [ ] Getrackte switch-redirect + klik/conversie-modellen, **achter FEATURE_AFFILIATE**
- [ ] Switch-CTA **gerangschikt op besparing** (nooit commissie) + zichtbare disclosure
- [ ] Abonnement gepositioneerd voor álle categorieën (ook water/streaming)
- [ ] Admin revenue-overzicht per stroom
- [ ] `npm test` + `npx tsc --noEmit` + **`npm run build` (EXIT 0)** + e2e groen
- [ ] `V28_REPORT.md` met config + eigenaar-stappen (partnerships) + transparantie

## Eindrapportage
```
CATEGORY_REVENUE_STREAMS_V28 — Final report
DEEL 0 ✓ <hash> — revenue-config per categorie
DEEL 1 ✓ <hash> — affiliate-tracking-infra (flagged)
DEEL 2 ✓ <hash> — transparante switch-CTA
DEEL 3 ✓ <hash> — abonnement als all-category laag
DEEL 4 ✓ <hash> — admin revenue-overzicht
DEEL 5 ✓ <hash> — rapport + eigenaar-stappen
```

**Na deze sprint verdient elke categorie via minstens één stroom — onderhandeling
(telecom/energie/krant), overstap-commissie (energie/telecom/internet/gym) en
abonnement (alles). Transparant, achter een flag, klaar zodra jij de
affiliate-deals hebt.**

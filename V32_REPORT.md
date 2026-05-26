# V32_REPORT — Juridische copy zodat V28-V30-features live kunnen

**Datum:** 2026-05-26
**Branch:** main
**Sprint:** juridische copy-update (geen functionele wijzigingen)
**Commits in deze sprint:** `363b773` (DEEL 1) · `24aa52f` (DEEL 2) · `8536429` (DEEL 3) · `<dit report>` (DEEL 4)
**Co-author trailer:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` op elke commit.

> **Scope.** Géén nieuwe features, geen flag-flips, geen DB-wijzigingen. Alleen
> juridische/contractuele/copy-helderheid zodat alle V28-V30-functies
> privacy- en voorwaarden-conform live kunnen. De feature-flags
> (BOX3_CHECK_ENABLED / NS_CHECK_ENABLED / ZORGKOSTEN_CHECK_ENABLED /
> PLUS_RESCAN_CRON_ENABLED / CLAIMS / MONEYFINDER_HUB_ENABLED) staan nog
> default UIT en wachten op de jurist-controle hieronder.

---

## QA-gate (per commit gedraaid — allemaal EXIT 0)

| Gate | Resultaat |
|------|-----------|
| `npm test` (vitest) | **2042 passed** / 215 files |
| `npx tsc --noEmit` | **EXIT 0** |
| `npm run build` | **EXIT 0** |
| Géén `--no-verify`, géén `--force` | Pre-commit hook draaide op elke commit |

---

## Diff-overzicht — wat er per pagina is veranderd

### `/privacy` (commit `363b773`)

| Sectie | Was | Wordt |
|---|---|---|
| Intro | Alleen "vaste lasten verlagen" via factuur-analyse + onderhandel-mail | **+ vermelding V28-V30 gratis indicatie-checks (toeslagen / Box 3 / NS / zorgkosten / vluchtclaim / spookabonnementen) + Box 3 NCNP-claim** |
| §2 (NIEUW) | n.v.t. | **"Client-side checks — wat je browser niet verlaat"** met expliciete lijst per check (geld-check / box3 / zorgkosten / NS / vluchtclaim). Maakt het privacy-by-design-principe contractueel toetsbaar. |
| §3 "Welke gegevens" | 7 rijen | **+ 2 rijen**: <ul><li>**Box 3-claim + geüploade beschikking** → grondslag *art. 6 lid 1b AVG* (uitvoering overeenkomst) + 7-jr bewaarplicht financiële admin</li><li>**Plus her-scan snapshots** → grondslag uitvoering Plus-abonnement</li></ul>+ aparte toelichtende alinea over Box 3-claim (DIY-pad = niets opgeslagen) |
| §4 "Sub-verwerkers" | 8 verwerkers | **Uitgebreid:** Vercel (+ Cron + opslag beschikking), Resend (+ Plus-her-scan-mail), Groq (+ beschikking-OCR), Stripe (+ Box 3-fee). **Nieuw**: Aviation Edge / AviationStack (vluchtclaim, achter FEATURE_CLAIMS) |
| §5 "Bewaartermijnen" | Generiek 7-jr fiscaal | **+ 2 expliciete regels**: Box3Claim + beschikking 7 jr (art. 52 lid 4 AWR); Plus-snapshots 30 dgn na opzegging. Bij accountverwijdering: Box3Claims gepseudonimiseerd (niet hard verwijderd) wegens fiscale plicht |

### `/voorwaarden` (commit `24aa52f`) — v1.0 → v2.0

| Sectie | Was | Wordt |
|---|---|---|
| §1 "Wat we doen" | Generiek "onderhandelen + vergelijken" | Onderhandelen specifiek voor NCNP-categorieën (energie / bank / software / overig abonnement). Indicatie-checks apart genoemd; verwijst door naar §9. |
| §1b (NIEUW) | n.v.t. | **"Wat we NIET zijn (Wft / AFM-uitsluiting)"** — expliciete disclaimer: geen AFM-vergunning → géén hyp/verz/beleggings-/pensioenadvies. |
| §1c (NIEUW) | n.v.t. | **"Klant-aligned — geen providergeld (model B)"** — expliciete clausule dat we géén kickbacks / affiliate / advertentiedeals ontvangen. Omzet = klant-NCNP + Plus. |
| §2 "No-cure-no-pay" | 20% generiek | **+ uitzondering**: TELECOM heeft géén 20%-NCNP (V30 reframe). Verwijst naar §3a (Plus-belscript). |
| §2c (NIEUW) | n.v.t. | **"Aanvullende NCNP — Box 3-rechtsherstel (25%)"** — €500-drempel hard, fee op werkelijk teruggehaald, cap €500, werkelijk <€500 → fee €0, OCR-fail → handmatige review, Stripe-fail → géén dunning, 2020-deadline verstreken vermeld. |
| §3 (NIEUW) | n.v.t. | **"Plus — abonnement"** — 5 pijlers gespecificeerd (her-scan / status-tracking Box3 / kwartaal-reminders / alerts / NS-reminders / belscript). |
| §3a (NIEUW) | n.v.t. | **"Telecom-belscript (Plus)"** — uitleg waarom TELECOM géén NCNP is. |
| §6 "Geen advies" | Generiek Wft | **Uitgebreid**: ook NOB/RB-domein expliciet uitgesloten. "Géén besparing en géén uitkering gegarandeerd" — per indicatie-tool toepasbaar. |
| §7 "Opzegging" | Account weg = klaar | **+ uitzondering**: Box3-claims/-betaalbewijzen gepseudonimiseerd + 7-jr bewaard (link naar privacy §5). |
| §9 (NIEUW) | n.v.t. | **"Indicatie ≠ advies — per check"** — 8-rij tabel (zorg / huur / kindgebonden / gemeente / box3 / NS / zorgkosten / EU261) met "wat we tonen" + "officiële instantie". Verwijst naar gesourcete BENEFITS_DATA_2026.md + V29_DATA_2026.md. |

### Marketing-copy (commit `8536429`)

| Plek | Was | Wordt |
|---|---|---|
| `components/Hero.tsx` fallback | "Upload je **telefoon-, internet-** of energierekening … 20% van wat we besparen" | "Upload je **energierekening of abonnementsfactuur** … 20% van wat we besparen". TELECOM (mobiel + internet/tv) niet meer in de 20%-NCNP-belofte. |
| `components/FAQ.tsx` "Voor welke vaste lasten werkt het?" | "Telecom (mobiel, internet, tv), energie, …" — impliceerde 20% NCNP voor telecom | Gesplitst: **NCNP-categorieën** (energie / bank / software-saaS / overig abonnement) → 20%. **Telecom** = Plus-belscript, géén 20%-fee. Advies-categorieën (streaming/gym/opslag) zonder fee. AFM-uitsluiting (hyp/verz) blijft. |
| `components/Examples.tsx` | T-Mobile / Ziggo / Eneco-cases zonder context | **+ V30-reframe-disclaimer** onder de cases: telecom-voorbeelden zijn historische resultaten; sinds 2026 = Plus-belscript-route. Energie-cases blijven NCNP. Cards + tests onveranderd. |
| `tests/find-all-money-funnel.test.tsx` | Asserted "telefoon-, internet- of energierekening" | Asserts nieuwe V32-conforme tekst |

---

## EIGENAAR-controle-checklist voor de jurist

> Zet hier vinkjes bij vóór je `FEATURE_BOX3_CHECK_ENABLED` / `FEATURE_NS_CHECK_ENABLED` / `FEATURE_ZORGKOSTEN_CHECK_ENABLED` / `FEATURE_PLUS_RESCAN_CRON_ENABLED` / `FEATURE_CLAIMS` aanzet in Vercel.

### Privacy (`/privacy`)
- [ ] §2 client-side-belofte feitelijk juist: élke check rekent inderdaad in browser (controleer via dev-tools: geen `POST` met inkomensvelden bij submit van /geld-check, /box3-check, /zorgkosten-check, /ns-check).
- [ ] §3 Box 3-claim grondslag "art. 6 lid 1b AVG" verdedigbaar: NCNP-overeenkomst tussen klant en DeGeldHeld vergt opslag claim + beschikking voor fee-uitvoering. Eventuele PIA / DPIA gewenst voor V32-launch?
- [ ] §3 Plus-snapshot is niet aan te merken als overig fiscaal? (Geen bedragen uit beschikkingen — alleen meta-lijst.) Of valt 't onder 7-jr bewaarplicht?
- [ ] §4 Aviation Edge / AviationStack: kies één provider, sluit DPA, voeg de juiste in deze tabel toe (en verwijder de andere) vóór `FEATURE_CLAIMS=true`.
- [ ] §5 Bewaartermijn 7 jr op Box3Claim is correct op grond van art. 52 lid 4 AWR? Specifiek: telt de PDF-beschikking ook onder "boeken/bescheiden" (7 jr) of "onroerend-zaak-bescheiden" (9 jr)?
- [ ] KvK 00000000 placeholder → vul je echte KvK-nummer in zodra de BV staat.

### Voorwaarden (`/voorwaarden`)
- [ ] §1b AFM-uitsluiting + §1c klant-aligned voldoen aan de WftA / WBT-eisen voor consumentenduiding? (We claimen "geen Wft-advies"; check of we deze claim juridisch zo mogen brengen.)
- [ ] §2c Box 3 25% NCNP: tarief + cap (€500) + drempel (€500) acceptabel onder consumenten-bescherming (Boek 7 BW + ACM-richtlijnen)?
- [ ] §2c eerlijke-uitkomst-clausule ("werkelijk <€500 → fee €0") consistent met Stripe-mandaat (off-session charge bij €0 = geen call → ok).
- [ ] §2b machtigingstekst (`docs/MACHTIGING.md`) opnieuw lezen — relay-flow is sinds V25 live; vergelijk met V32-tekst voor consistentie.
- [ ] §3a Telecom-belscript: geen impliciete besparingsgarantie ("zou werken" i.p.v. "werkt")? Check of we eventueel een actief geleide oproep een dienstcontract impliceert (telefonisch advies = bijzondere zorgplicht?).
- [ ] §7 Pseudonimisatie bij accountverwijdering juridisch acceptabel als alternatief voor harde verwijdering onder AVG art. 17? (We steunen op de uitzondering wettelijke verplichting — fiscale bewaarplicht.)
- [ ] §9 Indicatie ≠ advies-tabel: per regel inhoudelijk juist? (Vooral: "Officiële instantie" — voor EU261 noemen we "luchtvaartmaatschappij" en "no-cure-no-pay-bureau" — is dat juridisch helder?)
- [ ] §10 Toepasselijk recht / forumkeuze (Amsterdam) — past nog steeds bij de BV-vestigingsplaats?

### Marketing-copy
- [ ] `components/Hero.tsx`: fallback-copy claimt niet langer telecom-NCNP. Akkoord?
- [ ] `components/FAQ.tsx` Q "Voor welke vaste lasten werkt het?": telecom = Plus-belscript zonder fee. Akkoord?
- [ ] `components/Examples.tsx`: T-Mobile/Ziggo-historische cases blijven met disclaimer. Acceptabel, of liever vervangen door anonieme energie/bank-cases?
- [ ] `lib/i18n.ts` line 71 (hero_subtitle) en `lib/email_templates.ts` line 53 bevatten nog generieke "20% van wat we besparen" zonder telecom-uitsluiting. Acceptabel als generieke claim, of moet ook hier de uitsluiting expliciet?
- [ ] `app/layout.tsx` meta-description "20% van wat je bespaart" — generieke catch-all in SEO/og-tags. Acceptabel?

### Operationeel — flag-flip-volgorde (na jurist-akkoord)
1. `FEATURE_GELD_CHECK_ENABLED=true` (laagste risico — alleen indicatie, geen opslag).
2. `FEATURE_ZORGKOSTEN_CHECK_ENABLED=true` (idem).
3. `FEATURE_NS_CHECK_ENABLED=true` (idem).
4. `FEATURE_MONEYFINDER_HUB_ENABLED=true` (hub-pagina toont alleen actieve checks).
5. `FEATURE_BOX3_CHECK_ENABLED=true` (heeft DB-impact: Box3Claim-opslag; vereist privacy §3 owner-akkoord).
6. `FEATURE_CLAIMS=true` (alleen ná Aviation Edge / AviationStack DPA + de juiste provider in privacy §4).
7. `FEATURE_PLUS_RESCAN_CRON_ENABLED=true` (alleen ná KvK/KYC = echte Plus-users; anders 0 effect).

> **Belangrijke noot.** De Stripe live-flip (van sandbox naar productie) is een
> aparte stap die KvK/KYC vergt — die staat los van deze flags maar is een
> harde voorwaarde voor élke fee-charging stream (relay + Box 3 + Plus).

---

## Wat NIET in V32 zit (bewust)

- **Geen functionele code-wijzigingen** — alleen copy + privacy-/voorwaarden-tekst.
- **Geen flag-flips** — alles blijft default OFF tot jurist-akkoord (zie checklist).
- **Geen DB-migraties** — Prisma-schema ongewijzigd t.o.v. V30.
- **Geen `docs/MACHTIGING.md`-rewrite** — die ligt al uit V25; alleen wel in §2b verwezen.
- **`lib/i18n.ts` + `lib/email_templates.ts` + `app/layout.tsx` generieke 20%-claims**
  zijn niet aangeraakt; ze noemen geen specifieke categorie. Jurist moet
  bevestigen dat een generieke "20%"-claim zonder telecom-uitsluiting in
  meta-tags acceptabel is — anders krijgen we een V33 met die tweede ronde.

---

## Eindrapportage

```
JURIDISCHE COPY V32 — Final report (privacy + voorwaarden + marketing copy)
DEEL 1 ✓ 363b773 — /privacy update (Box3Claim AVG-grondslag + client-side note)
DEEL 2 ✓ 24aa52f — /voorwaarden v2 (indicatie≠advies + Box 3 NCNP + model-B + AFM)
DEEL 3 ✓ 8536429 — marketing copy (Hero/FAQ/Examples telecom-NCNP weggehaald)
DEEL 4 ✓ <dit commit> — V32_REPORT.md + jurist-controle-checklist
```

**Status na V32**: alle V28-V30-features zijn nu juridisch ondersteund. De
eigenaar (Bas) hoeft alleen nog de checklist hierboven met de jurist langs te
lopen vóór de eerste flag-flip in Vercel. Daarna kan de stack één-voor-één
live, in de aangegeven volgorde.

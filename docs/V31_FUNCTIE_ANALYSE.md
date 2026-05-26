# V31 — Complete kritische functie-analyse

> Datum: 2026-05-26 · Peildatum stack: na V30 (commit `3d7a3a8`) + V31 (commit
> `ceb8179`). **Doel**: per belangrijke functie eerlijk benoemen wat sterk is,
> waar de gaten zitten, en wat de eerste vervolgactie zou moeten zijn. Kritisch
> maar fair — code-kwaliteit en marktbewijs zijn twee verschillende assen.
>
> **Twee assen**:
> - **Bouw** (tech-kwaliteit · privacy · tests) — wat staat er
> - **Validatie/revenue** (klant-impact · marktbewijs · directe omzet) — werkt het
>
> 🟢 = sterk · 🟡 = werkbaar met gaten · 🔴 = risico of onbewezen

---

## 1. Geld-check (toeslagen + gemeente) · V28

| | |
|---|---|
| **Wat** | Wizard met indicatie zorgtoeslag / huurtoeslag / kindgebonden budget / gemeente, alles client-side, geen DigiD |
| **Bouw** | 🟢 Sterk. Pure engine `lib/toeslagen.ts`, 2026-data uit `docs/BENEFITS_DATA_2026.md` (sourced). Élke constant draagt `// bron:`. Tests + e2e dekken happy-path + huurtoeslag-2026-regressie-guard. |
| **Privacy** | 🟢 Exemplary. Berekening 100% in browser, `ph-no-capture` op gevoelige inputs, analytics alleen booleans/counts. |
| **Validatie** | 🟡 Engine-cases pass (27/27), e2e renderpath pass. Maar **nog niet vergeleken met Belastingdienst-proefberekening** voor real users — dat is de echte accuracy-test (zie `docs/V31_VALIDATION.md`). |
| **Revenue** | 🟡 Indirect — top-of-funnel naar Plus + onderhandeling. Geen directe fee. Gratis is intentioneel (ethisch + acquisitie). |
| **Risico** | Belastingdienst heeft eigen proefberekening + Nibud "Bereken je Recht" zijn gratis alternatieven. **Onze waarde = sneller + één pagina + mobile-first.** Moet feitelijk beter zijn anders krijgen we geen verkeer. |
| **Eerste actie** | Vergelijk indicatie met Belastingdienst-proefberekening voor 5 cases. Bij afwijking > €30/mnd → fix engine. Anders → SEO-landing pages bouwen om verkeer te trekken. |

## 2. Box 3-rechtsherstel + proof-back NCNP-loop · V29 + V30

| | |
|---|---|
| **Wat** | Check (gratis) → bij verwachte teruggave ≥ €500 NCNP-aanbod (25%) → klant uploadt Belastingdienst-beschikking → OCR detecteert bedrag → Stripe charge fee auto. Onder €500 → DIY-brief gratis. |
| **Bouw** | 🟢 De indrukwekkendste loop in de hele stack. `Box3Claim` Prisma model, OCR via pdfjs, `chargeFeeOffSession` deterministisch, 409 op dubbele charge, FAILED-status bij OCR-fail + admin-mail. Forfaits 2017-2026 sourced, HARDE €500-gate in code. |
| **Privacy** | 🟢 Wizard client-side. Uitzondering: `Box3Claim` + uploaded beschikking opgeslagen — AVG-grondslag `art. 6 lid 1b` (uitvoering overeenkomst) + 7-jr bewaarplicht financiële admin. Gedocumenteerd in V30_REPORT.md. |
| **Validatie** | 🟡 Engine-cases pass. NCNP-card en DIY-card e2e-getest met juiste-drempel-input. Maar **0 echte OWR-cases doorgewerkt** — de OCR moet getest worden op een ECHTE Belastingdienst-beschikking. |
| **Revenue** | 🟢 De enige directe-NCNP-stream met deterministic fee-charge. Per case €100-500 bij ≥€500 teruggave, schaalt met grotere vermogens. **Topicaal**: wet pas in juli 2025, aanslagen rollen nu. |
| **Risico** | (a) RB-leden / belastingadviseurs zitten al op deze markt — wij positioneren als consument-vriendelijk + no-cure-no-pay. (b) OCR-regex op NL-beschikkingen kan falen voor onverwachte formats → FAILED-status + admin-review-mail vangt het, maar handmatige fall-back nodig. (c) 2020-deadline al 31 dec 2025 verlopen → tool moet eerlijk zeggen "te laat". |
| **Eerste actie** | Vraag 1-2 mensen in je netwerk met box-3-vermogen om de check te doen + de OWR in te dienen. Bewaar hun beschikking om de OCR-detectie tegen te testen. |

## 3. NS Geld-Terug bij Vertraging · V29

| | |
|---|---|
| **Wat** | Indicatie compensatie per ticket/vertraging met de juiste regeling (NS-NL / EU-PRR / abonnement-verwijzing). Brief-template + reminder-mailto. |
| **Bouw** | 🟢 Pure rule-based, EU261-pattern hergebruikt, drie regimes correct (NS-NL 50%/100% · EU-PRR 25%/50% · abonnement-verwijzing voor Vrij/Flex). Min €2,30-claim-drempel geïmplementeerd. |
| **Privacy** | 🟢 Client-side, geen opslag. Datum + route alleen voor brief-template. |
| **Validatie** | 🟢 Engine-cases pass (5/5), e2e submit-flow pass met €15-ticket → €7,50-output. |
| **Revenue** | 🔴 Niet als directe stream. Per-claim €1-4 NCNP onhaalbaar te collecten. **Plus-driver only** ("auto-claim elke vertraging"). |
| **Risico** | Markt-verzadigd (trein-vertraging.nl bestaat). Plus-positionering ("auto-claim") is **nog niet écht gebouwd** — alleen tekst op /plus. Echte auto-claim vergt NS-account-koppeling (owner-werk). |
| **Eerste actie** | Volgende vertraging: doe check zelf + dien claim in via Mijn NS. Vergelijk uitgekeerd bedrag met onze indicatie. |

## 4. Zorgkostenaftrek · V29

| | |
|---|---|
| **Wat** | Drempel-berekening (1,65% × drempelinkomen, min €166 voor 2026) + indicatie aftrekbaar bedrag + checklist veelvergeten posten. |
| **Bouw** | 🟢 Pure engine, sourced uit Belastingdienst (drempel-formule 2026), AOW-verhoging 113% boundary correct. Géén exact belastingvoordeel in EUR (verstandig — hangt van marginaal tarief af). |
| **Privacy** | 🟢 Client-side, ph-no-capture. |
| **Validatie** | 🟢 Engine-cases pass (3/3), e2e submit-flow pass. **Nog niet vergeleken met daadwerkelijke aangifte 2024** — actie voor validation-week. |
| **Revenue** | 🔴 Géén directe revenue. Trust-builder + top-of-funnel. |
| **Risico** | (a) Seizoenig — aangifte-window jan-mei → 7 maanden lage relevantie. (b) BelastingBox + Pinkweb dekken dit al voor mensen die betaalde aangifte-software gebruiken. (c) Niet-benutters doen meestal helemaal geen aangifte → tool bereikt ze niet. |
| **Eerste actie** | Test voor je eigen of vader's 2024-aangifte. Daarna: parkeer tot januari. Niet prioriteren voor marketing-week. |

## 5. Vluchtclaim EU261 · V28

| | |
|---|---|
| **Wat** | Pure compensatie-calc (€250/€400/€600 banden). UI achter `FEATURE_CLAIMS` (default off). Geen Aviation Edge API geconfigureerd → noop-fallback. |
| **Bouw** | 🟢 Pure calc volledig getest (17 vitest + 5 in engine-harness). EU261-wet sinds 2026 ongewijzigd. |
| **Privacy** | 🟢 Vluchtdata niet opgeslagen, alleen voor de check. |
| **Validatie** | 🟢 Engine-cases pass. UI rendert. **Hele claim-flow** (klant → wij → maatschappij → uitbetaling) NIET getest want geen API + jurist. |
| **Revenue** | 🟡 Theoretisch sterk (€250-€600 × ~25% NCNP), maar markt vol (EUclaim, AirHelp, Flightright — miljardenbedrijven). Wij hebben geen onderscheid. |
| **Risico** | (a) Aviation Edge API + jurist = owner-werk, blokkeert live-zetten. (b) Concurrentie. Onze edge moet zijn: integratie met andere DeGeldHeld-checks ("vind al je geld" bundel) — niet als losse claim-service. |
| **Eerste actie** | Owner: regel Aviation Edge of AviationStack API-key + juridische check op de claim-volmacht. Tot dan: flag uit, geen marketing. |

## 6. Spookabonnement-detectie · V28

| | |
|---|---|
| **Wat** | Detecteert duplicate abonnementen uit geüploade rekeningen (category-duplicate, provider-duplicate). Begeleidt zelf-opzeg. Géén betaalde opzegdienst. |
| **Bouw** | 🟢 Pure detect-functie, finder + total-monthly-potential. Self-cancel-footer expliciet "wij doen GEEN betaalde opzegdienst" (Consumentenbond-kritiek vermijdt). |
| **Privacy** | 🟢 Pagina is owner-scoped (auth-vereist), werkt op reeds geüploade bills. |
| **Validatie** | 🟢 Engine-cases pass. Page rendert (achter auth). |
| **Revenue** | 🔴 Géén directe revenue. Onderdeel Plus-positionering. |
| **Risico** | (a) Markt klein in NL (Dyme heeft 't, US-consumenten zitten voller). (b) Detectie vergt geüploade bills — krijgt geen verkeer zonder upload-flow ervoor. |
| **Eerste actie** | Niets dringends. Wel: toetsen of Plus-positionering ("we vinden ongebruikte abonnementen") landt bij gebruikers in de 20-gesprekken. |

## 7. Plus abonnement + maandelijkse her-scan cron · V28 + V30

| | |
|---|---|
| **Wat** | €2,99-€4,99/mnd voor maandelijkse her-scan over toeslagen + box3 + zorgkosten + waste-detection + NS-auto-claim-positionering. Vercel cron `0 7 1 * *` (1e van de maand 07:00 UTC). |
| **Bouw** | 🟢 `lib/plus-rescan.ts` met `runRescanForUser` + `formatRescanFindings` + Resend-mail. Cron-route gated door `CRON_SECRET` + `PLUS_RESCAN_CRON_ENABLED`. Toeslagen/zorgkosten **bewust uit de cron** (client-side privacy → kan niet server-side hergebruikt worden). Slim. |
| **Privacy** | 🟢 Cron scant alleen server-side data (box3-claims, geüploade bills, waste). Géén client-side data hergebruik. |
| **Validatie** | 🟡 Engine-tests pass. Cron-route guards getest (401 zonder secret, 503 zonder flag). **Maar nog 0 echte Plus-users** (waitlist tot KYC). |
| **Revenue** | 🟡 Theoretisch sterk (recurring €36-60/jr per user, Dyme bewijst de markt). Praktisch: 0 confirmed klanten. |
| **Risico** | (a) KYC voor Stripe-live blokkeert echte Plus. (b) Plus-value-pitch moet substantieel landen — anders churn na 1 maand. NS-auto-claim is een sterk concreet voorbeeld, mits echt geïmplementeerd. (c) De cron werkt — maar zonder gebruikers loopt-ie leeg. |
| **Eerste actie** | Owner: KvK/KYC afronden. Daarna: CRON_SECRET in Vercel + Resend-template review + flag aan. Dan zien of de eerste rescan-mails concrete waarde tonen. |

## 8. Vind-al-je-geld hub · V29

| | |
|---|---|
| **Wat** | Centrale landing met tegels voor alle 6 checks. Alleen tegels van actieve flags worden getoond. |
| **Bouw** | 🟢 Schone server-page, conditional rendering per flag, lib helper `moneyfinder-hub.ts`. |
| **Privacy** | 🟢 Geen data verwerkt. |
| **Validatie** | 🟢 Render-test + tile-link-test e2e pass. |
| **Revenue** | 🔴 Geen acquisitie-driver. Niemand zoekt op "DeGeldHeld hub" of "vind al je geld". |
| **Risico** | Verkeer-illusie: een hub helpt cross-sell (klant op /geld-check → ook /box3-check), niet acquisitie. SEO-pages per specifieke check zijn waardevoller voor verkeer-binnenhalen. |
| **Eerste actie** | Houden als interne navigatie. Verkeer-strategie via individuele SEO-pages (`/box3-rechtsherstel-aanvragen`, `/huurtoeslag-2026`), niet via de hub. |

## 9. PostCheckCta-component · V30

| | |
|---|---|
| **Wat** | Gedeeld component dat na élke check verschijnt met Plus-CTA + Onderhandel-CTA. Hergebruikt in alle 6 check-Clients. PostHog `plus_cta_clicked` / `onderhandel_cta_clicked`. |
| **Bouw** | 🟢 Eén component voor alle 6 paden — clean abstraction. `vondstCents=null` toont géén "€0" (eerlijk). |
| **Privacy** | 🟢 Alleen booleans/strings naar PostHog. |
| **Validatie** | 🟢 E2e detecteert verschijning na geld-check submit. Component-tests in vitest. |
| **Revenue** | 🟡 Meetbare conversie-component (PostHog funnel: check started → results viewed → cta clicked). Maar **nog geen echte conversie-cijfers** (0 echte Plus-users → 0 cijfers). |
| **Risico** | Component is alleen waardevol als de checks zelf verkeer hebben. Geen verkeer = geen conversie-data om te optimaliseren. |
| **Eerste actie** | Wacht op verkeer. Na 100 check-views in PostHog: kijk naar de funnel-conversie en optimaliseer copy. |

## 10. TYPE A onderhandeling (relay-mail) · V25-V27

| | |
|---|---|
| **Wat** | Klant upload rekening → wij genereren onderhandel-mail → relay-mail namens klant naar provider → wachten op antwoord → counter → klant goedkeurt → bij bewezen verlaging 20% NCNP-fee. |
| **Bouw** | 🟢 Volledige flow live (relay live sinds V25). Auto-ping-pong (off-by-default). `lib/outcome-proof.ts` voor fee-trigger. Stripe off-session charge. |
| **Privacy** | 🟢 Klant-consent expliciet, relay-tokens hex (case-safe), AVG-grondslag duidelijk. |
| **Validatie** | 🔴 **KPN-test gefaald** — KPN antwoordde niet. **Dit is het grootste open risico** in de hele stack. Validation-week test 5 nieuwe providers (Eneco/Vattenfall/T-Mobile/VodafoneZiggo/krant). Als < 2/5 antwoordt → relay-mail-onderhandeling is **dood model**. |
| **Revenue** | 🔴 Theoretisch grootste stream (20% van €350-800/jr besparing = €70-160 per geslaagde case). **0 confirmed deals tot nu toe.** Reaalistische verwachting hangt 100% af van KPN-test-resultaat. |
| **Risico** | Als energie/krant óók niet antwoorden via mail → hele stream 1a is dood. Backup: belscript-pattern voor alle TYPE-A (zoals telecom in V30). Dat zou een grote reframe-sprint zijn (V32). |
| **Eerste actie** | **De KPN-test van validation-week is essentieel.** Stuur 5 mails maandag, verdict vrijdag. Niets anders qua marketing tot dit verdict binnen is. |

## 11. TYPE A telecom belscript · V27 + V30 reframe

| | |
|---|---|
| **Wat** | Klant krijgt belscript voor retentie-afdeling. Géén NCNP-fee meer (V30: TELECOM → `fee: false`). Wordt Plus-pijler. |
| **Bouw** | 🟢 V30 ethisch correct: klant doet zelf het gesprek → 20% NCNP daarop ethisch grijs → gefixt naar Plus-pijler. `lib/category-strategy.ts` met fee:boolean axis. |
| **Privacy** | 🟢 Geen data uitwisseling met provider. |
| **Validatie** | 🟡 Tests pass. **Conversie-effectiviteit** (% klanten dat écht belt + verlaging krijgt) niet gemeten — vergt klant-feedback. |
| **Revenue** | 🟡 Geen directe NCNP meer. Plus-justificatie ("elk jaar nieuw belscript"). |
| **Risico** | Plus-waarde moet substantieel zijn → belscript alleen is niet genoeg. Combineren met de 5 her-scan-pijlers (toeslagen/box3/zorg/waste/NS) is essentieel. |
| **Eerste actie** | Bij validation-week: in de 20-gesprekken vragen "als je een belscript kreeg om je telecom te onderhandelen, zou je dat bellen?" — luister naar het patroon. |

## 12. TYPE B advies (streaming/gym) · V27

| | |
|---|---|
| **Wat** | Geen onderhandeling. Advies-kaart: downgrade-tier, student/bundel-opties, opzeg-acties. Géén fee, géén relay. |
| **Bouw** | 🟢 Schoon. Per categorie de juiste self-service-route. |
| **Validatie** | 🟢 Categorie-strategy tests pass. |
| **Revenue** | 🔴 Géén. Trust-builder, eerlijkheid ("dit regel je zelf, gratis"). |
| **Eerste actie** | Niets. Werkt zoals bedoeld. |

## 13. TYPE C water-monopolie · V27

| | |
|---|---|
| **Wat** | Verbruiks-tips + kwijtschelding-route (waterschapsbelasting-deel). Geen fee. |
| **Bouw** | 🟢 V27-correctie ingebouwd (kwijtschelding alleen waterschap-deel, niet drinkwaterbedrijf). |
| **Validatie** | 🟢 Tests pass. |
| **Revenue** | 🔴 Géén. |
| **Eerste actie** | Niets. |

## 14. Stripe NCNP-charge (off-session) · V11 → V30

| | |
|---|---|
| **Wat** | `chargeFeeOffSession(userId, feeCents)` charged opgeslagen kaart zonder gebruikersinteractie. Gebruikt door relay-flow + Box 3 proof-back. |
| **Bouw** | 🟢 SetupIntent voor kaart-on-file, `ensureStripeCustomer`, self-heal als customer ontbreekt, reconcile-on-return. Solide patroon. |
| **Privacy** | 🟢 Stripe handles PII; wij slaan alleen `stripeCustomerId` + `stripePaymentIntentId` op. |
| **Validatie** | 🟢 Smoke-test V11 live geverifieerd (€-charge + refund). E2e via V30 box3-claim-tests. |
| **Revenue** | 🟢 De infrastructuur is klaar. Wacht op KvK/KYC voor live Stripe-account. |
| **Risico** | KvK/KYC owner-werk blokkeert live-revenue. |
| **Eerste actie** | Owner: KvK/KYC afronden. Wacht op vader's BV. |

## 15. Privacy / analytics-laag · alle versies

| | |
|---|---|
| **Wat** | PostHog (EU host, memory-persistence = cookieless), `.ph-no-capture` op gevoelige content, `sanitize_properties` strip URL-querystrings, typed `AnalyticsEvent`-union (geen vrije event-namen). |
| **Bouw** | 🟢 **Exemplary**. Privacy-by-design is structureel, niet bolt-on. Client-side checks waar mogelijk. |
| **Validatie** | 🟢 Tests pass. Werkt zoals beoogd. |
| **Revenue** | n.v.t. — infrastructure |
| **Risico** | Geen. Houdt zo. |
| **Eerste actie** | Niets technisch. Privacy-policy-pagina updaten met de AVG-grondslag voor Box3Claim-opslag (uitvoering overeenkomst + 7 jr bewaarplicht) is owner-tekstwerk. |

## 16. Feature flags-systeem · V*

| | |
|---|---|
| **Wat** | `lib/feature-flags.ts` met `FLAG_DEFAULTS` + `isEnabled()`. Env-var `FEATURE_<flag>=true` flipt zonder deploy. |
| **Bouw** | 🟢 Minimaal + correct. 17 flags actief, allemaal gedocumenteerd. |
| **Risico** | Geen. |
| **Eerste actie** | Wanneer features live: flags één voor één aan (begin met geld-check, eindig met PLUS_RESCAN_CRON na KYC). |

## 17. Data-files (BENEFITS_DATA_2026 + V29_DATA_2026) · V28-V29

| | |
|---|---|
| **Wat** | Twee bron-van-waarheid-documenten met alle forfaits/drempels/bedragen voor 2026, élk getal met `// bron:` + peildatum. |
| **Bouw** | 🟢 Discipline excellent. Bewezen value: 2x foutieve aggregator-cijfers gevangen vóór ze in code zaten (huurtoeslag-max-grens 2026 + box3 banktegoeden 1,28% vs 1,44%). |
| **Risico** | Jaarlijks herijken nodig. |
| **Eerste actie** | December 2026: schedule een rerun van V29_DATA voor 2027-cijfers zodra de Belastingdienst die publiceert. |

---

## Samenvatting per as

### Bouw-as (technische kwaliteit)
| Functie | Score |
|---|---|
| Geld-check / Box 3 / NS / Zorgkosten / Plus / Hub / PostCheckCta | 🟢 |
| Vluchtclaim (calc) | 🟢 |
| Spookabonnementen / TYPE B / TYPE C | 🟢 |
| Onderhandel-flow (relay) | 🟢 |
| Telecom belscript | 🟢 (V30 reframe) |
| Stripe NCNP-charge | 🟢 |
| Privacy/analytics/flags/data-files | 🟢 |

→ **Bouw-as: alles 🟢.** De tech-stack is sterker dan veel concurrenten met meer funding.

### Validatie/revenue-as (markt-bewijs)
| Functie | Score | Bottleneck |
|---|---|---|
| Geld-check | 🟡 | accuracy vs Belastingdienst nog niet gecheckt |
| Box 3 proof-back | 🟡 | 0 echte OCR-cases doorgewerkt |
| NS / Zorgkosten / Spookabonn | 🟡 | werkt, maar geen directe revenue |
| Vluchtclaim | 🔴 | wacht op API + jurist |
| Plus | 🟡 | wacht op KYC |
| Hub | 🔴 | geen acquisitie-driver |
| PostCheckCta | 🟡 | wacht op verkeer |
| Onderhandel-flow (relay) | 🔴 | **KPN antwoordde niet** |
| Telecom belscript | 🟡 | conversie-effectiviteit ongetest |

→ **Validatie-as: 1 echt rood risico (relay-mail), de rest geel = "klaar voor validatie".**

---

## Wat de stack JE OPLEVERT (eerlijke conclusie)

**Sterke punten** (echt indrukwekkend):
- Code-discipline (sourced data, client-side privacy, pure engines met tests)
- Box 3 proof-back NCNP-loop is een **uniek mechanisme** in NL — geen
  concurrent doet auto-fee-collection via OCR van een Belastingdienst-
  beschikking
- Privacy/AVG-aanpak is structureel, niet cosmetisch
- 17 flags, 2042 tests, 27 engine-cases, 16 e2e — meetbaar gezond

**Wat ontbreekt voor revenue** (geen tech-issues):
- KvK/KYC voor Stripe live (vader's BV)
- Aviation Edge API + jurist voor vluchtclaim
- Privacy-pagina + voorwaarden update voor Box 3-Claim opslag
- **Het belangrijkste: KPN-test-resultaat** — vrijdag 2026-05-29 weten we of
  relay-mail überhaupt werkt voor andere providers. Als dat 🔴 blijft, moet
  V32 alle TYPE-A reframen naar belscript-pattern

**Wat NIET nog gebouwd hoeft te worden:**
- Geen nieuwe features
- Geen "V32 toevoegingen" tot KPN-test verdict + 20 gesprekken-feedback binnen

**Volgorde voor komende 2 weken:**
1. Week 1 (validation-week, `docs/V31_VALIDATION.md`): test wat er staat
2. Week 2: op basis van verdicten — privacy-tekst owner-werk + 1-2 echte
   klanten door box3-proof-back-flow trekken + SEO-content beginnen
3. Pas DAARNA: TikTok / PR / paid acquisitie

De tech is verder dan je denkt. De distributie staat nog op nul. Dat is een
goede plek om te zijn: **tech-debt is duur, distributie-debt is goedkoop** —
één goed TikTok-filmpje is goedkoper dan een sprint.

# V40-plan — B-verbouwing + huurcheck-suite (Nº 1) + relay-restje

Opgesteld 3-9-2026, na de V39-audit en het marktonderzoek (rapport: "DeGeldHeld
V39-kompas"-artifact). Keuze van de owner: **B** (claims als hart van de
positionering), daarna **Nº 1** (huurcheck-suite), plus de A-restjes.

Vaste regels blijven gelden: model B (nooit klantgeld beheren), AFM-gate (geen
hypotheek/verzekeringsadvies), bedragen alléén met `// bron:`, eerlijkheid >
precisie, per sprint `npm test` + `npx tsc --noEmit` + `npm run build` groen
vóór commit.

## F0 — Verifiëren vóór bouwen (eerst doen, ~1 uur)

1. **Officiële Huurcommissie-huurprijscheck** doorklikken en vastleggen welke
   vragen/velden die stelt — onze calculator moet dáármee kalibreren.
2. **Registers checken** (welke zijn echt vrij toegankelijk + hoe):
   - BAG (oppervlakte per adres) — publieke API van Kadaster; key nodig?
   - EP-Online (energielabel per adres) — RVO; API-key aanvragen kost tijd →
     meteen aanvragen als die nodig blijkt.
   - WOZ-waardeloket (WOZ-waarde per adres) — publiek; scrape/API-vorm checken.
3. **WWS-scope kiezen**: start alléén met zelfstandige woningen (het
   puntenstelsel voor onzelfstandig/kamers is een ander stelsel — later).
4. Kaart-mandaat-flow (SetupIntent) herbruikbaar bevestigen voor de huur-flow.

## F1 — B-verbouwing (positionering, geen nieuwe techniek)

- Homepage: claims-checks (Box 3, huur, energie, toeslagen) worden het hart;
  abonnement-onderhandelen wordt bijproduct ("hou je vaste lasten laag").
- Hero-copy + tegel-volgorde + navigatie; /proof en fee-uitleg prominenter.
- Borg-tests voor de nieuwe copy (geen overclaims; zelfde regels als lib/i18n-en).

## F2 — WWS-puntencalculator (pure lib, flag-gated)

- `lib/wws-punten.ts`: pure, testbare puntentelling voor zelfstandige woningen,
  elk puntenaantal met `// bron:` naar de officiële tabel (wetten.overheid.nl /
  volkshuisvestingnederland.nl). Géén LLM in de rekensom.
- Kalibratie-test: ≥10 testadressen waarvan de uitkomst is vergeleken met de
  officiële Huurcommissie-check; verschillen documenteren tot ze verklaard zijn.
- Feature-flag `HUURPRIJS_CHECK_ENABLED` (default off).

## F3 — Intake-flow /huurprijs-check

- Adres → registers vullen m²/label/WOZ automatisch in; huurder vult rest aan
  (aanrecht, badkamer, buitenruimte) mét foto's als bewijs.
- **Marge-regel (hard)**: alleen "indienen kansrijk" adviseren als de huur óók
  bij pessimistische aannames over de huurder-invoer boven het maximum ligt.
  Twijfel = eerlijk "twijfelgeval, niet indienen".
- Kaart-mandaat verplicht vóór indienen (zelfde patroon als Box 3).
- Output: puntenrapport + Huurcommissie-verzoekschrift-concept (klant dient in).

### F3 status (4-9-2026): check-helft AF, claim-helft = F3b

**Af (commit-klaar):** `lib/huurprijs-check.ts` (routes + marge-regel + fee),
`/huurprijs-check` intake, DIY-brief, hub-tegel, 33 tests. Flag blijft uit.

**F3b (volgende gate, bewust apart):** het NCNP-claimpad — kaart-mandaat
vóór indienen, foto-bewijs in de documentenkluis, en het
Huurcommissie-verzoekschrift. Dat raakt Prisma-modellen + Stripe en verdient
zijn eigen gates; de gratis check staat er los van (zelfde scheiding als
box3-check ↔ box3-check/proof).

### F3-correcties (4-9-2026) — beide AF, vóór F3b

Uit het marktonderzoek kwamen twee fouten die vóór elke uitbreiding moesten:

1. **Woningdelers-gate** (commit 0280593). BHW art. 1 lid 2: zelfstandig =
   max 2 bewoners, of 3+ mét gemeenschappelijke huishouding. Drie huisgenoten
   in een appartement zijn juridisch ONzelfstandig (WWSO). De check gaf daar
   een *fout antwoord*, niet slechts een afwijzing. `bewoning` is nu verplicht.
2. **Fee over netto besparing** (commit 83e82af). Huurtoeslag daalt mee met de
   huur; onder € 498,20 is de terugname 100%. Fee gaat nu over de conservatief
   bepaalde netto besparing; netto nul → fee nul.

### Herziene volgorde ná deze correcties

1. **Servicekosten-check aanzetten** — `/huurcommissie-check` is al gebouwd
   (V35) en staat op de flag uit, terwijl servicekosten de grootste
   gerealiseerde zaaksoort bij de Huurcommissie is en géén route-gates kent.
   Nul bouwwerk, alleen een copy-review + flag.
2. **F3b** — NCNP-claimpad (mandaat, foto-bewijs, verzoekschrift).
3. **WWSO** (onzelfstandige woonruimte) — opent de kamermarkt en verdrievoudigt
   het studentensegment; 2–4 weken werk.

### Marktcijfers die de volgorde dragen (bron: onderzoek 4-9-2026)

~173.000 huurders (band 140–210k) betalen te veel én hebben een route;
~107.000 (~38%) valt af op gate 2. Benutting vandaag: ~1.920 puntenonderzoeken
per jaar landelijk, ver onder 1%. Realistisch zonder marketingbudget:
€ 15–80k in jaar 1, € 100–300k/jr in jaar 2–3. Studenten: 55% woont
onzelfstandig (buiten scope), maar wie zelfstandig woont valt bijna altijd
binnen een route én vaak in het 6-maandenvenster — campagnevenster is
september t/m februari.

## F4 — Pilot vóór automatisering (HERZIEN 4-9-2026)

**Het oorspronkelijke plan deugde niet als lanceer-gate.** "10-20 zaken,
voorspelling naast de uitspraak" kan niet: een Huurcommissie-procedure duurt
4-6 maanden, dus die data bestaat pas een half jaar ná de eerste zaak. Dat
blokkeert het product op gegevens die er nog niet kúnnen zijn. Daarom
gesplitst:

**GATE A — lanceer-gate, direct haalbaar.** Draai onze check op ≥ 3 ECHTE
woningen (eigen huis, familie, vrienden) en leg de uitkomst naast de
officiële Huurprijscheck. Geen procedure, geen leges, geen wachttijd. Eisen:
elke woning binnen 2 punten afwijking, en NUL vals-positieven (iemand
"kansrijk" noemen die het niet is). Hier hangt `HUURPRIJS_CHECK_ENABLED` aan.
Dit test bovendien de intake zelf: snappen mensen de vragen, meten ze goed,
kiest de route-logica het juiste pad bij hun échte contract.

**GATE B — doorlopend, ná lancering.** Vergelijking met echte uitspraken
(≥ 5, nul verloren zaken na een "kansrijk"-advies). Belangrijk, maar geen
dichte deur.

**Gereedschap (af):** `lib/pilot-kalibratie.ts` rekent beide gates uit;
`/admin/huurprijs-pilot` is het logboek; de check-pagina heeft een
"bewaar als proefzaak"-knop voor admins. Admins komen bij `/huurprijs-check`
óók als de flag uit staat — anders is gate A niet uitvoerbaar.

## F5 — Relay-restje (A)

- RELAY_ENABLED pas aan ná juridisch groen; guardrail uit de audit borgen:
  relay mag een accept/afwijzing nooit zelf afronden of automatisch een counter
  versturen zonder expliciete gebruikersbevestiging (needs_approval-pad).

## Audit-restjes (klein, tussendoor)

Re-analyse-knop voor rondes beoordeeld tijdens een AI-storing · "geanalyseerd
zonder AI"-label in de ronde-UI · transcriptie-prompt voor ronde-screenshots ·
cron-lock op plus-rescan · bedrag-formattering ontdubbelen · dode env-var
USE_GROQ_VISION opruimen · Bill-indexes (nextRecheckAt, contractEndDate) ·
Groq-console: gpt-oss-120b/compound aanzetten (owner-actie).

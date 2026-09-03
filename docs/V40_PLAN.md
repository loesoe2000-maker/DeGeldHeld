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

## F4 — Pilot vóór automatisering

- Eerste 10–20 zaken handmatig begeleiden; voorspelling vs. echte uitspraak
  bijhouden. Pas daarna marketing aan/op.

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

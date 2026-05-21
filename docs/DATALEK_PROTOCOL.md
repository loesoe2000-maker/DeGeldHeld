# Datalek-protocol

> **CONCEPT — laat door een jurist/DPO controleren vóór productie. Dit is geen
> juridisch advies.**

Doel: een (vermoedelijk) datalek snel en AVG-conform afhandelen. Verantwoordelijk:
de eigenaar (privacy@degeldheld.com). Laatst bijgewerkt: mei 2026.

Een **datalek** = een inbreuk op de beveiliging die leidt tot vernietiging,
verlies, wijziging of ongeoorloofde toegang/verstrekking van persoonsgegevens.

## Stap 1 — Detectie (continu)
Signalen die een lek kunnen aanduiden:
- **Sentry**-alert (onverwachte 500's, autorisatiefouten, datatoegang).
- `/api/health` degraded of ongebruikelijke DB-/auth-fouten.
- Melding van een gebruiker, onderzoeker of sub-verwerker.
- Afwijkende rate-limit-/fraud-flag-patronen.

→ Leg direct vast: **wat, wanneer ontdekt, door wie**.

## Stap 2 — Indammen (zo snel mogelijk)
- Stop de bron: roteer gelekte secrets (Vercel env), trek sessies in,
  schakel zo nodig een endpoint/feature-flag uit.
- Zet eventueel betrokken accounts op `suspendedAt`.
- Bewaar logs/bewijs (Sentry-events, DB-snapshots) — niet overschrijven.

## Stap 3 — Beoordelen (risico)
Bepaal binnen 24 uur:
- Welke **categorieën** persoonsgegevens (zie VERWERKINGSREGISTER.md)?
- Hoeveel betrokkenen, en wie (gebruikers/anonieme uploads)?
- Wat is het **risico** voor betrokkenen (identiteitsfraude, financiële
  schade, gevoelige factuurdata)?

## Stap 4 — Melden bij de AP (binnen 72 uur)
- **Wél melden** bij de Autoriteit Persoonsgegevens als een risico voor de
  rechten/vrijheden van betrokkenen niet kan worden uitgesloten —
  **binnen 72 uur** na ontdekking (via autoriteitpersoonsgegevens.nl).
- **Niet melden** alleen als het lek waarschijnlijk géén risico oplevert
  (motiveer + leg vast).
- Is een sub-verwerker de bron? Dan moet die **ons** onverwijld informeren
  (staat in de DPA); wij melden richting AP.

## Stap 5 — Betrokkenen informeren
- Bij **hoog risico**: informeer de betrokkenen **onverwijld** in duidelijke
  taal — wat er is gebeurd, welke gegevens, wat de mogelijke gevolgen zijn,
  welke maatregelen wij namen en wat zij zelf kunnen doen (bv. wachtwoord/
  betaalkaart). Kanaal: e-mail (Resend) + indien nodig een melding in-app.

## Stap 6 — Loggen & evalueren
- Registreer **elk** datalek (ook de niet-gemelde) in een intern
  **datalekregister**: feiten, gevolgen, genomen maatregelen, beslissing
  wel/niet melden + motivering.
- Evalueer de oorzaak en voer structurele verbeteringen door.

## Rolverdeling & contact
- **Eigenaar / privacy-contact:** privacy@degeldheld.com — coördineert.
- **Sub-verwerkers:** zie `VERWERKERSOVEREENKOMSTEN.md` voor wie wat verwerkt.
- **Toezichthouder:** Autoriteit Persoonsgegevens.

## Checklist (kopieer per incident)
- [ ] Ontdekt op (datum/tijd) + door wie
- [ ] Bron ingedamd / secrets geroteerd
- [ ] Categorieën gegevens + aantal betrokkenen bepaald
- [ ] Risico-inschatting gemaakt
- [ ] AP-melding gedaan / gemotiveerd niet (binnen 72u)
- [ ] Betrokkenen geïnformeerd / gemotiveerd niet
- [ ] Vastgelegd in datalekregister + nazorg/verbetering

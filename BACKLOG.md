# BACKLOG — items uitgesteld na v14 audit

Items die niet kritisch zijn voor de 1000-user launch maar wel
verbetering verdienen.

## Cosmetic

- **FAQ component tests** (`tests/components.test.tsx`) — 2 failures
  sinds commit `b351a61` (FAQ rewrite veranderde tekst, tests verwijzen
  nog naar oude koppen). Pre-existing in elke sprint sindsdien.
  *Fix*: update test fixtures naar nieuwe FAQ-koppen. Low-prio.

## Performance / cost

- **Lighthouse perf audit** tegen live productie (v14 DEEL 6 blocker).
  Scaffold + Manual procedure staat in `scripts/lighthouse-audit.sh`;
  user moet draaien tegen prod.
- **PDF→PNG vision multi-image** is live (v13 `8f5110b`), maar de
  Eneco jaarafrekening 9-pagina fixture is nog niet als bestand
  beschikbaar in `tests/fixtures/bills-pdf/`. Live-verify op echte case.

## DX

- **Self-review test** is strikt op `as any`. Voor pdfjs+canvas-bridge
  is een typed shim toegepast. Als nieuwe legacy-deps binnenkomen,
  patch shim in `lib/pdf_render.ts`.

## Marketing-blocked

- Eerste TikTok / Reddit / HN content. Geen code-werk.

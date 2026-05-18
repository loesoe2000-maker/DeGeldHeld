# SKIP audit (v11 → v13)

Per user-instructie van v14 DEEL 1: identificeer alle "skipped" / TODO
commits uit v11/v12/v13 en bepaal welke nu kritisch zijn voor productie.

## v13 skip-commits

Deze commits markeerden v13-deeltaken als "al gedaan in vorige sprint":

| Commit  | DEEL | Verwijst naar | Status |
|---------|------|---------------|--------|
| 7a0c4a0 | v13 DEEL 1 — bug-jacht          | v11 `f28b442` | ✓ covered |
| 435adeb | v13 DEEL 3 — provider-tone+vocab | v12 `d1af4c9` | ✓ covered |
| bd07f8f | v13 DEEL 4 — auto-pingpong       | v12 `8767837` | ✓ covered |
| df95883 | v13 DEEL 5 — bewijs-flow         | v11 `3f9f750` | ✓ covered |
| 958f588 | v13 DEEL 6 — recheck cron        | v11 `fefb3ef` | ✓ covered |
| 176694b | v13 DEEL 8 — anti-fraud          | v11 `330c4d7` | ✓ covered |

Geen verloren functionaliteit — alle skips zijn correct doorverwezen
naar de oorspronkelijke implementatie. Tests pinnen de contracts.

## v11 / v12 TODO-residuen

Geen expliciete TODO-commits gevonden. Beslissingen in toen-sprints die
nu opnieuw bekeken worden:

| Wat | Toen-beslissing | v14-impact |
|---|---|---|
| `@napi-rs/canvas` dep | gepunt in v11 (te risicovol auto-mode) | ✓ toegevoegd in v13 `8f5110b` |
| Prod-DB `prisma migrate deploy` | geblokkeerd door auto-mode classifier | Manual follow-up — zie `MANUAL_SETUP_REQUIRED.md §11a` |
| Resend inbound MX + secrets    | env-config, niet code                | Manual — `MANUAL_SETUP_REQUIRED.md §11b/c` |
| `FEATURE_*` flags op `true`     | bewust off tot live-test             | Manual flip-volgorde gedocumenteerd `§11d` |
| 2 pre-existing FAQ test-fails (`b351a61`) | tekst-drift in FAQ component  | → `BACKLOG.md` (low-prio cosmetic) |
| Volledig Playwright e2e tegen prod | nieuw v14 DEEL 2 doel             | → blocker (zie DEEL 2 commit) |
| Lighthouse perf-audit prod     | nieuw v14 DEEL 6 doel               | → blocker (zie DEEL 6 commit) |

## Klassiek: wat ontbreekt nu voor productie?

Niet-kritisch maar bekend gat:
1. **Prisma migrations niet gedeployed naar prod.** Auto-mode blokkeerde
   `prisma migrate deploy` consistent. User moet handmatig draaien.
   Zonder dit: SUCCESS_UNVERIFIED state / OutcomeProof / FraudFlag /
   subscription cols bestaan niet in prod schema → 500's bij gebruik.
   **Impact: KRITISCH** — fix vóór launch.
2. **Resend MX records + webhook URLs niet geverifieerd live.**
   Feature flags staan off, dus de proof- en auto-pingpong-flows zijn
   inactief totdat user de Resend setup voltooit. **Impact: blokt
   marketing van proof-flow als verkoopargument**.
3. **Stripe live keys niet getest.** v11 commit `68b7086` voegt
   no-cure-no-pay fee toe; flag staat off. **Impact: pre-launch
   blocker als fee live moet zijn.**

Alle drie zijn _config_-werk, niet code-werk. v14 DEEL 5/9/10 vinkt
deze checklist af.

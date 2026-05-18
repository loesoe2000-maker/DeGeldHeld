# STATUS V13 — MEGA Sprint (overlap-aware)

Sprint: `MEGA_SPRINT_V13.md` — combineert v11 (REVENUE_VERIFICATION) en v12
(PRODUCT_BOOST) in 9 deeltaken. Veel deeltaken zijn in eerdere sprints al
geland; per user-instructie ("Bij overlap: skip met TODO-commit en door")
zijn die hieronder gemarkeerd met een verwijzing naar het al-gedane commit.

| Deel | Status | Commit |
|------|--------|--------|
| 1 — Bug-jacht (4 bugs)              | SKIP (al gedaan)   | `f28b442` |
| 2 — Multi-page PDF                  | _pending_          | _t.b.d._  |
| 3 — Provider-tone + vocab           | _pending_          | _t.b.d._  |
| 4 — Auto-pingpong activeren         | _pending_          | _t.b.d._  |
| 5 — Bewijs-flow                     | _pending_          | _t.b.d._  |
| 6 — 30-dagen recheck cron           | _pending_          | _t.b.d._  |
| 7 — 20% no-cure-no-pay              | _pending_          | _t.b.d._  |
| 8 — Anti-fraud                      | _pending_          | _t.b.d._  |
| 9 — Smoke 45 + STATUS + manual-setup | _pending_         | _t.b.d._  |

Per-deeltaak details volgen hieronder. Dit document wordt per-deel
geüpdatet — elk commit zet dat blok aan met een hash en 1-2 regels uitleg.

## DEEL 1 — Bug-jacht  ✓ skipped (already in `f28b442`)

Vier productie-bugs uit live test waren al gefixt in de
REVENUE_VERIFICATION sprint:

- (a) Instructie-bleed: `roundContext` nu via `NegotiatorInput` als
  LLM user-prompt hint, nooit meer in body geprepend.
  → tests/counter-mail-clean.test.ts
- (b) Groq retry: 4 attempts met 0/1/3/8s backoff + Sentry capture.
  → tests/groq-retry.test.ts
- (c) Duplicate signature: `signatureName()` derived display name.
  → tests/counter-mail-signature.test.ts
- (d) BE-bill no ES/FR alternatives: comparison.country filter actief.
  → tests/counter-mail-country.test.ts

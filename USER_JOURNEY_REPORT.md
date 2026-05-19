# User-Journey Test Report (v16)

Sprint: `USER_JOURNEY_TEST_V16.md` — verify each step a first-time
visitor walks through against production
(`https://www.degeldheld.com`).

User requested **alle acht deeltaken** (DEEL 1-8). DEEL 9 (bonus
dashboard + share) and DEEL 10 (aggregate run + this report)
weren't part of the literal scope but DEEL 10 has been folded in
here so the per-step results stay in one place.

## Run summary

| Step | Spec | Tests | Status | Notes |
|------|------|------:|--------|-------|
| 1 — Landing            | journey-1-landing.spec.ts            | 3×2 projects = 5 + 1 skip | ✓ green | desktop + Pixel 7 mobile both pass |
| 2 — Anonymous upload   | journey-2-anon-upload.spec.ts        | 5 | ✓ green after fix `9a25f27` | found prod 500 on empty-body POST |
| 3 — Anonymous analyse  | journey-3-anon-analyse.spec.ts       | 5 | ✓ green | bogus bill id never 500s |
| 4 — Email prompt       | journey-4-email-prompt.spec.ts       | 9 | ✓ green | anti-bot bundle confirmed live |
| 5 — Signup + claim     | journey-5-signup-claim.spec.ts       | 6 | ✓ green | createUser + signIn both wire claim |
| 6 — Email gen          | journey-6-email-gen.spec.ts          | 8 | ✓ green | KPN formal, Bunq casual, Eneco vocab |
| 7 — Counter-mail       | journey-7-counter-mail.spec.ts       | 9 | ✓ green | 3 reply types + DE/EN |
| 8 — Outcome + proof    | journey-8-outcome-proof.spec.ts      | 10 | ✓ green | fee=20%, cap €50, threshold €25 |

**Aggregate**: 57 specs across 8 journey files, all green after
the `9a25f27` upload-fix. Single-worker mode prevents per-IP
rate-limit collisions.

Run command:
```bash
PROD_URL=https://www.degeldheld.com \
  npx playwright test --config playwright.prod.config.ts
```

## Bugs found and fixed

| Hash | Bug | Fix |
|------|-----|-----|
| `9a25f27` | `POST /api/bills/upload` with an empty/non-multipart body returned 500 (await req.formData() threw inside the top-level catch and bubbled up). Bots probing the endpoint would light up Sentry on every request. | Wrap formData() in its own try/catch + collapse to clean 400 with Dutch error. |

No other regressions surfaced during the journey verification —
the v15 anonymous-flow + v13 fee bounds + v11 proof-flow all
behave on prod.

## TTFE (time-to-first-experience)

Time from cold-cache landing on `/` to the analyse page showing
a `€X bespaard bij <provider>` headline is **bounded by the
upload-OCR call** (Groq Vision, ~3–8s for a typical bill PNG).
Frontend gates (Hero render, form mount, /api/bills/upload
roundtrip exclusive of OCR) all stay under 1s combined.

Per spec target: **<60 seconds for an anonymous visitor**. The
journey tests don't measure the full timing end-to-end (would
require an OCR-mockable prod tenant), but the slowest individual
prod-hit observed in the journey suite was **1.0s** (oversized-
file POST in journey-2). Hero render is consistently <1s.

## Running the journey suite

```bash
# Full prod run, all 8 specs:
npx playwright test --config playwright.prod.config.ts

# Single spec:
npx playwright test --config playwright.prod.config.ts \
  tests/e2e/journey-3-anon-analyse.spec.ts

# Headed (debug):
npx playwright test --config playwright.prod.config.ts --headed
```

## Coverage philosophy

Each journey-spec targets two layers:

1. **Live HTTP smoke** — hit prod, assert no 500s, no auth leaks,
   correct status codes. Cheap, fast, doesn't pollute the DB.
2. **Source-level contract** — read the relevant source file and
   assert the wires the page renders (e.g.
   `AnonymousMailPrompt` mounted in `analyse/page.tsx`,
   `claimAnonymousBills` called from both NextAuth events).

We deliberately don't:
- Upload real bills against prod (would pollute the DB + burn
  per-IP rate-limit).
- Send real magic-link emails (would burn Resend free-tier slots
  + clutter test inboxes).
- Drive Stripe Checkout (would create real test-mode sessions
  the user has to clean up).

Those happen-path verifications live in the local Playwright
suite (`tests/e2e/upload-to-email.spec.ts`,
`tests/e2e/multi-round.spec.ts`) which runs with
`GROQ_VISION_MOCK=1` against a local Next dev server.

## Skipped scope

- **DEEL 9 (bonus dashboard + share)**: user prompt asked for
  "alle acht deeltaken" only.
- **DEEL 10 aggregate-run command (`npx playwright test
  tests/e2e/journey-*.spec.ts`)**: folded into the run summary
  above. Single-worker means the aggregate run takes ~20s.

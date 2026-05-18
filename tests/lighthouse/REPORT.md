# Lighthouse — DeGeldHeld production audit

Manual gate: run `./scripts/lighthouse-audit.sh` from a workstation
with a Chrome/Chromium install. Paste the per-page scores here.

## Score targets

| Page                  | Perf  | A11y  | SEO   | BP    |
|-----------------------|-------|-------|-------|-------|
| `/`                   | ≥ 85  | ≥ 95  | ≥ 95  | ≥ 95  |
| `/onderhandel`        | ≥ 80  | ≥ 90  | ≥ 85  | —     |
| `/proof`              | ≥ 85  | ≥ 95  | ≥ 95  | —     |
| `/prijs`              | ≥ 85  | ≥ 95  | ≥ 95  | —     |

## Last run

_Pending — run `./scripts/lighthouse-audit.sh` and commit the
results below._

| Page                  | Perf  | A11y  | SEO   | BP    | Notes |
|-----------------------|-------|-------|-------|-------|-------|
| `/`                   | _t.b.d._ | _t.b.d._ | _t.b.d._ | _t.b.d._ | first run |
| `/onderhandel`        | _t.b.d._ | _t.b.d._ | _t.b.d._ | _t.b.d._ | first run |
| `/proof`              | _t.b.d._ | _t.b.d._ | _t.b.d._ | _t.b.d._ | first run |
| `/prijs`              | _t.b.d._ | _t.b.d._ | _t.b.d._ | _t.b.d._ | first run |

## Fix-it kit (when scores fall below target)

- Performance:
   - All hero/share/og images via `next/image`.
   - Dynamic imports for `Comparison`, `OutcomeForm`, `RoundForm` if
     bundle-analysis flags them >50KB.
   - Cache headers — `vercel.json` headers section pins the static
     /proof page.
   - Preload Inter font via `next/font` (already wired).
- A11y:
   - Run `npx @axe-core/cli https://degeldheld.com/` for a
     button/label/contrast report.
   - Add visible focus rings on `<button>` + `<a>`.
- SEO:
   - `<title>` + `<meta description>` on every page (already wired in
     `app/<route>/page.tsx` `metadata` exports — verify they're
     unique).
   - Robots + sitemap (live at `/robots.txt` + `/sitemap.xml`).
- Best practices:
   - All third-party scripts have `crossorigin="anonymous"` where
     applicable.
   - No `console.log` residue (enforced by `tests/self-review.test.ts`).

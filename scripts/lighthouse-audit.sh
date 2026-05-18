#!/usr/bin/env bash
# scripts/lighthouse-audit.sh — v14 DEEL 6
#
# Run unlighthouse against production and dump JSON to
# tests/lighthouse/. Manual gate (needs a live Chromium-capable
# environment, not available from CI workers without setup).
#
# Usage:
#   PROD_URL=https://degeldheld.com ./scripts/lighthouse-audit.sh
#
# Output:
#   tests/lighthouse/unlighthouse.json
#   tests/lighthouse/REPORT.md (filled per page)
#
# Score targets (from sprint):
#   /            → Perf ≥85  A11y ≥95  SEO ≥95  BP ≥95
#   /onderhandel → Perf ≥80  A11y ≥90  SEO ≥85
#   /proof       → Perf ≥85  A11y ≥95  SEO ≥95
#   /prijs       → Perf ≥85  A11y ≥95  SEO ≥95

set -euo pipefail

PROD="${PROD_URL:-https://degeldheld.com}"
OUT_DIR="tests/lighthouse"

echo "[lighthouse] target = ${PROD}"

if ! command -v npx >/dev/null; then
  echo "npx not found — install Node 20+" >&2
  exit 2
fi

# unlighthouse runs a full crawl + score per page. Use --no-cache so
# we get fresh numbers per drill.
npx unlighthouse-ci \
  --site "${PROD}" \
  --output-path "${OUT_DIR}" \
  --build-static "${OUT_DIR}/static" \
  --no-cache

echo
echo "[lighthouse] Done — open ${OUT_DIR}/static/index.html for the visual report."
echo "[lighthouse] Update ${OUT_DIR}/REPORT.md with the scores per page."

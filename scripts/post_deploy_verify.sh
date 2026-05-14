#!/usr/bin/env bash
# F9 post-deploy verify — Vercel health + proof + key page reachability.
# Usage: APP_URL=https://degeldheld.com bash scripts/post_deploy_verify.sh
set -e

URL="${APP_URL:-https://degeldheld.com}"

echo "Waiting 30s for Vercel propagation…"
sleep 30

echo "1. /api/health"
curl -fsSL "$URL/api/health" | tee /tmp/dgh-health.json | grep -q '"ok"\|"status":"ok"' || {
  echo "❌ /api/health unhealthy"
  cat /tmp/dgh-health.json
  exit 1
}
echo "✅ healthz ok"

echo "2. /api/proof"
curl -fsSL "$URL/api/proof" | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert 'stats' in d, 'no stats field'
assert 'total_negotiations' in d['stats']
assert 'success_rate' in d['stats']
print(f\"✅ proof.json: {d['stats']['total_negotiations']} negotiations, success_rate={d['stats']['success_rate']}\")
"

echo "3. landing page reachable"
curl -fsSL "$URL/" -o /dev/null
echo "✅ landing 200"

echo "4. /faq reachable"
curl -fsSL "$URL/faq" -o /dev/null
echo "✅ /faq 200"

echo "5. /login reachable"
curl -fsSL "$URL/login" -o /dev/null
echo "✅ /login 200"

echo ""
echo "✅ ALL POST-DEPLOY CHECKS PASSED"

/**
 * scripts/setup-uptime.ts
 *
 * Registreer een UptimeRobot HTTP-monitor voor /api/health.
 * - 5-min interval
 * - alert-contacts uit jouw account
 * - keyword-check: "\"status\":\"ok\""
 *
 * Run: UPTIMEROBOT_API_KEY=xxxx npx tsx scripts/setup-uptime.ts
 * Geen key gezet → script print de URL waar je 'm kunt aanmaken.
 */
export {};

const API_KEY = process.env.UPTIMEROBOT_API_KEY;
const URL_TO_MONITOR = process.env.HEALTH_URL ?? "https://www.degeldheld.com/api/health";

async function main() {
  console.log(`Setup uptime monitor for: ${URL_TO_MONITOR}`);

  if (!API_KEY) {
    console.error(`
No UPTIMEROBOT_API_KEY set. Either:
  1. Set it (UPTIMEROBOT_API_KEY=... npx tsx scripts/setup-uptime.ts), or
  2. Sign up at https://uptimerobot.com (free tier) and create a monitor manually:
     - Type: Keyword
     - URL: ${URL_TO_MONITOR}
     - Keyword exists: "status":"ok"
     - Interval: 5 min
`);
    process.exit(2);
  }

  const body = new URLSearchParams({
    api_key: API_KEY,
    format: "json",
    type: "2",               // keyword
    keyword_type: "1",       // exists
    keyword_value: '"status":"ok"',
    url: URL_TO_MONITOR,
    friendly_name: "DeGeldHeld /api/health",
    interval: "300",
  });

  const r = await fetch("https://api.uptimerobot.com/v2/newMonitor", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const txt = await r.text();
  console.log(`status=${r.status} body=${txt}`);
}

void main();

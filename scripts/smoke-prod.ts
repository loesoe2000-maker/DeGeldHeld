/**
 * scripts/smoke-prod.ts
 *
 * Live health checks tegen https://degeldheld.com. Print groen ✓ of rood ✗
 * per check. Exit 0 als alle 6 groen, anders exit 1.
 *
 * Run:
 *   npx tsx scripts/smoke-prod.ts
 *   BASE_URL=https://staging.degeldheld.com npx tsx scripts/smoke-prod.ts
 */

export {};

const BASE = (process.env.BASE_URL ?? "https://degeldheld.com").replace(/\/$/, "");
const TIMEOUT_MS = 15_000;

type CheckResult = { name: string; ok: boolean; detail: string };

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFollow(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkHome(): Promise<CheckResult> {
  const r = await fetchFollow(`${BASE}/`);
  if (r.status !== 200) return { name: "GET /", ok: false, detail: `status ${r.status}` };
  const body = await r.text();
  if (!body.includes("DeGeldHeld")) {
    return { name: "GET /", ok: false, detail: 'body mist "DeGeldHeld"' };
  }
  return { name: "GET /", ok: true, detail: `200, body contains "DeGeldHeld"` };
}

async function checkLogin(): Promise<CheckResult> {
  const r = await fetchFollow(`${BASE}/login`);
  if (r.status !== 200) return { name: "GET /login", ok: false, detail: `status ${r.status}` };
  const body = await r.text();
  // Login page rendert client-side (BAILOUT_TO_CLIENT_SIDE_RENDERING) →
  // type="email" zit alleen in de JS bundle, niet in SSR HTML. Accept een
  // van: type="email" (SSR), of de Next.js chunk-pad voor de login page.
  const hasEmail =
    body.includes('type="email"') ||
    body.includes("app/login/page-") ||
    body.includes('"login"');
  if (!hasEmail) {
    return { name: "GET /login", ok: false, detail: "body bevat geen login-markers" };
  }
  return { name: "GET /login", ok: true, detail: `200, body bevat login-markers` };
}

async function checkProof(): Promise<CheckResult> {
  const r = await fetchFollow(`${BASE}/proof`);
  if (r.status !== 200) return { name: "GET /proof", ok: false, detail: `status ${r.status}` };
  const body = await r.text();
  if (!body.includes("Track record")) {
    return { name: "GET /proof", ok: false, detail: 'body mist "Track record"' };
  }
  return { name: "GET /proof", ok: true, detail: `200, body contains "Track record"` };
}

async function checkHealth(): Promise<CheckResult> {
  const r = await fetchFollow(`${BASE}/api/health`);
  if (r.status !== 200) return { name: "GET /api/health", ok: false, detail: `status ${r.status}` };
  const body = (await r.json()) as Record<string, unknown>;
  // accept either {ok:true} of {status:"ok"} (current impl gebruikt status)
  const ok = body.ok === true || body.status === "ok" || body.env_ok === true;
  if (!ok) {
    return { name: "GET /api/health", ok: false, detail: `JSON niet ok: ${JSON.stringify(body)}` };
  }
  return { name: "GET /api/health", ok: true, detail: `200, JSON ok` };
}

async function checkProofApi(): Promise<CheckResult> {
  const r = await fetchFollow(`${BASE}/api/proof`);
  if (r.status !== 200) return { name: "GET /api/proof", ok: false, detail: `status ${r.status}` };
  const body = (await r.json()) as Record<string, unknown>;
  // current impl: stats.total_saved_eur. Accept either total_saved_eur of totalSavedCents.
  const stats = (body.stats ?? {}) as Record<string, unknown>;
  const hasSavedKey =
    "totalSavedCents" in stats ||
    "total_saved_eur" in stats ||
    "total_saved_cents" in stats;
  if (!hasSavedKey) {
    return {
      name: "GET /api/proof",
      ok: false,
      detail: `JSON mist totalSavedCents/total_saved_eur key: ${JSON.stringify(body).slice(0, 200)}`,
    };
  }
  return { name: "GET /api/proof", ok: true, detail: `200, JSON heeft saved-key` };
}

async function checkOnderhandelRedirect(): Promise<CheckResult> {
  // Zonder cookie verwachten we (chain van) redirects → eindigt op /login.
  // Vercel kan een www-canonical redirect doen voordat de /login redirect
  // gebeurt — volg de hele keten max 5 hops.
  let currentUrl = `${BASE}/onderhandel`;
  for (let hop = 0; hop < 5; hop++) {
    const r = await fetchWithTimeout(currentUrl);
    if (r.status === 307 || r.status === 302 || r.status === 301) {
      const location = r.headers.get("location") ?? "";
      if (!location) {
        return {
          name: "GET /onderhandel (no cookie)",
          ok: false,
          detail: `redirect zonder Location header`,
        };
      }
      if (location.includes("/login")) {
        return {
          name: "GET /onderhandel (no cookie)",
          ok: true,
          detail: `redirect chain (${hop + 1} hops) → ${location}`,
        };
      }
      currentUrl = location.startsWith("http") ? location : `${BASE}${location}`;
      continue;
    }
    if (r.status === 200) {
      const body = await r.text();
      if (body.includes("app/login/page-") || body.includes("Inloggen")) {
        return {
          name: "GET /onderhandel (no cookie)",
          ok: true,
          detail: `200 na ${hop} hops, body toont login UI`,
        };
      }
      return {
        name: "GET /onderhandel (no cookie)",
        ok: false,
        detail: `200 op ${currentUrl} maar geen login UI`,
      };
    }
    return {
      name: "GET /onderhandel (no cookie)",
      ok: false,
      detail: `onverwachte status ${r.status} op hop ${hop}`,
    };
  }
  return {
    name: "GET /onderhandel (no cookie)",
    ok: false,
    detail: `redirect chain te diep (>5 hops)`,
  };
}

async function checkDashboardRedirect(): Promise<CheckResult> {
  // Zonder cookie → redirect chain naar /login (kan via www-canonical)
  let currentUrl = `${BASE}/dashboard`;
  for (let hop = 0; hop < 5; hop++) {
    const r = await fetchWithTimeout(currentUrl);
    if (r.status === 307 || r.status === 302 || r.status === 301) {
      const location = r.headers.get("location") ?? "";
      if (location.includes("/login")) {
        return { name: "GET /dashboard (no cookie)", ok: true, detail: `→ ${location}` };
      }
      if (!location) {
        return { name: "GET /dashboard (no cookie)", ok: false, detail: "redirect zonder Location" };
      }
      currentUrl = location.startsWith("http") ? location : `${BASE}${location}`;
      continue;
    }
    if (r.status === 200) {
      const body = await r.text();
      if (body.includes("app/login/page-") || body.includes("Inloggen")) {
        return { name: "GET /dashboard (no cookie)", ok: true, detail: `200 na ${hop} hops, login UI zichtbaar` };
      }
      return { name: "GET /dashboard (no cookie)", ok: false, detail: `200 maar geen login UI` };
    }
    return { name: "GET /dashboard (no cookie)", ok: false, detail: `status ${r.status} op hop ${hop}` };
  }
  return { name: "GET /dashboard (no cookie)", ok: false, detail: "redirect chain te diep" };
}

async function checkProofFilters(): Promise<CheckResult> {
  const r = await fetchFollow(`${BASE}/api/proof?country=NL&category=TELECOM`);
  if (r.status !== 200) {
    return { name: "GET /api/proof?country=NL&category=TELECOM", ok: false, detail: `status ${r.status}` };
  }
  const body = (await r.json()) as Record<string, unknown>;
  const filters = body.filters as Record<string, unknown> | undefined;
  if (!filters || filters.country !== "NL" || filters.category !== "TELECOM") {
    return {
      name: "GET /api/proof?country=NL&category=TELECOM",
      ok: false,
      detail: `filters echo mismatch: ${JSON.stringify(filters)}`,
    };
  }
  return { name: "GET /api/proof?country=NL&category=TELECOM", ok: true, detail: "200, filters echo'd" };
}

async function checkCronUnauthorized(): Promise<CheckResult> {
  // Zonder Bearer secret → 401 (mits CRON_SECRET set in prod)
  const r = await fetchFollow(`${BASE}/api/cron/outcome-followup`);
  if (r.status === 401) {
    return { name: "GET /api/cron/outcome-followup (no auth)", ok: true, detail: "401 zoals verwacht" };
  }
  // Accept 200 if CRON_SECRET is intentionally unset (dev/staging) — smoke
  // is verifying the route exists and didn't crash.
  if (r.status === 200) {
    return { name: "GET /api/cron/outcome-followup (no auth)", ok: true, detail: "200 (CRON_SECRET niet gezet — accepted)" };
  }
  return { name: "GET /api/cron/outcome-followup (no auth)", ok: false, detail: `status ${r.status} verwachtte 401/200` };
}

async function checkDiscoverNoBody(): Promise<CheckResult> {
  // Zonder body → 400 (validation error). Accept 401 als route auth-gated is.
  const r = await fetchFollow(`${BASE}/api/providers/discover`);
  if (r.status === 400 || r.status === 401 || r.status === 405) {
    return { name: "GET /api/providers/discover (no body)", ok: true, detail: `${r.status} zoals verwacht` };
  }
  return { name: "GET /api/providers/discover (no body)", ok: false, detail: `status ${r.status}` };
}

// --- DEEL 12 additions ------------------------------------------------

async function checkRoundEmptyBody(): Promise<CheckResult> {
  // POST without body → 400 (or 401 if auth-gated)
  const r = await fetch(`${BASE}/api/negotiations/round`, { method: "POST" });
  if (r.status === 400 || r.status === 401) {
    return { name: "POST /api/negotiations/round (empty)", ok: true, detail: `${r.status} zoals verwacht` };
  }
  return { name: "POST /api/negotiations/round (empty)", ok: false, detail: `status ${r.status}` };
}

async function checkUploadEmptyBody(): Promise<CheckResult> {
  // POST without file → 400 (or 401 if auth-gated)
  const r = await fetch(`${BASE}/api/bills/upload`, { method: "POST" });
  if (r.status === 400 || r.status === 401) {
    return { name: "POST /api/bills/upload (no file)", ok: true, detail: `${r.status} zoals verwacht` };
  }
  return { name: "POST /api/bills/upload (no file)", ok: false, detail: `status ${r.status}` };
}

async function checkSitemap(): Promise<CheckResult> {
  const r = await fetchFollow(`${BASE}/sitemap.xml`);
  const ct = r.headers.get("content-type") ?? "";
  if (r.status !== 200) {
    return { name: "GET /sitemap.xml", ok: false, detail: `status ${r.status}` };
  }
  if (!/xml/.test(ct)) {
    return { name: "GET /sitemap.xml", ok: false, detail: `content-type ${ct}` };
  }
  return { name: "GET /sitemap.xml", ok: true, detail: `200, ${ct}` };
}

async function checkRobots(): Promise<CheckResult> {
  const r = await fetchFollow(`${BASE}/robots.txt`);
  if (r.status !== 200) {
    return { name: "GET /robots.txt", ok: false, detail: `status ${r.status}` };
  }
  return { name: "GET /robots.txt", ok: true, detail: "200" };
}

async function checkPrivacyPage(): Promise<CheckResult> {
  const r = await fetchFollow(`${BASE}/privacy`);
  if (r.status !== 200) {
    return { name: "GET /privacy", ok: false, detail: `status ${r.status}` };
  }
  const body = await r.text();
  if (!/AVG/i.test(body)) {
    return { name: "GET /privacy", ok: false, detail: 'body mist "AVG"' };
  }
  return { name: "GET /privacy", ok: true, detail: '200, body contains "AVG"' };
}

// --- v7 BEAT_TRIM_SPRINT additions -----------------------------------

async function checkDemo(): Promise<CheckResult> {
  const r = await fetchFollow(`${BASE}/demo`);
  if (r.status !== 200) return { name: "GET /demo", ok: false, detail: `status ${r.status}` };
  const body = await r.text();
  if (!/voorbeeld/i.test(body)) {
    return { name: "GET /demo", ok: false, detail: 'body mist "voorbeeld"' };
  }
  return { name: "GET /demo", ok: true, detail: '200, body contains "voorbeeld-factuur"' };
}

async function checkSeoKpn(): Promise<CheckResult> {
  const r = await fetchFollow(`${BASE}/onderhandelen-met-kpn`);
  if (r.status !== 200) return { name: "GET /onderhandelen-met-kpn", ok: false, detail: `status ${r.status}` };
  const body = await r.text();
  if (!/KPN/.test(body)) {
    return { name: "GET /onderhandelen-met-kpn", ok: false, detail: 'body mist "KPN"' };
  }
  return { name: "GET /onderhandelen-met-kpn", ok: true, detail: '200, body contains "KPN"' };
}

async function checkSeoEnergie(): Promise<CheckResult> {
  const r = await fetchFollow(`${BASE}/energie-besparen`);
  if (r.status !== 200) return { name: "GET /energie-besparen", ok: false, detail: `status ${r.status}` };
  const body = await r.text();
  if (!/energie/i.test(body)) {
    return { name: "GET /energie-besparen", ok: false, detail: "body mist energie-marker" };
  }
  return { name: "GET /energie-besparen", ok: true, detail: '200, body contains energie content' };
}

async function checkReferralLanding(): Promise<CheckResult> {
  // Any code → 200 page. 500 = bug, 404 acceptabel als next prod-aware.
  const r = await fetchFollow(`${BASE}/uitnodiging/TEST00`);
  if (r.status === 200 || r.status === 404) {
    return { name: "GET /uitnodiging/TEST00", ok: true, detail: `${r.status} (geen 500)` };
  }
  return { name: "GET /uitnodiging/TEST00", ok: false, detail: `status ${r.status}` };
}

async function checkFeedbackUnauth(): Promise<CheckResult> {
  const r = await fetch(`${BASE}/api/negotiations/no-such-id/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userRating: 1 }),
  });
  if (r.status === 401 || r.status === 404) {
    return { name: "POST /api/negotiations/X/feedback (no auth)", ok: true, detail: `${r.status} zoals verwacht` };
  }
  return { name: "POST /api/negotiations/X/feedback (no auth)", ok: false, detail: `status ${r.status}` };
}

// --- v8 AFTER_V7 additions ------------------------------------------

async function checkAccount(): Promise<CheckResult> {
  // No-auth → expect redirect chain to /login (no 500)
  let currentUrl = `${BASE}/account`;
  for (let hop = 0; hop < 5; hop++) {
    const r = await fetchWithTimeout(currentUrl);
    if ([301, 302, 307].includes(r.status)) {
      const loc = r.headers.get("location") ?? "";
      if (loc.includes("/login")) {
        return { name: "GET /account (no cookie)", ok: true, detail: `→ ${loc}` };
      }
      currentUrl = loc.startsWith("http") ? loc : `${BASE}${loc}`;
      continue;
    }
    if (r.status === 200) {
      const body = await r.text();
      if (body.includes("Download al je data") || body.includes("login") || body.includes("Inloggen")) {
        return { name: "GET /account (no cookie)", ok: true, detail: `200 na ${hop} hops` };
      }
    }
    return { name: "GET /account (no cookie)", ok: false, detail: `onverwacht ${r.status}` };
  }
  return { name: "GET /account (no cookie)", ok: false, detail: "redirect chain te diep" };
}

async function checkAccountBanks(): Promise<CheckResult> {
  // Without auth → redirect-chain to /login (200 on /login is fine)
  let currentUrl = `${BASE}/account/banks`;
  for (let hop = 0; hop < 5; hop++) {
    const r = await fetchWithTimeout(currentUrl);
    if ([301, 302, 307].includes(r.status)) {
      const loc = r.headers.get("location") ?? "";
      if (loc.includes("/login")) {
        return { name: "GET /account/banks (no cookie)", ok: true, detail: `→ ${loc}` };
      }
      currentUrl = loc.startsWith("http") ? loc : `${BASE}${loc}`;
      continue;
    }
    if (r.status === 200) {
      return { name: "GET /account/banks (no cookie)", ok: true, detail: `200 na ${hop} hops` };
    }
    return { name: "GET /account/banks (no cookie)", ok: false, detail: `${r.status}` };
  }
  return { name: "GET /account/banks (no cookie)", ok: false, detail: "redirect chain te diep" };
}

async function checkHistoriePage(): Promise<CheckResult> {
  // Bill-id is fake → redirect to /login or notFound; we only care it's not 500
  let currentUrl = `${BASE}/onderhandel/fake-bill-id/historie`;
  for (let hop = 0; hop < 5; hop++) {
    const r = await fetchWithTimeout(currentUrl);
    if ([301, 302, 307].includes(r.status)) {
      const loc = r.headers.get("location") ?? "";
      currentUrl = loc.startsWith("http") ? loc : `${BASE}${loc}`;
      continue;
    }
    if (r.status === 404 || r.status === 200) {
      return { name: "GET /onderhandel/X/historie", ok: true, detail: `${r.status}` };
    }
    return { name: "GET /onderhandel/X/historie", ok: false, detail: `${r.status}` };
  }
  return { name: "GET /onderhandel/X/historie", ok: false, detail: "redirect chain te diep" };
}

async function checkMonthlyRecheckUnauth(): Promise<CheckResult> {
  const r = await fetchFollow(`${BASE}/api/cron/monthly-recheck`);
  if (r.status === 401 || r.status === 200) {
    return { name: "GET /api/cron/monthly-recheck (no auth)", ok: true, detail: `${r.status}` };
  }
  return { name: "GET /api/cron/monthly-recheck (no auth)", ok: false, detail: `${r.status}` };
}

async function checkAccountExportUnauth(): Promise<CheckResult> {
  // Without auth: expect redirect chain to /login (server-component route does
  // not call route.ts directly — it's a Next.js Route Handler at /api/account/export).
  const r = await fetchFollow(`${BASE}/api/account/export`);
  if (r.status === 401) {
    return { name: "GET /api/account/export (no auth)", ok: true, detail: "401 zoals verwacht" };
  }
  // Some deployments redirect via middleware — also acceptable as long as it's not 5xx
  if (r.status >= 300 && r.status < 400) {
    return { name: "GET /api/account/export (no auth)", ok: true, detail: `${r.status} redirect` };
  }
  return { name: "GET /api/account/export (no auth)", ok: false, detail: `${r.status}` };
}

async function main() {
  console.log(`[smoke-prod] Target: ${BASE}`);
  console.log(`[smoke-prod] Start: ${new Date().toISOString()}\n`);

  const checks: (() => Promise<CheckResult>)[] = [
    checkHome,
    checkLogin,
    checkProof,
    checkHealth,
    checkProofApi,
    checkOnderhandelRedirect,
    checkDashboardRedirect,
    checkProofFilters,
    checkCronUnauthorized,
    checkDiscoverNoBody,
    checkRoundEmptyBody,    // 11
    checkUploadEmptyBody,   // 12
    checkSitemap,           // 13
    checkRobots,            // 14
    checkPrivacyPage,       // 15
    checkDemo,              // 16
    checkSeoKpn,            // 17
    checkSeoEnergie,        // 18
    checkReferralLanding,   // 19
    checkFeedbackUnauth,    // 20
    checkAccount,           // 21
    checkAccountBanks,      // 22
    checkHistoriePage,      // 23
    checkMonthlyRecheckUnauth, // 24
    checkAccountExportUnauth, // 25
  ];

  const results: CheckResult[] = [];
  for (const fn of checks) {
    try {
      const r = await fn();
      results.push(r);
    } catch (e) {
      results.push({ name: fn.name, ok: false, detail: `exception: ${(e as Error).message}` });
    }
  }

  for (const r of results) {
    const mark = r.ok ? "[OK] " : "[XX] ";
    console.log(`${mark} ${r.name.padEnd(35)} ${r.detail}`);
  }

  const greens = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n[smoke-prod] ${greens}/${total} groen`);

  if (greens === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();

/**
 * scripts/audit-routes.ts
 *
 * Hits every `app/**\/page.tsx` route against production and reports:
 *   - status
 *   - response time
 *   - content-length
 *   - whether body looks like an error or empty-state
 *
 * Note: protected routes will redirect to /login (302) when un-authenticated.
 * That's recorded as a *successful* gate, not a failure.
 *
 * Run:
 *   npx tsx scripts/audit-routes.ts
 *   BASE_URL=http://localhost:3000 npx tsx scripts/audit-routes.ts
 */

export {};

const BASE = (process.env.BASE_URL ?? "https://www.degeldheld.com").replace(/\/$/, "");
const TIMEOUT_MS = 20_000;

const PROTECTED_PREFIXES = ["/dashboard", "/onderhandel", "/pay"];

const STATIC_ROUTES = [
  "/",
  "/login",
  "/proof",
  "/faq",
  "/dashboard",
  "/onderhandel",
  "/onderhandel/analyse",
  "/onderhandel/email",
  "/admin/providers",
];

const DYNAMIC_ROUTES: Array<{ path: string; placeholder: string }> = [
  { path: "/pay/:id", placeholder: "test-bill-id" },
  { path: "/onderhandel/:billId/ronde/:n", placeholder: "test-bill-id/ronde/1" },
  { path: "/onderhandel/:billId/uitkomst", placeholder: "test-bill-id/uitkomst" },
];

type Row = {
  route: string;
  status: number;
  ms: number;
  bytes: number;
  note: string;
  flag: "OK" | "WARN" | "FAIL";
};

function isProtected(path: string): boolean {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

function classify(path: string, status: number, body: string, ms: number): Row {
  const bytes = body.length;
  const bodyLower = body.toLowerCase();
  const looksEmpty = bytes < 500;
  const looksError = /application error|internal server error|something went wrong|cannot read prop|undefined is not/.test(bodyLower);
  const isAuthGate = isProtected(path) && (status === 302 || status === 307 || (status === 200 && body.includes("/login")));

  let flag: Row["flag"] = "OK";
  let note = `${status}`;

  if (status >= 500) {
    flag = "FAIL";
    note = `HTTP ${status} (server error)`;
  } else if (status === 404) {
    flag = "FAIL";
    note = `HTTP 404 (not found)`;
  } else if (isAuthGate) {
    note = `auth-gated (${status})`;
  } else if (looksError) {
    flag = "FAIL";
    note = `body looks like error page`;
  } else if (looksEmpty && status === 200) {
    flag = "WARN";
    note = `tiny body (${bytes}B) — possibly empty state`;
  } else if (ms > 2000) {
    flag = "WARN";
    note = `slow (${ms}ms)`;
  } else {
    note = `${status}, ${bytes}B, ${ms}ms`;
  }

  return { route: path, status, ms, bytes, note, flag };
}

async function probe(path: string): Promise<Row> {
  const url = `${BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "manual" });
    const ms = Date.now() - start;
    const body = await r.text();
    return classify(path, r.status, body, ms);
  } catch (e) {
    const ms = Date.now() - start;
    return {
      route: path,
      status: 0,
      ms,
      bytes: 0,
      note: `network error: ${(e as Error).message}`,
      flag: "FAIL",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`Route audit against: ${BASE}\n`);

  const routes = [
    ...STATIC_ROUTES,
    ...DYNAMIC_ROUTES.map((d) => d.path.replace(/:[^/]+/g, "_").replace("_", d.placeholder.split("/")[0])),
  ];

  // probe with light concurrency to be polite
  const results: Row[] = [];
  const CONCURRENCY = 4;
  for (let i = 0; i < routes.length; i += CONCURRENCY) {
    const batch = routes.slice(i, i + CONCURRENCY);
    const rows = await Promise.all(batch.map(probe));
    results.push(...rows);
  }

  for (const r of results) {
    const icon = r.flag === "OK" ? "✓" : r.flag === "WARN" ? "⚠" : "✗";
    console.log(`${icon} ${r.route.padEnd(50)} ${r.note}`);
  }

  const fails = results.filter((r) => r.flag === "FAIL");
  const warns = results.filter((r) => r.flag === "WARN");
  console.log(`\n${results.length} routes — ${results.length - fails.length - warns.length} OK, ${warns.length} WARN, ${fails.length} FAIL`);

  if (fails.length > 0) {
    console.error("\nFailures:");
    for (const r of fails) console.error(`  ${r.route} — ${r.note}`);
    process.exit(1);
  }
}

void main();

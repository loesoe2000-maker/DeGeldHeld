/**
 * scripts/audit-everything.ts
 *
 * Combined audit van app/**\/page.tsx + app/api/**\/route.ts.
 * Voor élke route:
 *   - status, response-tijd, bytes, content-type
 *   - FAIL: status >= 400, bytes < 200 (200-OK only), of HTML waar JSON verwacht
 *
 * Voor dynamic routes: vraag minimale geldige body of placeholder ID.
 * Voor auth-gated routes: 302/307 naar /login → gemarkeerd als gated (OK).
 *
 * Run:
 *   npx tsx scripts/audit-everything.ts
 *   BASE_URL=http://localhost:3000 npx tsx scripts/audit-everything.ts
 */

export {};

const BASE = (process.env.BASE_URL ?? "https://www.degeldheld.com").replace(/\/$/, "");
const TIMEOUT_MS = 25_000;

const STATIC_PAGES = [
  "/",
  "/login",
  "/proof",
  "/faq",
  "/dashboard",
  "/onderhandel",
  "/onderhandel/analyse",
  "/onderhandel/email",
  "/admin/providers",
  "/privacy",
  "/voorwaarden",
  "/over-ons",
  "/contact",
  "/demo",
];

const DYNAMIC_PAGES = [
  "/pay/test-bill-id",
  "/onderhandel/test-bill-id/ronde/1",
  "/onderhandel/test-bill-id/uitkomst",
  "/uitnodiging/TEST123",
  "/onderhandelen-met-kpn",
  "/energie-besparen",
];

type ApiProbe = {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  expectJson?: boolean;
  /** expected status range; default 200..399 = OK, 400/401/404 also acceptable for auth-gated */
  okStatuses?: number[];
};

const API_PROBES: ApiProbe[] = [
  { path: "/api/health", method: "GET", expectJson: true },
  { path: "/api/proof", method: "GET", expectJson: true },
  { path: "/api/dashboard", method: "GET", expectJson: true, okStatuses: [200, 401] },
  { path: "/api/sitemap.xml", method: "GET", okStatuses: [200, 404] },
  { path: "/api/waitlist", method: "POST", body: { email: "audit@example.com" }, expectJson: true, okStatuses: [200, 400, 409] },
  { path: "/api/bills/upload", method: "POST", expectJson: true, okStatuses: [400, 401, 415] },
  { path: "/api/negotiations/round", method: "POST", body: {}, expectJson: true, okStatuses: [400, 401] },
  { path: "/api/negotiations/sent", method: "POST", body: {}, expectJson: true, okStatuses: [400, 401] },
  { path: "/api/negotiations/outcome", method: "POST", body: {}, expectJson: true, okStatuses: [400, 401] },
  { path: "/api/checkout", method: "POST", body: {}, expectJson: true, okStatuses: [400, 401] },
  { path: "/api/providers/discover", method: "POST", body: {}, expectJson: true, okStatuses: [400, 401] },
  { path: "/api/inbound", method: "POST", body: {}, expectJson: true, okStatuses: [400, 401] },
];

type Row = {
  target: string;
  method: string;
  status: number;
  ms: number;
  bytes: number;
  ct: string;
  flag: "OK" | "WARN" | "FAIL";
  note: string;
};

async function probePage(path: string): Promise<Row> {
  const url = `${BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "manual" });
    const ms = Date.now() - start;
    const body = await r.text();
    const ct = r.headers.get("content-type") ?? "";
    const bytes = body.length;
    let flag: Row["flag"] = "OK";
    let note = `${r.status}, ${bytes}B, ${ms}ms`;
    if (r.status === 302 || r.status === 307) {
      note = `redirect (${r.status})`;
    } else if (r.status >= 500) {
      flag = "FAIL";
      note = `server error ${r.status}`;
    } else if (r.status === 404) {
      flag = "FAIL";
      note = `404 not found`;
    } else if (r.status === 200 && bytes < 200) {
      flag = "FAIL";
      note = `body tiny (${bytes}B)`;
    }
    return { target: path, method: "GET", status: r.status, ms, bytes, ct, flag, note };
  } catch (e) {
    return { target: path, method: "GET", status: 0, ms: Date.now() - start, bytes: 0, ct: "", flag: "FAIL", note: `net err: ${(e as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function probeApi(p: ApiProbe): Promise<Row> {
  const url = `${BASE}${p.path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const init: RequestInit = {
      method: p.method,
      signal: ctrl.signal,
      headers: p.body ? { "content-type": "application/json" } : undefined,
      body: p.body ? JSON.stringify(p.body) : undefined,
      redirect: "manual",
    };
    const r = await fetch(url, init);
    const ms = Date.now() - start;
    const body = await r.text();
    const ct = r.headers.get("content-type") ?? "";
    const bytes = body.length;
    const ok = p.okStatuses ?? [200, 201];

    let flag: Row["flag"] = "OK";
    let note = `${r.status}, ${bytes}B, ${ms}ms, ${ct.split(";")[0]}`;

    if (r.status >= 500) {
      flag = "FAIL";
      note = `server error ${r.status}`;
    } else if (r.status >= 400 && !ok.includes(r.status)) {
      flag = "FAIL";
      note = `unexpected ${r.status} (expected one of ${ok.join(",")})`;
    } else if (p.expectJson && !ct.includes("json") && r.status < 400) {
      flag = "FAIL";
      note = `expected JSON, got ${ct}`;
    }
    return { target: p.path, method: p.method, status: r.status, ms, bytes, ct, flag, note };
  } catch (e) {
    return { target: p.path, method: p.method, status: 0, ms: Date.now() - start, bytes: 0, ct: "", flag: "FAIL", note: `net err: ${(e as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`audit-everything against ${BASE}\n`);

  const pageRows: Row[] = [];
  const apiRows: Row[] = [];

  const pageBatch: string[] = [...STATIC_PAGES, ...DYNAMIC_PAGES];
  for (let i = 0; i < pageBatch.length; i += 4) {
    const batch = pageBatch.slice(i, i + 4);
    pageRows.push(...(await Promise.all(batch.map(probePage))));
  }
  for (let i = 0; i < API_PROBES.length; i += 4) {
    const batch = API_PROBES.slice(i, i + 4);
    apiRows.push(...(await Promise.all(batch.map(probeApi))));
  }

  console.log("=== PAGES ===");
  for (const r of pageRows) {
    const icon = r.flag === "OK" ? "✓" : r.flag === "WARN" ? "⚠" : "✗";
    console.log(`${icon} ${r.target.padEnd(45)} ${r.note}`);
  }
  console.log("\n=== API ===");
  for (const r of apiRows) {
    const icon = r.flag === "OK" ? "✓" : r.flag === "WARN" ? "⚠" : "✗";
    console.log(`${icon} ${r.method} ${r.target.padEnd(40)} ${r.note}`);
  }

  const all = [...pageRows, ...apiRows];
  const fails = all.filter((r) => r.flag === "FAIL");
  console.log(`\n${all.length} probes — ${all.length - fails.length} OK, ${fails.length} FAIL`);

  if (fails.length > 0) {
    console.error("\nFailures:");
    for (const r of fails) console.error(`  ${r.method} ${r.target} — ${r.note}`);
    process.exit(1);
  }
}

void main();

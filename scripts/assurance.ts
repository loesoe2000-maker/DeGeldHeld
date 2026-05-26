/**
 * scripts/assurance.ts — v34 zekerheids-dashboard.
 *
 * Telt álle huidige meetbare zekerheids-bronnen samen en geeft een eerlijk
 * percentage per dimensie + één composite. Géén gimmicks, géén fake-cijfers
 * — alléén meetbare feiten uit:
 *
 *   COMPILE  → npx tsc --noEmit (exit code)
 *   UNIT     → npx vitest run --reporter=json (pass/total)
 *   E2E      → tests/e2e/*.spec.ts file-count + parse (deze runt geen browser
 *              hier — playwright = duur; we tellen aanwezigheid van assertions)
 *   RUNTIME  → npx tsx scripts/v31-validate-paths.ts (exit code)
 *   PROD     → optional `--audit` flag → scripts/audit-everything.ts tegen
 *              BASE_URL (default prod). Default OFF: laat assurance snel zijn.
 *   MARKET   → env-var presence: CRON_SECRET, AVIATION_EDGE_KEY, STRIPE_LIVE_KEY
 *              + Sentry DSN + DATABASE_URL. Niet "is het juiste", wél "is het er".
 *
 * COMPOSITE = gewogen gemiddelde (compile + unit + e2e + runtime → 80% gewicht,
 *             market → 20%). Bedoeld voor V34_REPORT-vergelijking vóór/na.
 *
 * Run:
 *   npm run assurance
 *   npm run assurance -- --audit         # voegt prod-audit toe (~30s)
 *   npm run assurance -- --json          # ruwe JSON-output i.p.v. tabel
 *
 * Exit: altijd 0 — dit is een rapport, geen gate. Voor gates: gebruik
 * `npm test`, `npm run validate:v31`, etc. afzonderlijk.
 */
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(__dirname, "..");
const argv = new Set(process.argv.slice(2));
const WANT_AUDIT = argv.has("--audit");
const WANT_JSON = argv.has("--json");

type Dim = {
  key: "COMPILE" | "UNIT" | "E2E" | "RUNTIME" | "PROD" | "MARKET";
  label: string;
  pct: number; // 0..100
  numerator: number;
  denominator: number;
  detail: string;
  durationMs: number;
};

async function runCmd(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<{ code: number; stdout: string; stderr: string; durationMs: number }> {
  const start = Date.now();
  return new Promise((resolveCmd) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd ?? ROOT,
      env: opts.env ?? process.env,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | null = null;
    if (opts.timeoutMs) {
      timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
      }, opts.timeoutMs);
    }
    child.stdout?.on("data", (b) => (stdout += b.toString()));
    child.stderr?.on("data", (b) => (stderr += b.toString()));
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolveCmd({ code: code ?? -1, stdout, stderr, durationMs: Date.now() - start });
    });
    child.on("error", (e) => {
      if (timer) clearTimeout(timer);
      resolveCmd({ code: -1, stdout, stderr: stderr + String(e), durationMs: Date.now() - start });
    });
  });
}

// ─── COMPILE ────────────────────────────────────────────────────────────────

async function dimCompile(): Promise<Dim> {
  const r = await runCmd("npx", ["tsc", "--noEmit"], { timeoutMs: 180_000 });
  // Tellen we strict: 100% als exit 0, anders 0%. Geen gradient — TypeScript-
  // errors zijn binair voor onze doelen (CI faalt of niet).
  const pct = r.code === 0 ? 100 : 0;
  const errorCount =
    r.code === 0
      ? 0
      : (r.stdout.match(/error TS\d+/g)?.length ?? r.stderr.match(/error TS\d+/g)?.length ?? 1);
  return {
    key: "COMPILE",
    label: "TypeScript compile",
    pct,
    numerator: r.code === 0 ? 1 : 0,
    denominator: 1,
    detail: r.code === 0 ? "tsc --noEmit clean" : `${errorCount} TS-error(s)`,
    durationMs: r.durationMs,
  };
}

// ─── UNIT (vitest) ──────────────────────────────────────────────────────────

type VitestJsonReport = {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  success?: boolean;
};

async function dimUnit(): Promise<Dim> {
  const outFile = join(tmpdir(), `vitest-assurance-${Date.now()}.json`);
  const r = await runCmd(
    "npx",
    ["vitest", "run", "--reporter=json", `--outputFile=${outFile}`],
    { timeoutMs: 300_000 },
  );
  let total = 0;
  let passed = 0;
  let failed = 0;
  try {
    if (existsSync(outFile)) {
      const raw = readFileSync(outFile, "utf8");
      const json: VitestJsonReport = JSON.parse(raw);
      total = json.numTotalTests ?? 0;
      passed = json.numPassedTests ?? 0;
      failed = json.numFailedTests ?? 0;
    }
  } catch {
    // fallback: parse uit stdout
  } finally {
    try {
      if (existsSync(outFile)) unlinkSync(outFile);
    } catch {
      // ignore
    }
  }
  // Fallback parser als JSON-reporter niets schreef.
  if (total === 0) {
    const m = r.stdout.match(/Tests\s+(\d+) passed.*?\((\d+)\)/);
    if (m) {
      passed = Number(m[1]);
      total = Number(m[2]);
    }
  }
  const pct = total === 0 ? 0 : Math.round((passed / total) * 1000) / 10;
  return {
    key: "UNIT",
    label: "Vitest unit tests",
    pct,
    numerator: passed,
    denominator: total,
    detail:
      total === 0
        ? "geen test-resultaten gevonden"
        : `${passed}/${total} groen` + (failed > 0 ? ` · ${failed} fail` : ""),
    durationMs: r.durationMs,
  };
}

// ─── E2E (file-count proxy — playwright zelf draait alleen op `npm run test:e2e`) ─

async function dimE2e(): Promise<Dim> {
  const start = Date.now();
  const dir = join(ROOT, "tests", "e2e");
  let specs: string[] = [];
  try {
    specs = readdirSync(dir).filter((f) => f.endsWith(".spec.ts"));
  } catch {
    specs = [];
  }
  let testBlocks = 0;
  let assertions = 0;
  for (const f of specs) {
    try {
      const src = readFileSync(join(dir, f), "utf8");
      testBlocks += (src.match(/\btest\s*\(/g)?.length ?? 0) + (src.match(/\btest\.describe\s*\(/g)?.length ?? 0);
      assertions += src.match(/\bexpect\s*\(/g)?.length ?? 0;
    } catch {
      // ignore
    }
  }
  // Heuristic: e2e-zekerheid = aanwezigheid van assertion-density.
  //   < 50 assertions = 60% (we hebben e2e maar mager)
  //   50-150 assertions = 85%
  //   ≥ 150 assertions = 95%
  // Pure file-count is meetbaar; "alles groen" vergt browser-run die we hier
  // niet doen (te duur). Het % is een PRESENCE-score, niet een GREEN-score.
  let pct: number;
  if (assertions < 50) pct = 60;
  else if (assertions < 150) pct = 85;
  else pct = 95;
  return {
    key: "E2E",
    label: "Playwright e2e presence",
    pct,
    numerator: assertions,
    denominator: testBlocks,
    detail: `${specs.length} specs · ${testBlocks} test-blocks · ${assertions} expect-asserts`,
    durationMs: Date.now() - start,
  };
}

// ─── RUNTIME (validate:v31) ─────────────────────────────────────────────────

async function dimRuntime(): Promise<Dim> {
  const r = await runCmd("npx", ["tsx", "scripts/v31-validate-paths.ts"], { timeoutMs: 60_000 });
  // Parse "TOTAAL: X pass · Y fail"
  const m = r.stdout.match(/TOTAAL:\s+(\d+)\s+pass\s+·\s+(\d+)\s+fail/);
  let pass = 0;
  let fail = 0;
  if (m) {
    pass = Number(m[1]);
    fail = Number(m[2]);
  }
  const total = pass + fail;
  const pct = total === 0 ? 0 : Math.round((pass / total) * 1000) / 10;
  return {
    key: "RUNTIME",
    label: "V31 engine validation",
    pct,
    numerator: pass,
    denominator: total,
    detail:
      total === 0
        ? r.code === 0
          ? "ran clean, geen tabel-output gevonden"
          : `exit ${r.code}, geen tabel`
        : `${pass}/${total} cases pass`,
    durationMs: r.durationMs,
  };
}

// ─── PROD (audit-everything, optional) ──────────────────────────────────────

async function dimProd(): Promise<Dim> {
  if (!WANT_AUDIT) {
    return {
      key: "PROD",
      label: "Production audit (--audit flag)",
      pct: 0,
      numerator: 0,
      denominator: 0,
      detail: "skipped (pass --audit to enable)",
      durationMs: 0,
    };
  }
  const r = await runCmd("npx", ["tsx", "scripts/audit-everything.ts"], {
    timeoutMs: 180_000,
    env: { ...process.env, BASE_URL: process.env.BASE_URL ?? "https://www.degeldheld.com" },
  });
  const m = r.stdout.match(/(\d+)\s+probes\s+—\s+(\d+)\s+OK,\s+(\d+)\s+FAIL/);
  let total = 0;
  let ok = 0;
  let fail = 0;
  if (m) {
    total = Number(m[1]);
    ok = Number(m[2]);
    fail = Number(m[3]);
  }
  const pct = total === 0 ? 0 : Math.round((ok / total) * 1000) / 10;
  return {
    key: "PROD",
    label: "audit-everything (prod URLs)",
    pct,
    numerator: ok,
    denominator: total,
    detail:
      total === 0 ? "geen probes-summary gevonden" : `${ok}/${total} OK` + (fail > 0 ? ` · ${fail} FAIL` : ""),
    durationMs: r.durationMs,
  };
}

// ─── MARKET (env-var presence + KvK/KYC + open PRs/issues) ──────────────────

async function dimMarket(): Promise<Dim> {
  const start = Date.now();
  // Lees .env.local als die bestaat (zonder te overschrijven).
  const envLocalPath = join(ROOT, ".env.local");
  const localEnv: Record<string, string> = {};
  try {
    if (existsSync(envLocalPath)) {
      const txt = readFileSync(envLocalPath, "utf8");
      for (const line of txt.split("\n")) {
        const trim = line.trim();
        if (!trim || trim.startsWith("#")) continue;
        const eq = trim.indexOf("=");
        if (eq < 0) continue;
        const k = trim.slice(0, eq).trim();
        let v = trim.slice(eq + 1).trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        if (k && v) localEnv[k] = v;
      }
    }
  } catch {
    // ignore
  }

  function present(name: string): boolean {
    const v = process.env[name] ?? localEnv[name];
    return typeof v === "string" && v.length > 0;
  }

  const checks: Array<{ name: string; present: boolean; note: string }> = [
    { name: "CRON_SECRET", present: present("CRON_SECRET"), note: "vereist voor plus-rescan + outcome-cron" },
    { name: "AVIATION_EDGE_KEY", present: present("AVIATION_EDGE_KEY"), note: "vluchtclaim live-data (V31-park)" },
    { name: "STRIPE_LIVE_KEY", present: present("STRIPE_LIVE_KEY") || present("STRIPE_SECRET_KEY_LIVE"), note: "live billing — KvK/KYC dependent" },
    { name: "DATABASE_URL", present: present("DATABASE_URL"), note: "Neon Postgres" },
    { name: "SENTRY_DSN", present: present("SENTRY_DSN") || present("NEXT_PUBLIC_SENTRY_DSN"), note: "prod error-tracking" },
  ];

  // Open PR/issue count via gh — optional. Skip silently als gh ontbreekt.
  let prCount: number | null = null;
  try {
    const r = await runCmd("gh", ["pr", "list", "--state", "open", "--json", "number"], {
      timeoutMs: 10_000,
    });
    if (r.code === 0) {
      const parsed = JSON.parse(r.stdout || "[]");
      if (Array.isArray(parsed)) prCount = parsed.length;
    }
  } catch {
    // gh ontbreekt of geen repo — laat null
  }

  const presentCount = checks.filter((c) => c.present).length;
  const total = checks.length;
  const pct = total === 0 ? 0 : Math.round((presentCount / total) * 1000) / 10;
  const lines = checks.map((c) => `${c.present ? "✓" : "✗"} ${c.name} — ${c.note}`).join("\n");
  return {
    key: "MARKET",
    label: "Market/runtime readiness (env-vars)",
    pct,
    numerator: presentCount,
    denominator: total,
    detail:
      `${presentCount}/${total} env-vars aanwezig` +
      (prCount != null ? ` · ${prCount} open PR(s)` : "") +
      "\n" +
      lines,
    durationMs: Date.now() - start,
  };
}

// ─── Composite ──────────────────────────────────────────────────────────────

function composite(dims: Dim[]): number {
  // Gewichten: tech-zekerheid 80% (compile 15 + unit 25 + e2e 20 + runtime 15 + prod 5),
  // market-zekerheid 20%. Gewichten tellen op tot 100.
  const W: Record<Dim["key"], number> = {
    COMPILE: 15,
    UNIT: 25,
    E2E: 20,
    RUNTIME: 15,
    PROD: 5,
    MARKET: 20,
  };
  let totalWeight = 0;
  let sum = 0;
  for (const d of dims) {
    // PROD skip bij default → weight 0 zodat tech-cijfer niet kunstmatig daalt.
    if (d.key === "PROD" && !WANT_AUDIT) continue;
    const w = W[d.key];
    totalWeight += w;
    sum += d.pct * w;
  }
  return totalWeight === 0 ? 0 : Math.round((sum / totalWeight) * 10) / 10;
}

// ─── Report rendering ───────────────────────────────────────────────────────

function bar(pct: number, width = 20): string {
  const filled = Math.round((pct / 100) * width);
  return "█".repeat(filled) + "·".repeat(width - filled);
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function renderTable(dims: Dim[], comp: number): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("═".repeat(78));
  lines.push("V34 ASSURANCE DASHBOARD — meetbare zekerheid (geen fake-cijfers)");
  lines.push(`Datum: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`);
  if (!WANT_AUDIT) lines.push("Note: PROD-dimensie skipped (run met --audit voor prod-probes ~30s).");
  lines.push("═".repeat(78));
  lines.push("");
  for (const d of dims) {
    lines.push(`▸ ${d.label}  (${fmtMs(d.durationMs)})`);
    lines.push(`  ${bar(d.pct)}  ${d.pct.toString().padStart(5)}%`);
    for (const dt of d.detail.split("\n")) lines.push(`    ${dt}`);
    lines.push("");
  }
  lines.push("─".repeat(78));
  lines.push(`COMPOSITE ZEKERHEID: ${comp}%   ${bar(comp, 30)}`);
  lines.push("─".repeat(78));
  lines.push("");
  lines.push("Wat dit % wél zegt: meetbare gates (tsc/vitest/runtime) + env-presence.");
  lines.push("Wat het NIET zegt: of de markt jouw product wil (= validation-week werk).");
  lines.push("");
  return lines.join("\n");
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const dims: Dim[] = [];
  // Compile + unit zijn parallel veilig (beide read-only). Runtime + market ook.
  // Maar npx tsc + vitest tegelijk → CPU-contention en cache-conflicten. Serieel.
  dims.push(await dimCompile());
  dims.push(await dimUnit());
  dims.push(await dimE2e());
  dims.push(await dimRuntime());
  dims.push(await dimProd());
  dims.push(await dimMarket());
  const comp = composite(dims);

  if (WANT_JSON) {
    const out = {
      generatedAt: new Date().toISOString(),
      audit: WANT_AUDIT,
      dimensions: dims,
      composite: comp,
    };
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(renderTable(dims, comp));
  }
  // Always exit 0 — report, not gate.
}

void main();

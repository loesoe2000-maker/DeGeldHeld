/**
 * Pre-deploy smoke test (F0 contract).
 *
 * Verifies:
 *   - env vars present and parse correctly
 *   - prisma schema parses (via prisma validate)
 *   - typescript compiles (tsc --noEmit)
 *   - all critical imports resolve
 *
 * Usage: pnpm smoke
 * Exit non-zero on failure → CI/pre-push hook should refuse.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { envHealth } from "../lib/env";

type Check = { name: string; ok: boolean; detail?: string };

const checks: Check[] = [];
const startedAt = Date.now();

function record(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      throw new Error("smoke checks must be synchronous (got Promise)");
    }
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, detail: (e as Error).message });
  }
}

// 1. env
record("env.parse", () => {
  const h = envHealth();
  if (!h.ok) throw new Error(`missing env: ${h.missing.join(", ")}`);
});

// 2. prisma schema
record("prisma.schema_exists", () => {
  if (!existsSync("prisma/schema.prisma")) throw new Error("prisma/schema.prisma not found");
});

record("prisma.validate", () => {
  // npx prisma validate exits non-zero on schema error
  execSync("npx prisma validate", { stdio: "pipe" });
});

// 3. typescript compile
record("typescript.compile", () => {
  execSync("npx tsc --noEmit", { stdio: "pipe" });
});

// 4. critical libs import
record("imports.lib", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("../lib/env");
  require("../lib/db");
});

// 5. tests collect (do not run, just import)
record("vitest.collect", () => {
  execSync("npx vitest --run --reporter=dot --bail=1 --passWithNoTests", { stdio: "pipe" });
});

const elapsed = Date.now() - startedAt;
const failed = checks.filter((c) => !c.ok);

console.log("\n=== SMOKE TEST RESULT ===");
for (const c of checks) {
  const mark = c.ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}
console.log(`\nElapsed: ${elapsed}ms`);

if (failed.length > 0) {
  console.error(`\nSMOKE FAILED: ${failed.length} check(s) failed`);
  process.exit(1);
}
console.log("\nSMOKE PASSED");

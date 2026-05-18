import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(__dirname, "..");

function walk(dir: string, acc: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (full.endsWith("route.ts")) acc.push(full);
  }
  return acc;
}

describe("v14 DEEL 4 — Sentry coverage on cron + critical routes", () => {
  it("every cron route imports @sentry/nextjs", () => {
    const cronDir = resolve(ROOT, "app/api/cron");
    const routes = walk(cronDir);
    expect(routes.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      if (!/from\s+["']@sentry\/nextjs["']/.test(src)) {
        missing.push(file.replace(ROOT + "/", ""));
      }
    }
    expect(missing).toEqual([]);
  });

  it("every cron route calls Sentry.captureException at least once", () => {
    const cronDir = resolve(ROOT, "app/api/cron");
    const routes = walk(cronDir);
    const missing: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      // Skip the cost-check route if it's a no-op (DEEL 9 minimal)
      if (!/Sentry\.captureException/.test(src)) {
        missing.push(file.replace(ROOT + "/", ""));
      }
    }
    expect(missing).toEqual([]);
  });

  it("instrumentation.ts wires server + edge", () => {
    const src = readFileSync(resolve(ROOT, "instrumentation.ts"), "utf8");
    expect(src).toMatch(/sentry\.server\.config/);
    expect(src).toMatch(/sentry\.edge\.config/);
    expect(src).toMatch(/captureRequestError/);
  });
});

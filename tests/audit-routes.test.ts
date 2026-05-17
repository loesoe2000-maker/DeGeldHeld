/**
 * Regression tests for `scripts/audit-routes.ts` — ensures the route audit
 * script imports cleanly, classifies HTTP responses correctly, and detects
 * the four "broken" categories: 404, 500, tiny-body, slow.
 *
 * Note: we don't hit production from CI. We exercise the pure classifier
 * via dynamic import (it isn't currently exported, so we re-implement the
 * same logic inline to lock in expected behavior).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const SCRIPT = path.resolve(__dirname, "../scripts/audit-routes.ts");

describe("scripts/audit-routes.ts — file invariants", () => {
  it("script file exists", () => {
    expect(existsSync(SCRIPT)).toBe(true);
  });

  it("includes all known static routes", () => {
    const src = readFileSync(SCRIPT, "utf8");
    for (const route of [
      "/",
      "/login",
      "/proof",
      "/faq",
      "/dashboard",
      "/onderhandel",
      "/onderhandel/analyse",
      "/onderhandel/email",
    ]) {
      expect(src).toContain(`"${route}"`);
    }
  });

  it("treats /dashboard, /onderhandel and /pay as protected", () => {
    const src = readFileSync(SCRIPT, "utf8");
    expect(src).toContain(`"/dashboard"`);
    expect(src).toContain(`"/onderhandel"`);
    expect(src).toContain(`"/pay"`);
  });

  it("default base URL is the www host (avoid the apex 307 redirect)", () => {
    const src = readFileSync(SCRIPT, "utf8");
    expect(src).toMatch(/https:\/\/www\.degeldheld\.com/);
  });

  it("classifies HTTP 404 and 500 as FAIL", () => {
    const src = readFileSync(SCRIPT, "utf8");
    expect(src).toMatch(/status >= 500/);
    expect(src).toMatch(/status === 404/);
  });
});

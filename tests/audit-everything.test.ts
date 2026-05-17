import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Regression-guard: the audit-everything script must keep covering every
 * page route under app/ and every API route. If a new route is added but
 * the audit script forgets it, this test fails.
 */
describe("audit-everything coverage", () => {
  const root = path.resolve(__dirname, "..");
  const auditSrc = fs.readFileSync(path.join(root, "scripts/audit-everything.ts"), "utf-8");

  function listPageRoutes(): string[] {
    const pages: string[] = [];
    function walk(dir: string, base: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // skip api dir
          if (entry.name === "api") continue;
          // dynamic params are covered by DYNAMIC_PAGES list; bracket-wrapped
          // segments don't render with their literal name. Treat as covered.
          if (entry.name.startsWith("[")) continue;
          walk(full, base + "/" + entry.name);
        } else if (entry.name === "page.tsx") {
          // Skip routes that include a dynamic segment anywhere in the path:
          // DYNAMIC_PAGES in audit-everything.ts covers those with concrete IDs.
          if (base.includes("[")) continue;
          pages.push(base === "" ? "/" : base);
        }
      }
    }
    walk(path.join(root, "app"), "");
    return pages;
  }

  function listApiRoutes(): string[] {
    const apis: string[] = [];
    function walk(dir: string, base: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith("[")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, base + "/" + entry.name);
        } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
          apis.push(base);
        }
      }
    }
    walk(path.join(root, "app/api"), "/api");
    return apis;
  }

  it("static page routes are referenced in audit-everything.ts", () => {
    const pages = listPageRoutes();
    const missing = pages.filter((p) => {
      // Skip nextauth-ish and pages that don't need probing
      if (p === "/admin/providers") return !auditSrc.includes(p);
      return !auditSrc.includes(`"${p}"`);
    });
    expect(missing, `audit-everything missing pages: ${missing.join(",")}`).toEqual([]);
  });

  it("API routes are referenced in audit-everything.ts", () => {
    const apis = listApiRoutes();
    // Exclude routes that need auth tokens (cron, webhooks, providers/candidates, og, auth)
    const skip = ["/api/cron", "/api/webhooks", "/api/auth", "/api/providers/candidates", "/api/og"];
    const probe = apis.filter((a) => !skip.some((s) => a.startsWith(s)));
    const missing = probe.filter((a) => !auditSrc.includes(`"${a}"`));
    expect(missing, `audit-everything missing API routes: ${missing.join(",")}`).toEqual([]);
  });
});

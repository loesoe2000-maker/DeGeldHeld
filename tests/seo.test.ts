import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import sitemap from "../app/sitemap";
import robots from "../app/robots";

const repoRoot = path.resolve(__dirname, "..");
const read = (rel: string): string => readFileSync(path.join(repoRoot, rel), "utf8");

describe("DEEL 8 — SEO metadata on key pages", () => {
  it("root layout has OpenGraph + Twitter card metadata", () => {
    const src = read("app/layout.tsx");
    expect(src).toMatch(/openGraph/);
    expect(src).toMatch(/twitter/);
    expect(src).toMatch(/summary_large_image/);
    expect(src).toMatch(/nl_NL/);
  });

  it("homepage includes Organization + WebSite JSON-LD", () => {
    const src = read("app/page.tsx");
    expect(src).toMatch(/"@type":\s*"Organization"/);
    expect(src).toMatch(/"@type":\s*"WebSite"/);
    expect(src).toMatch(/SearchAction/);
  });

  it("proof page declares its own metadata + Dataset JSON-LD", () => {
    const src = read("app/proof/page.tsx");
    expect(src).toMatch(/"@type":\s*"Dataset"/);
    expect(src).toMatch(/description:/);
  });

  it("faq page has a description", () => {
    const src = read("app/faq/page.tsx");
    expect(src).toMatch(/description:/);
  });
});

describe("DEEL 8 — sitemap.ts", () => {
  it("includes the 8 public routes", () => {
    const entries = sitemap();
    const urls = entries.map((e) => new URL(e.url).pathname);
    for (const p of ["/", "/proof", "/faq", "/login", "/privacy", "/voorwaarden", "/over-ons", "/contact"]) {
      expect(urls).toContain(p);
    }
  });

  it("home priority is 1", () => {
    const home = sitemap().find((e) => new URL(e.url).pathname === "/");
    expect(home?.priority).toBe(1);
  });
});

describe("DEEL 8 — robots.ts", () => {
  it("allows / and disallows private paths", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule?.allow).toBe("/");
    const disallow = (Array.isArray(rule?.disallow) ? rule!.disallow : [rule?.disallow]).filter(Boolean) as string[];
    expect(disallow).toContain("/api/");
    expect(disallow).toContain("/admin/");
    expect(disallow).toContain("/dashboard");
    expect(disallow).toContain("/onderhandel/");
  });

  it("declares sitemap URL", () => {
    const r = robots();
    expect(r.sitemap).toMatch(/sitemap\.xml$/);
  });
});

describe("DEEL 8 — security headers", () => {
  it("next.config.mjs has X-Content-Type-Options and Referrer-Policy", () => {
    const src = read("next.config.mjs");
    expect(src).toMatch(/X-Content-Type-Options/);
    expect(src).toMatch(/nosniff/);
    expect(src).toMatch(/Referrer-Policy/);
    expect(src).toMatch(/Permissions-Policy/);
  });
});

/**
 * Regression test for DEEL 6 mobile UX fixes.
 *
 * Asserts via static-source check that touch-target sensitive components
 * carry the `min-h-[44px]` Tailwind class (or equivalent vertical
 * padding) so that buttons / chips clear the 44px Apple HIG target.
 *
 * Static source assertion is fine here — running JSDOM doesn't apply
 * Tailwind, and we don't want this regression test to depend on a real
 * browser.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("DEEL 6 — mobile touch targets ≥ 44px", () => {
  it("FAQ accordion button has min-h-[44px]", () => {
    const src = read("components/FAQ.tsx");
    expect(src).toContain("min-h-[44px]");
  });

  it("Proof page filter pills have min-h-[44px]", () => {
    const src = read("app/proof/page.tsx");
    // FilterPill is the only chip-style link on the page
    expect(src).toMatch(/FilterPill[\s\S]{0,2500}min-h-\[44px\]/);
  });

  it("mobile audit script exists and targets 375x812 viewport", () => {
    const src = read("scripts/mobile-audit.ts");
    expect(src).toMatch(/width:\s*375/);
    expect(src).toMatch(/height:\s*812/);
  });

  it("mobile audit captures screenshots into tests/screenshots/mobile", () => {
    const src = read("scripts/mobile-audit.ts");
    expect(src).toMatch(/tests\/screenshots\/mobile/);
  });
});

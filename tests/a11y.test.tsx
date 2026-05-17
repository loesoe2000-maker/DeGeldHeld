/**
 * Static-source a11y regression tests.
 *
 * Live axe-core runs are in scripts/a11y-audit.ts (browser required).
 * These vitest tests lock in the static fixes from DEEL 7 so they
 * can't silently regress:
 *
 *   - <html lang="nl"> in the root layout
 *   - login email input has an associated <label htmlFor>
 *   - hero email input has an associated label (sr-only or visible)
 *   - brand palette darkened so brand-600 on white passes WCAG AA
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const read = (rel: string): string => readFileSync(path.join(repoRoot, rel), "utf8");

function hex2rgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`bad hex: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrast(fg: string, bg: string): number {
  const L1 = relativeLuminance(hex2rgb(fg));
  const L2 = relativeLuminance(hex2rgb(bg));
  const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (light + 0.05) / (dark + 0.05);
}

describe("DEEL 7 — accessibility static guarantees", () => {
  it("root layout declares lang='nl'", () => {
    const src = read("app/layout.tsx");
    expect(src).toContain('<html lang="nl">');
  });

  it("login email input has htmlFor-associated label", () => {
    const src = read("app/login/page.tsx");
    expect(src).toMatch(/htmlFor="login-email"/);
    expect(src).toMatch(/id="login-email"/);
  });

  it("hero email input has a label (sr-only or visible)", () => {
    const src = read("components/Hero.tsx");
    expect(src).toMatch(/htmlFor="email"/);
    expect(src).toMatch(/id="email"/);
  });

  it("brand-600 on white passes WCAG AA (≥4.5:1)", () => {
    const tw = read("tailwind.config.ts");
    const m = tw.match(/600:\s*"(#[0-9a-fA-F]{6})"/);
    expect(m).toBeTruthy();
    const ratio = contrast(m![1], "#ffffff");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("brand-700 on white passes WCAG AA", () => {
    const tw = read("tailwind.config.ts");
    const m = tw.match(/700:\s*"(#[0-9a-fA-F]{6})"/);
    expect(m).toBeTruthy();
    const ratio = contrast(m![1], "#ffffff");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("a11y audit script targets WCAG 2.0/2.1 AA tags", () => {
    const src = read("scripts/a11y-audit.ts");
    expect(src).toMatch(/wcag2aa/);
    expect(src).toMatch(/wcag21aa/);
  });
});

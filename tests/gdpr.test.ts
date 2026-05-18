import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

/**
 * v14 DEEL 7 — AVG/GDPR finalisation. These tests assert the
 * source files contain the required disclosures; visual rendering
 * is verified by Playwright (separate file).
 */

describe("GDPR / privacy page completeness", () => {
  const src = read("app/privacy/page.tsx");

  it("lists every sub-processor", () => {
    expect(src).toMatch(/Vercel/);
    expect(src).toMatch(/Neon/);
    expect(src).toMatch(/Resend/);
    expect(src).toMatch(/Groq/);
    expect(src).toMatch(/Stripe/);
    expect(src).toMatch(/Sentry/);
  });

  it("mentions AVG rights (inzage, verwijderen, dataportabiliteit, AP)", () => {
    const lower = src.toLowerCase();
    expect(lower).toMatch(/inzage|toegang/);
    expect(lower).toMatch(/verwijder/);
    expect(lower).toMatch(/dataport|export/);
    expect(lower).toMatch(/autoriteit persoons|\bap\b/);
  });

  it("documents retention policy for OCR / Sentry / bills", () => {
    const lower = src.toLowerCase();
    expect(lower).toMatch(/30 dagen/);
    expect(lower).toMatch(/sentry/);
  });

  it("exposes a contact channel for AVG requests", () => {
    expect(src).toMatch(/hallo@degeldheld\.com|privacy@/i);
  });
});

describe("GDPR / voorwaarden completeness", () => {
  const src = read("app/voorwaarden/page.tsx");

  it("page exists and has body content", () => {
    expect(src.length).toBeGreaterThan(500);
  });

  it("disclaimer that we are NOT financial advice", () => {
    const lower = src.toLowerCase();
    expect(lower).toMatch(/geen.*advies|niet.*advies|geen.*finan/);
  });

  it("mentions the no-cure-no-pay fee or pricing reference", () => {
    expect(src).toMatch(/fee|tarief|prijs/i);
  });

  it("specifies jurisdiction: Nederland", () => {
    expect(src).toMatch(/Nederland/i);
  });
});

describe("GDPR / footer + cookie banner wired", () => {
  it("Footer links to /privacy and /voorwaarden", () => {
    const src = read("components/Footer.tsx");
    expect(src).toMatch(/\/privacy/);
    expect(src).toMatch(/\/voorwaarden/);
  });

  it("CookieBanner component exists", () => {
    expect(existsSync(resolve(ROOT, "components/CookieBanner.tsx"))).toBe(true);
  });

  it("CookieBanner is mounted in the layout", () => {
    const src = read("app/layout.tsx");
    expect(src).toMatch(/CookieBanner/);
  });
});

describe("GDPR / account data rights endpoints", () => {
  it("data export endpoint exists", () => {
    expect(existsSync(resolve(ROOT, "app/api/account/export/route.ts"))).toBe(true);
  });
  it("account delete endpoint exists", () => {
    expect(existsSync(resolve(ROOT, "app/api/account/delete/route.ts"))).toBe(true);
  });
  it("/account page renders both controls", () => {
    const src = read("app/account/page.tsx");
    expect(src).toMatch(/export/i);
    expect(src).toMatch(/verwijder/i);
  });
});

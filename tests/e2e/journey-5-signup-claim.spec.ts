/**
 * v16 DEEL 5 — Stap 5: magic-link signup + auto-claim of anonymous
 * bills.
 *
 * Driving a real magic-link click against prod requires either
 * Resend's test-inbox API key or a synthetic VerificationToken row
 * we'd write into the prod DB — both leave a permanent footprint.
 * The journey-test instead validates the wiring at the source level
 * and confirms the routes are reachable + behave correctly when
 * called without a valid token.
 *
 * What this gates:
 *   - lib/auth.ts events.createUser + events.signIn call
 *     claimAnonymousBills() and clear the dgh_anon_session cookie.
 *   - lib/anon-claim.ts has the email-fallback branch (v15.1 patch
 *     for cross-browser magic-link clicks).
 *   - GET /api/auth/callback/resend with no token redirects/errors
 *     gracefully, never 500.
 *   - /onderhandel page-level safety claim is wired (covers users
 *     already signed in who still carry the anon cookie).
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

test.describe("v16 journey-5 — signup + claim", () => {
  test("lib/auth.ts wires claim into createUser AND signIn events", () => {
    const src = read("lib/auth.ts");
    expect(src).toMatch(/events:/);
    expect(src).toMatch(/async createUser\(/);
    expect(src).toMatch(/async signIn\(/);
    // Both event-handlers reach into the claim helper.
    const claimImports = (src.match(/claimAnonymousBills/g) ?? []).length;
    expect(claimImports).toBeGreaterThanOrEqual(2);
    // Both clear the cookie after claim.
    const clearCookieCalls = (src.match(/ANON_COOKIE_NAME/g) ?? []).length;
    expect(clearCookieCalls).toBeGreaterThanOrEqual(2);
  });

  test("claimAnonymousBills supports the v15.1 email-fallback branch", () => {
    const src = read("lib/anon-claim.ts");
    // The cross-browser fix: claim by anonymousEmail OR session.
    expect(src).toMatch(/anonymousEmail/);
    expect(src).toMatch(/email\?:\s*string\s*\|\s*null/);
    expect(src).toMatch(/OR:\s*orClauses/);
  });

  test("/onderhandel does the page-level safety claim", () => {
    const src = read("app/onderhandel/page.tsx");
    // The page-level fallback so an already-signed-in user with a
    // stale anon-cookie still gets their bills claimed on the next
    // pageview.
    expect(src).toMatch(/ensureBillsClaimed/);
    expect(src).toMatch(/userEmail/);
  });

  test("GET /api/auth/callback/resend without a token returns a clean status", async ({ request }) => {
    // NextAuth's callback handler — must not 500 on a bare GET. It
    // returns 302 / 400 / 404 depending on version.
    const r = await request.get("/api/auth/callback/resend", {
      maxRedirects: 0,
    });
    expect(r.status()).toBeLessThan(500);
  });

  test("ensureBillsClaimed source uses claimAnonymousBills + cookie clear", () => {
    const src = read("lib/ensure-claim.ts");
    expect(src).toMatch(/claimAnonymousBills/);
    expect(src).toMatch(/ANON_COOKIE_NAME/);
    expect(src).toMatch(/maxAge:\s*0/);
  });

  test("post-claim redirect target is /onderhandel/email?bill=X", () => {
    const onderhandel = read("app/onderhandel/page.tsx");
    expect(onderhandel).toMatch(
      /redirect\(\s*[`'"]\/onderhandel\/email\?bill=\$\{[^}]+\}/,
    );
  });
});

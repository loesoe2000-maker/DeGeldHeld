import { describe, it, expect } from "vitest";

// The inline anonymous email-capture component was removed (its abuse guards
// moved to the magic-link send route — see tests/concurrency.test.ts). What
// remains worth locking in is that the analyse page routes anonymous visitors
// through /login with a bill callbackUrl instead of capturing email inline.
describe("Analyse page anonymous detection — source-level", () => {
  const { readFileSync } = require("node:fs");
  const { resolve } = require("node:path");
  const src = readFileSync(
    resolve(__dirname, "../app/onderhandel/analyse/page.tsx"),
    "utf8",
  );

  it("page reads the anonymous cookie when no session", () => {
    expect(src).toMatch(/ANON_COOKIE_NAME/);
    expect(src).toMatch(/anonymousSessionId/);
  });

  it("anonymous users get a 'verder' CTA routed via login with a bill callback", () => {
    // The inline email-capture block was replaced by a clear next-step button.
    // Anonymous visitors go through /login?callbackUrl=… and their bill is
    // claimed to the new account on login (lib/auth → claimAnonymousBills).
    expect(src).toMatch(/analyse-next-cta/);
    expect(src).toMatch(/login\?callbackUrl=/);
    expect(src).toMatch(/isAnonymous/);
  });

  it("v41 GRATIS: er staat helemaal geen paywall meer in de analyse-pagina", () => {
    expect(src).not.toMatch(/requiresPayment/);
    expect(src).not.toMatch(/\/pay\//);
  });
});

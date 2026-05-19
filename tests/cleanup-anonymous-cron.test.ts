/**
 * Contract test for the /api/cron/cleanup-anonymous route.
 *
 * Asserts at the source level so the cron's auth gate, lock,
 * Sentry capture, and 24h horizon stay intact across refactors.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../app/api/cron/cleanup-anonymous/route.ts"),
  "utf8",
);

describe("/api/cron/cleanup-anonymous — contract", () => {
  it("requires CRON_SECRET bearer auth", () => {
    expect(SRC).toMatch(/CRON_SECRET/);
    expect(SRC).toMatch(/401/);
  });

  it("acquires + releases the cron lock", () => {
    expect(SRC).toMatch(/acquireCronLock\("cleanup-anonymous"\)/);
    expect(SRC).toMatch(/releaseCronLock/);
  });

  it("hard-codes the 24-hour staleness threshold", () => {
    expect(SRC).toMatch(/deleteStaleAnonymousBills\(24\)/);
  });

  it("captures errors to Sentry", () => {
    expect(SRC).toMatch(/Sentry\.captureException/);
    expect(SRC).toMatch(/cron\/cleanup-anonymous/);
  });

  it("vercel.json schedules cleanup-anonymous daily at 03:00", () => {
    const vercel = readFileSync(
      resolve(__dirname, "../vercel.json"),
      "utf8",
    );
    expect(vercel).toMatch(/\/api\/cron\/cleanup-anonymous/);
    expect(vercel).toMatch(/"0 3 \* \* \*"/);
  });
});

describe("NextAuth claim-on-signup is wired into lib/auth.ts", () => {
  const auth = readFileSync(resolve(__dirname, "../lib/auth.ts"), "utf8");
  it("createUser event imports claimAnonymousBills", () => {
    expect(auth).toMatch(/claimAnonymousBills/);
  });
  it("clears the dgh_anon_session cookie after claim", () => {
    expect(auth).toMatch(/ANON_COOKIE_NAME/);
    expect(auth).toMatch(/maxAge:\s*0/);
  });
  it("signIn event also runs the claim (handles re-signin case)", () => {
    expect(auth).toMatch(/async signIn\(/);
  });
});

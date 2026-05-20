import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { authorizeCron } from "@/lib/cron-auth";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ORIG = { ...process.env };
afterEach(() => {
  process.env = { ...ORIG };
});
beforeEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.VERCEL_ENV;
  // NODE_ENV is "test" under vitest (not "production") → dev path.
});

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://t/api/cron/x", { headers });
}

describe("v20 DEEL 5 — authorizeCron gate", () => {
  it("accepts the correct Bearer CRON_SECRET", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(authorizeCron(req({ authorization: "Bearer s3cr3t" }))).toBe(true);
  });

  it("rejects a wrong / missing Bearer when a secret is set", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(authorizeCron(req({ authorization: "Bearer nope" }))).toBe(false);
    expect(authorizeCron(req())).toBe(false);
  });

  it("accepts Vercel's x-vercel-cron header", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(authorizeCron(req({ "x-vercel-cron": "1" }))).toBe(true);
  });

  it("FAIL-CLOSED: in production, a missing CRON_SECRET denies everyone", () => {
    process.env.VERCEL_ENV = "production";
    expect(authorizeCron(req())).toBe(false);
    expect(authorizeCron(req({ authorization: "Bearer anything" }))).toBe(false);
  });

  it("dev convenience: a missing CRON_SECRET allows outside production", () => {
    // NODE_ENV != production and no VERCEL_ENV → dev
    expect(authorizeCron(req())).toBe(true);
  });
});

describe("v20 DEEL 5 — every cron route uses the shared gate", () => {
  const ROOT = resolve(__dirname, "..");
  const CRONS = [
    "outcome-followup",
    "monthly-recheck",
    "psd2-sync",
    "follow-up",
    "recheck-savings",
    "fraud-check",
    "cleanup-anonymous",
    "price-staleness",
    "category-nudge",
    "contract-radar",
    "monthly-report",
  ];
  for (const job of CRONS) {
    it(`cron/${job} calls authorizeCron + returns 401`, () => {
      const s = readFileSync(resolve(ROOT, `app/api/cron/${job}/route.ts`), "utf8");
      expect(s).toMatch(/authorizeCron\(req\)/);
      expect(s).toMatch(/status:\s*401/);
      // no more fail-open inline check
      expect(s).not.toMatch(/if \(cronSecret &&/);
    });
  }
});

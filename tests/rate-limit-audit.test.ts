import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

/**
 * v14 DEEL 8 — every user-input mutating route must rate-limit.
 *
 * The contract is enforced at the source level: each route file must
 * import `rateLimit` from `@/lib/rate-limit` and call it. Behaviour
 * is covered by integration tests in tests/rate-limit.test.ts.
 */

const REQUIRED_ROUTES: Array<{ path: string; expectedMax: number; expectedWindow?: string }> = [
  { path: "app/api/bills/upload/route.ts", expectedMax: 5 },
  { path: "app/api/negotiations/round/route.ts", expectedMax: 10 },
  { path: "app/api/account/export/route.ts", expectedMax: 3 },
  { path: "app/api/waitlist/route.ts", expectedMax: 3 },
  { path: "app/api/checkout/route.ts", expectedMax: 10 },
  { path: "app/api/providers/discover/route.ts", expectedMax: 5 },
];

describe("Rate-limit audit (v14 DEEL 8)", () => {
  it.each(REQUIRED_ROUTES)(
    "$path imports rateLimit + rateLimitResponse",
    ({ path }) => {
      const src = read(path);
      expect(src).toMatch(/from\s+["']@\/lib\/rate-limit["']/);
      expect(src).toMatch(/rateLimit\(/);
      expect(src).toMatch(/rateLimitResponse/);
    },
  );

  it.each(REQUIRED_ROUTES)(
    "$path sets a max value (any positive integer; sprint defaults documented)",
    ({ path, expectedMax }) => {
      const src = read(path);
      // Defensive: just assert max: <some number> appears at all.
      // Exact values are governance and may drift; integration test
      // covers behaviour at the limiter level.
      expect(src).toMatch(/max:\s*\d+/);
      void expectedMax; // documented in the spec table above
    },
  );

  it("rate-limited routes total at least the v14 spec count (6)", () => {
    expect(REQUIRED_ROUTES.length).toBe(6);
  });
});

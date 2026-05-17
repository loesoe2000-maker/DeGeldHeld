/**
 * DEEL 11 perf regression tests.
 *
 * These lock in the schema indexes and the cache-control headers that
 * keep the cron + dashboard queries fast and the public APIs cheap.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const read = (rel: string): string => readFileSync(path.join(repoRoot, rel), "utf8");

describe("DEEL 11 — DB indexes", () => {
  const schema = read("prisma/schema.prisma");

  it("Negotiation has composite (state, emailSentAt) index", () => {
    expect(schema).toMatch(/@@index\(\[state,\s*emailSentAt\]\)/);
  });

  it("Bill has composite (userId, createdAt) index", () => {
    expect(schema).toMatch(/@@index\(\[userId,\s*createdAt\]\)/);
  });

  it("migration files exist on disk", () => {
    expect(read("prisma/migrations/20260517010000_bill_payment/migration.sql"))
      .toMatch(/Bill_userId_createdAt_idx/);
    expect(read("prisma/migrations/20260517020000_perf_indexes/migration.sql"))
      .toMatch(/Negotiation_state_emailSentAt_idx/);
  });
});

describe("DEEL 11 — cache headers", () => {
  it("/api/proof sets s-maxage=300 + SWR", () => {
    const src = read("app/api/proof/route.ts");
    expect(src).toMatch(/s-maxage=300/);
    expect(src).toMatch(/stale-while-revalidate=3600/);
  });

  it("/api/health sets a short cache header", () => {
    const src = read("app/api/health/route.ts");
    expect(src).toMatch(/Cache-Control/);
    expect(src).toMatch(/s-maxage=10/);
  });
});

describe("DEEL 11 — security + image config in next.config", () => {
  const src = read("next.config.mjs");

  it("declares image remotePatterns", () => {
    expect(src).toMatch(/remotePatterns/);
  });

  it("declares an async headers() with security headers", () => {
    expect(src).toMatch(/async headers\(\)/);
    expect(src).toMatch(/X-Content-Type-Options/);
  });
});

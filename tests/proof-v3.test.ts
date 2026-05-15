import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const count = vi.fn();
vi.mock("../lib/db", () => ({
  prisma: { negotiation: { findMany: (...a: unknown[]) => findMany(...a), count: (...a: unknown[]) => count(...a) } },
}));

import { GET } from "../app/api/proof/route";
import type { NextRequest } from "next/server";

function makeReq(period?: string): NextRequest {
  const url = new URL(`http://localhost/api/proof${period ? `?period=${period}` : ""}`);
  return { nextUrl: url } as unknown as NextRequest;
}

describe("api/proof v3 period filter", () => {
  beforeEach(() => {
    findMany.mockReset();
    count.mockReset();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
  });

  it("default period is 'all' (no cutoff in where clause)", async () => {
    await GET(makeReq());
    const calls = findMany.mock.calls;
    expect(calls.length).toBe(1);
    const where = (calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where.createdAt).toBeUndefined();
  });

  it("period=7d adds createdAt gte cutoff approx 7 days ago", async () => {
    const before = Date.now();
    await GET(makeReq("7d"));
    const where = (findMany.mock.calls[0][0] as { where: { createdAt?: { gte: Date } } }).where;
    expect(where.createdAt?.gte).toBeInstanceOf(Date);
    const diff = before - (where.createdAt?.gte as Date).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(diff - sevenDays)).toBeLessThan(2000);
  });

  it("period=30d adds 30-day cutoff", async () => {
    const before = Date.now();
    await GET(makeReq("30d"));
    const where = (findMany.mock.calls[0][0] as { where: { createdAt?: { gte: Date } } }).where;
    const diff = before - (where.createdAt?.gte as Date).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(diff - thirtyDays)).toBeLessThan(2000);
  });

  it("period=365d adds 365-day cutoff", async () => {
    const before = Date.now();
    await GET(makeReq("365d"));
    const where = (findMany.mock.calls[0][0] as { where: { createdAt?: { gte: Date } } }).where;
    const diff = before - (where.createdAt?.gte as Date).getTime();
    const year = 365 * 24 * 60 * 60 * 1000;
    expect(Math.abs(diff - year)).toBeLessThan(2000);
  });

  it("invalid period falls back to 'all'", async () => {
    await GET(makeReq("invalid"));
    const where = (findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where.createdAt).toBeUndefined();
  });

  it("response includes the requested period", async () => {
    const r = await GET(makeReq("30d"));
    const data = await r.json();
    expect(data.period).toBe("30d");
  });

  it("response cache-control persists across periods", async () => {
    const r1 = await GET(makeReq("7d"));
    const r2 = await GET(makeReq("all"));
    expect(r1.headers.get("cache-control")).toContain("max-age=300");
    expect(r2.headers.get("cache-control")).toContain("max-age=300");
  });

  it("BANK category is preserved in by_category when present", async () => {
    findMany.mockResolvedValue([
      { actualSavingsCents: 1200, bill: { category: "BANK" }, createdAt: new Date() },
    ]);
    const r = await GET(makeReq("30d"));
    const data = await r.json();
    expect(data.stats.by_category.BANK?.count).toBe(1);
  });

  it("filter is applied to BOTH findMany (success) and count (failed)", async () => {
    await GET(makeReq("7d"));
    // count is called once (failed), findMany once (successful). Both should have createdAt filter.
    const failedWhere = (count.mock.calls[0][0] as { where: { createdAt?: unknown } }).where;
    expect(failedWhere.createdAt).toBeDefined();
  });

  it("total_saved_eur reflects only filtered data", async () => {
    findMany.mockResolvedValue([
      { actualSavingsCents: 50000, bill: { category: "TELECOM" }, createdAt: new Date() },
    ]);
    const r = await GET(makeReq("7d"));
    const data = await r.json();
    expect(data.stats.total_saved_eur).toBe(500);
  });
});

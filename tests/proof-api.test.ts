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

describe("api/proof GET", () => {
  beforeEach(() => {
    findMany.mockReset();
    count.mockReset();
  });

  it("returns 0-stats when no data", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    const r = await GET(makeReq());
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.stats.total_negotiations).toBe(0);
    expect(data.stats.success_rate).toBe(0);
  });

  it("computes total saved", async () => {
    findMany.mockResolvedValue([
      { actualSavingsCents: 10000, bill: { category: "TELECOM" }, createdAt: new Date() },
      { actualSavingsCents: 5000, bill: { category: "ENERGIE" }, createdAt: new Date() },
    ]);
    count.mockResolvedValue(0);
    const r = await GET(makeReq());
    const data = await r.json();
    expect(data.stats.total_saved_eur).toBe(150);
    expect(data.stats.average_saved_eur).toBe(75);
  });

  it("computes success_rate", async () => {
    findMany.mockResolvedValue([
      { actualSavingsCents: 1000, bill: { category: "TELECOM" }, createdAt: new Date() },
    ]);
    count.mockResolvedValue(3);
    const r = await GET(makeReq());
    const data = await r.json();
    expect(data.stats.total_negotiations).toBe(4);
    expect(data.stats.success_rate).toBe(0.25);
  });

  it("breaks down by category", async () => {
    findMany.mockResolvedValue([
      { actualSavingsCents: 1000, bill: { category: "TELECOM" }, createdAt: new Date() },
      { actualSavingsCents: 2000, bill: { category: "TELECOM" }, createdAt: new Date() },
      { actualSavingsCents: 1500, bill: { category: "ENERGIE" }, createdAt: new Date() },
    ]);
    count.mockResolvedValue(0);
    const r = await GET(makeReq());
    const data = await r.json();
    expect(data.stats.by_category.TELECOM.count).toBe(2);
    expect(data.stats.by_category.TELECOM.totalCents).toBe(3000);
    expect(data.stats.by_category.ENERGIE.count).toBe(1);
  });

  it("includes Cache-Control header", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    const r = await GET(makeReq());
    expect(r.headers.get("cache-control")).toContain("max-age=300");
  });

  it("includes generated_at timestamp", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    const r = await GET(makeReq());
    const data = await r.json();
    expect(data.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

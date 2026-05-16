import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      count: (...a: unknown[]) => mockCount(...a),
    },
  },
}));

beforeEach(() => {
  mockFindMany.mockReset();
  mockCount.mockReset();
  mockFindMany.mockResolvedValue([]);
  mockCount.mockResolvedValue(0);
});

async function callProof(query: string) {
  const { GET } = await import("@/app/api/proof/route");
  const { NextRequest } = await import("next/server");
  const url = `https://test.app/api/proof${query ? `?${query}` : ""}`;
  return GET(new NextRequest(url));
}

describe("/api/proof — filter combinations", () => {
  it("no filters → no bill where clause", async () => {
    await callProof("");
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.bill).toBeUndefined();
  });

  it("country=NL adds bill.country filter", async () => {
    await callProof("country=NL");
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.bill).toEqual({ country: "NL" });
  });

  it("category=TELECOM adds bill.category filter", async () => {
    await callProof("category=TELECOM");
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.bill).toEqual({ category: "TELECOM" });
  });

  it("country + category combined", async () => {
    await callProof("country=DE&category=ENERGIE");
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.bill).toEqual({ country: "DE", category: "ENERGIE" });
  });

  it("basis=actual uses actualSavingsCents; basis=expected uses expected", async () => {
    mockFindMany.mockResolvedValueOnce([
      { actualSavingsCents: 1000, expectedSavingsCents: 5000, bill: { category: "TELECOM" }, createdAt: new Date() },
    ]);
    const r1 = await callProof("basis=actual");
    const d1 = (await r1.json()) as { stats: { total_saved_eur: number } };
    expect(d1.stats.total_saved_eur).toBe(10);

    mockFindMany.mockResolvedValueOnce([
      { actualSavingsCents: 1000, expectedSavingsCents: 5000, bill: { category: "TELECOM" }, createdAt: new Date() },
    ]);
    const r2 = await callProof("basis=expected");
    const d2 = (await r2.json()) as { stats: { total_saved_eur: number } };
    expect(d2.stats.total_saved_eur).toBe(50);
  });

  it("returns ACCEPTED state alongside legacy SUCCESS/BILLED", async () => {
    await callProof("");
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.state.in).toContain("ACCEPTED");
    expect(where.state.in).toContain("SUCCESS");
    expect(where.state.in).toContain("BILLED");
  });
});

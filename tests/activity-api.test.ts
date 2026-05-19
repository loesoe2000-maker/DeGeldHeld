import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn<(args: unknown) => Promise<unknown[]>>(async () => []);

vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: {
      findMany: (args: unknown) => findMany(args),
    },
  },
}));

import { GET } from "@/app/api/activity/route";

describe("/api/activity — v15 DEEL 4", () => {
  beforeEach(() => findMany.mockReset());

  it("returns { items: [] } when no successful negotiations exist", async () => {
    findMany.mockResolvedValue([]);
    const r = await GET();
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data).toEqual({ items: [] });
  });

  it("anonymises rows: provider + savings + country + ageSeconds, NO user identifier", async () => {
    const now = Date.now();
    findMany.mockResolvedValue([
      {
        createdAt: new Date(now - 5 * 60 * 1000), // 5 min ago
        actualSavingsCents: 12000,
        bill: { provider: "KPN", country: "NL" },
      },
      {
        createdAt: new Date(now - 60 * 60 * 1000), // 1h ago
        actualSavingsCents: 35000,
        bill: { provider: "Eneco", country: "NL" },
      },
    ]);
    const r = await GET();
    const data = await r.json();
    expect(data.items.length).toBe(2);
    for (const it of data.items) {
      expect(it.provider).toBeTruthy();
      expect(typeof it.savingsCents).toBe("number");
      expect(typeof it.country).toBe("string");
      expect(typeof it.ageSeconds).toBe("number");
      // No leakage of internal fields
      expect((it as Record<string, unknown>).userId).toBeUndefined();
      expect((it as Record<string, unknown>).userEmail).toBeUndefined();
      expect((it as Record<string, unknown>).userName).toBeUndefined();
    }
  });

  it("sets Cache-Control with s-maxage=30", async () => {
    findMany.mockResolvedValue([]);
    const r = await GET();
    expect(r.headers.get("cache-control")).toMatch(/s-maxage=30/);
    expect(r.headers.get("cache-control")).toMatch(/stale-while-revalidate=60/);
  });

  it("filters by state in {SUCCESS, BILLED, ACCEPTED}", async () => {
    findMany.mockResolvedValue([]);
    await GET();
    const args = findMany.mock.calls[0]?.[0] as {
      where: { state: { in: string[] } };
    };
    expect(args.where.state.in).toEqual(["SUCCESS", "BILLED", "ACCEPTED"]);
  });

  it("filters to last 7 days (createdAt >= cutoff)", async () => {
    findMany.mockResolvedValue([]);
    await GET();
    const args = findMany.mock.calls[0]?.[0] as {
      where: { createdAt: { gte: Date } };
    };
    const cutoff = args.where.createdAt.gte;
    const expected = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // Allow 1-second drift
    expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(2000);
  });

  it("takes at most 10 items", async () => {
    findMany.mockResolvedValue([]);
    await GET();
    const args = findMany.mock.calls[0]?.[0] as { take: number };
    expect(args.take).toBe(10);
  });

  it("ageSeconds reflects real createdAt offset", async () => {
    const now = Date.now();
    findMany.mockResolvedValue([
      {
        createdAt: new Date(now - 90 * 1000), // 90s ago
        actualSavingsCents: 5000,
        bill: { provider: "Bunq", country: "NL" },
      },
    ]);
    const r = await GET();
    const data = await r.json();
    expect(data.items[0].ageSeconds).toBeGreaterThanOrEqual(89);
    expect(data.items[0].ageSeconds).toBeLessThanOrEqual(92);
  });
});

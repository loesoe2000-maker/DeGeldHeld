import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockAuth = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    negotiation: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  auth: (...a: unknown[]) => mockAuth(...a),
}));

beforeEach(() => {
  mockFindMany.mockReset();
  mockAuth.mockReset();
});

async function callDashboard() {
  const { GET } = await import("@/app/api/dashboard/route");
  return GET();
}

describe("api/dashboard GET", () => {
  it("401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const r = await callDashboard();
    expect(r.status).toBe(401);
  });

  it("aggregates summary correctly", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockFindMany.mockResolvedValueOnce([
      {
        id: "n1", state: "ACCEPTED", expectedSavingsCents: 12000, actualSavingsCents: 14000,
        emailSentAt: null, createdAt: new Date(),
        bill: { provider: "KPN", category: "TELECOM", amountCents: 2500 },
      },
      {
        id: "n2", state: "REJECTED", expectedSavingsCents: 12000, actualSavingsCents: null,
        emailSentAt: null, createdAt: new Date(),
        bill: { provider: "Vodafone", category: "TELECOM", amountCents: 3000 },
      },
      {
        id: "n3", state: "EMAIL_SENT", expectedSavingsCents: 8000, actualSavingsCents: null,
        emailSentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        bill: { provider: "Eneco", category: "ENERGIE", amountCents: 9000 },
      },
    ]);
    const r = await callDashboard();
    expect(r.status).toBe(200);
    const data = (await r.json()) as { summary: { totalSavedCents: number; open: number; completed: number; failed: number; total: number }; active: Array<{ daysSinceSent: number | null }> };
    expect(data.summary.completed).toBe(1);
    expect(data.summary.failed).toBe(1);
    expect(data.summary.open).toBe(1);
    expect(data.summary.totalSavedCents).toBe(14000);
    expect(data.active).toHaveLength(1);
    expect(data.active[0].daysSinceSent).toBe(3);
  });

  it("returns all 14 categories so dashboard can render upload slots", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockFindMany.mockResolvedValueOnce([]);
    const r = await callDashboard();
    const data = (await r.json()) as { categories: string[] };
    expect(data.categories.length).toBe(14);
    expect(data.categories).toContain("TELECOM");
    expect(data.categories).toContain("STREAMING");
    expect(data.categories).toContain("WATER");
  });

  it("caches per-user (second call has x-cache: HIT)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u2" } });
    mockFindMany.mockResolvedValue([]);
    const a = await callDashboard();
    const b = await callDashboard();
    expect(a.headers.get("x-cache")).toBeTruthy();
    expect(b.headers.get("x-cache")).toBe("HIT");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma client met in-memory store voor Bill.
type FakeBill = {
  id: string;
  provider: string;
  amountCents: number;
  createdAt: Date;
};

let store: FakeBill[] = [];

vi.mock("../lib/db", () => ({
  prisma: {
    bill: {
      count: vi.fn(async ({ where }: { where: unknown }) => filterStore(where).length),
      deleteMany: vi.fn(async ({ where }: { where: unknown }) => {
        const matches = filterStore(where);
        const ids = new Set(matches.map((m) => m.id));
        store = store.filter((b) => !ids.has(b.id));
        return { count: matches.length };
      }),
    },
  },
}));

function filterStore(where: unknown): FakeBill[] {
  const w = where as {
    AND: Array<{
      OR?: { provider?: string }[];
      provider?: string;
      amountCents?: number;
      createdAt?: { lt: Date };
    }>;
  };
  return store.filter((b) => {
    for (const clause of w.AND) {
      if (clause.OR) {
        const ok = clause.OR.some((or) => or.provider === b.provider);
        if (!ok) return false;
      }
      if (clause.amountCents != null && b.amountCents !== clause.amountCents) return false;
      if (clause.createdAt?.lt && !(b.createdAt < clause.createdAt.lt)) return false;
    }
    return true;
  });
}

import { cleanupStaleBills } from "../scripts/cleanup-stale-bills";

const NOW = new Date("2026-05-15T12:00:00Z");
const OLD = new Date(NOW.getTime() - 48 * 60 * 60 * 1000); // 48u geleden
const RECENT = new Date(NOW.getTime() - 2 * 60 * 60 * 1000); // 2u geleden

describe("cleanup-stale-bills", () => {
  beforeEach(() => {
    store = [];
  });

  it("verwijdert 2 stale bills, behoudt 2 goede", async () => {
    store = [
      // Stale: Onbekend + 0 + 48u oud → delete
      { id: "stale-1", provider: "Onbekend", amountCents: 0, createdAt: OLD },
      // Stale: lege provider + 0 + 48u oud → delete
      { id: "stale-2", provider: "", amountCents: 0, createdAt: OLD },
      // OK: echte provider + bedrag → keep
      { id: "ok-1", provider: "KPN", amountCents: 2466, createdAt: OLD },
      // OK: Onbekend maar wel bedrag → keep (gebruiker invul-flow)
      { id: "ok-2", provider: "Onbekend", amountCents: 1500, createdAt: OLD },
    ];
    const result = await cleanupStaleBills({ now: NOW });
    expect(result.matched).toBe(2);
    expect(result.deleted).toBe(2);
    expect(store.map((b) => b.id).sort()).toEqual(["ok-1", "ok-2"]);
  });

  it("verwijdert geen recente stale (binnen 24u — geeft user kans op retry)", async () => {
    store = [
      { id: "recent-stale", provider: "Onbekend", amountCents: 0, createdAt: RECENT },
      { id: "old-stale", provider: "Onbekend", amountCents: 0, createdAt: OLD },
    ];
    const result = await cleanupStaleBills({ now: NOW });
    expect(result.deleted).toBe(1);
    expect(store.map((b) => b.id)).toEqual(["recent-stale"]);
  });

  it("idempotent: tweede run verwijdert niets meer", async () => {
    store = [
      { id: "stale-1", provider: "Onbekend", amountCents: 0, createdAt: OLD },
      { id: "ok-1", provider: "KPN", amountCents: 2466, createdAt: OLD },
    ];
    await cleanupStaleBills({ now: NOW });
    const second = await cleanupStaleBills({ now: NOW });
    expect(second.matched).toBe(0);
    expect(second.deleted).toBe(0);
  });

  it("retourneert {deleted:0, matched:0} bij lege DB", async () => {
    store = [];
    const result = await cleanupStaleBills({ now: NOW });
    expect(result.matched).toBe(0);
    expect(result.deleted).toBe(0);
  });

  it("verwijdert lege provider (empty string)", async () => {
    store = [{ id: "empty", provider: "", amountCents: 0, createdAt: OLD }];
    const result = await cleanupStaleBills({ now: NOW });
    expect(result.deleted).toBe(1);
    expect(store.length).toBe(0);
  });

  it("behoudt OK provider + 0 amount (gebruiker kan dit nog invullen)", async () => {
    store = [{ id: "user-todo", provider: "KPN", amountCents: 0, createdAt: OLD }];
    const result = await cleanupStaleBills({ now: NOW });
    // provider niet in ("Onbekend", "") → niet match
    expect(result.deleted).toBe(0);
    expect(store.length).toBe(1);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const updateMany = vi.fn(async () => ({ count: 0 }));
const findMany = vi.fn(async () => [] as { id: string }[]);
const deleteMany = vi.fn(async () => ({ count: 0 }));

vi.mock("@/lib/db", () => ({
  prisma: {
    bill: {
      findMany: (...args: unknown[]) =>
        findMany(...(args as Parameters<typeof findMany>)),
      updateMany: (...args: unknown[]) =>
        updateMany(...(args as Parameters<typeof updateMany>)),
      deleteMany: (...args: unknown[]) =>
        deleteMany(...(args as Parameters<typeof deleteMany>)),
    },
  },
}));

import { claimAnonymousBills, deleteStaleAnonymousBills } from "@/lib/anon-claim";

describe("claimAnonymousBills (v15 DEEL 3)", () => {
  beforeEach(() => {
    findMany.mockReset();
    updateMany.mockReset();
    findMany.mockResolvedValue([]);
    updateMany.mockResolvedValue({ count: 0 });
  });

  it("invalid sessionId → no-op (0 claimed)", async () => {
    const r = await claimAnonymousBills("user_1", "not-a-uuid");
    expect(r.claimed).toBe(0);
    expect(r.firstBillId).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("no bills matching the cookie → 0 claimed, no updateMany", async () => {
    findMany.mockResolvedValue([]);
    const r = await claimAnonymousBills(
      "user_1",
      "12345678-90ab-4cde-9012-345678901234",
    );
    expect(r.claimed).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("3 anonymous bills → 3 claimed, firstBillId = newest", async () => {
    findMany.mockResolvedValue([
      { id: "bill_newest" },
      { id: "bill_middle" },
      { id: "bill_oldest" },
    ]);
    updateMany.mockResolvedValue({ count: 3 });
    const r = await claimAnonymousBills(
      "user_1",
      "12345678-90ab-4cde-9012-345678901234",
    );
    expect(r.claimed).toBe(3);
    expect(r.firstBillId).toBe("bill_newest");
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});

describe("deleteStaleAnonymousBills (v15 DEEL 3d)", () => {
  beforeEach(() => deleteMany.mockReset());

  it("deletes bills older than maxAgeHours that are still anonymous", async () => {
    deleteMany.mockResolvedValue({ count: 7 });
    const r = await deleteStaleAnonymousBills(24);
    expect(r).toBe(7);
    expect(deleteMany).toHaveBeenCalledTimes(1);
    const call = (deleteMany.mock.calls[0] as unknown[])[0] as {
      where: {
        anonymousSessionId: { not: null };
        userId: null;
        createdAt: { lt: Date };
      };
    };
    expect(call.where.anonymousSessionId).toEqual({ not: null });
    expect(call.where.userId).toBeNull();
    expect(call.where.createdAt.lt).toBeInstanceOf(Date);
  });

  it("cutoff is exactly N hours back from `now`", async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    const now = new Date("2026-05-20T10:00:00Z");
    await deleteStaleAnonymousBills(24, now);
    const call = (deleteMany.mock.calls[0] as unknown[])[0] as {
      where: { createdAt: { lt: Date } };
    };
    const cutoff = call.where.createdAt.lt;
    expect(cutoff.toISOString()).toBe("2026-05-19T10:00:00.000Z");
  });
});

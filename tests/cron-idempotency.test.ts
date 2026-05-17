import { describe, it, expect, vi, beforeEach } from "vitest";

const cronCreate = vi.fn();
const cronUpdate = vi.fn(async (_a: unknown) => ({}));
vi.mock("../lib/db", () => ({
  prisma: {
    cronRunLog: {
      create: (a: unknown) => cronCreate(a),
      update: (a: unknown) => cronUpdate(a),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));

import { acquireCronLock, releaseCronLock } from "../lib/cron-lock";

beforeEach(() => {
  cronCreate.mockReset();
  cronUpdate.mockReset().mockResolvedValue({});
});

describe("acquireCronLock", () => {
  it("returns the row id when first INSERT succeeds", async () => {
    cronCreate.mockResolvedValue({ id: "lock-1" });
    const id = await acquireCronLock("follow-up");
    expect(id).toBe("lock-1");
    const call = cronCreate.mock.calls[0][0] as { data: { jobName: string; runDate: string; status: string } };
    expect(call.data.jobName).toBe("follow-up");
    expect(call.data.runDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(call.data.status).toBe("running");
  });

  it("returns null when INSERT throws (unique violation)", async () => {
    cronCreate.mockRejectedValue(new Error("P2002: Unique constraint"));
    const id = await acquireCronLock("monthly-recheck");
    expect(id).toBeNull();
  });

  it("two concurrent acquires for the same job → only one wins", async () => {
    let called = 0;
    cronCreate.mockImplementation(async () => {
      called++;
      if (called > 1) throw new Error("P2002");
      return { id: "winner" };
    });
    const [a, b] = await Promise.all([
      acquireCronLock("follow-up"),
      acquireCronLock("follow-up"),
    ]);
    const winners = [a, b].filter((x) => x !== null);
    const losers = [a, b].filter((x) => x === null);
    expect(winners.length).toBe(1);
    expect(losers.length).toBe(1);
  });
});

describe("releaseCronLock", () => {
  it("marks done + writes itemsProcessed on success", async () => {
    await releaseCronLock({ id: "lock-1", itemsProcessed: 5, ok: true });
    const call = cronUpdate.mock.calls[0][0] as { where: { id: string }; data: { status: string; itemsProcessed: number } };
    expect(call.where.id).toBe("lock-1");
    expect(call.data.status).toBe("done");
    expect(call.data.itemsProcessed).toBe(5);
  });

  it("marks failed when ok=false", async () => {
    await releaseCronLock({ id: "lock-1", itemsProcessed: 0, ok: false });
    const call = cronUpdate.mock.calls[0][0] as { data: { status: string } };
    expect(call.data.status).toBe("failed");
  });

  it("never throws even if DB update fails", async () => {
    cronUpdate.mockRejectedValue(new Error("DB down"));
    await expect(releaseCronLock({ id: "x", itemsProcessed: 0, ok: true })).resolves.toBeUndefined();
  });
});

/**
 * Cron-idempotency integration: against real Neon test branch, verify
 * that two parallel runs only insert ONE lock row, and second run
 * silently exits.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

const SKIP = !process.env.DATABASE_URL_TEST;
const prisma = SKIP
  ? (null as unknown as PrismaClient)
  : new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_TEST! } } });

beforeAll(() => {
  if (SKIP) return;
});

beforeEach(async () => {
  if (SKIP) return;
  await prisma.cronRunLog.deleteMany({
    where: { jobName: { in: ["outcome-followup", "monthly-recheck"] } },
  });
});

afterAll(async () => {
  if (SKIP) return;
  await prisma.$disconnect();
});

describe.skipIf(SKIP)("integration: cron lock against real Neon", () => {
  it("two parallel acquireCronLock calls — only one row, second returns null", async () => {
    // Re-import after pointing prisma client to the test DB
    process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
    process.env.DIRECT_URL = process.env.DATABASE_URL_TEST;
    const { acquireCronLock, _clearCronLockForToday } = await import("@/lib/cron-lock");
    await _clearCronLockForToday("outcome-followup");
    const [a, b] = await Promise.all([
      acquireCronLock("outcome-followup"),
      acquireCronLock("outcome-followup"),
    ]);
    const winners = [a, b].filter((x) => x !== null);
    const losers = [a, b].filter((x) => x === null);
    expect(winners.length).toBe(1);
    expect(losers.length).toBe(1);
    const rows = await prisma.cronRunLog.count({
      where: { jobName: "outcome-followup" },
    });
    expect(rows).toBe(1);
  });

  it("releaseCronLock marks the row completed", async () => {
    const { acquireCronLock, releaseCronLock } = await import("@/lib/cron-lock");
    const id = await acquireCronLock("monthly-recheck");
    expect(id).not.toBeNull();
    await releaseCronLock({ id: id!, itemsProcessed: 3, ok: true });
    const row = await prisma.cronRunLog.findUnique({ where: { id: id! } });
    expect(row?.status).toBe("done");
    expect(row?.itemsProcessed).toBe(3);
    expect(row?.completedAt).not.toBeNull();
  });
});

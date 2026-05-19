/**
 * lib/cron-lock.ts — per-(job, date) idempotency lock.
 *
 * Vercel can dispatch the same cron twice during rolling deploys.
 * We use a unique-constraint INSERT race: the first instance wins,
 * the loser silently exits.
 */

import { prisma } from "@/lib/db";

export type CronJobName =
  | "outcome-followup"
  | "monthly-recheck"
  | "psd2-sync"
  | "follow-up"
  | "recheck-savings"
  | "fraud-check"
  | "cleanup-anonymous";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Try to acquire the lock for today. Returns the row id when we
 * captured the lock; null when another instance already holds it
 * for this UTC day (we should silently exit).
 */
export async function acquireCronLock(jobName: CronJobName): Promise<string | null> {
  try {
    const row = await prisma.cronRunLog.create({
      data: { jobName, runDate: todayUtc(), status: "running" },
      select: { id: true },
    });
    return row.id;
  } catch {
    // Unique-constraint failure → another instance got it
    return null;
  }
}

export async function releaseCronLock(opts: {
  id: string;
  itemsProcessed: number;
  ok: boolean;
}): Promise<void> {
  try {
    await prisma.cronRunLog.update({
      where: { id: opts.id },
      data: {
        status: opts.ok ? "done" : "failed",
        itemsProcessed: opts.itemsProcessed,
        completedAt: new Date(),
      },
    });
  } catch {
    // Lock-release never throws — cron should not 500 on bookkeeping
  }
}

/**
 * Test helper: clears today's lock for a job. Tests reset state with this
 * instead of touching the DB directly.
 */
export async function _clearCronLockForToday(jobName: CronJobName): Promise<void> {
  try {
    await prisma.cronRunLog.deleteMany({
      where: { jobName, runDate: todayUtc() },
    });
  } catch {
    // never throws
  }
}

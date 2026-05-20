/**
 * GET /api/admin/cron-status — admin-only observability for the 8 crons.
 *
 * Returns the most-recent CronRunLog row per job (status, when it ran,
 * how many items it processed, how long it took) plus a staleness flag so
 * you can see at a glance whether a scheduled job silently stopped firing.
 */
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin_auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALL_JOBS = [
  "outcome-followup",
  "monthly-recheck",
  "psd2-sync",
  "follow-up",
  "recheck-savings",
  "fraud-check",
  "cleanup-anonymous",
  "price-staleness",
  "category-nudge",
  "contract-radar",
  "monthly-report",
] as const;

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = Date.now();
  const jobs = await Promise.all(
    ALL_JOBS.map(async (jobName) => {
      const last = await prisma.cronRunLog.findFirst({
        where: { jobName },
        orderBy: { startedAt: "desc" },
      });
      if (!last) {
        return { jobName, lastRun: null, neverRan: true };
      }
      const durationMs = last.completedAt
        ? last.completedAt.getTime() - last.startedAt.getTime()
        : null;
      const ageHours = (now - last.startedAt.getTime()) / 3_600_000;
      return {
        jobName,
        status: last.status,
        startedAt: last.startedAt.toISOString(),
        completedAt: last.completedAt?.toISOString() ?? null,
        itemsProcessed: last.itemsProcessed,
        durationMs,
        // most jobs run daily; >36h since the last start usually means it
        // stopped firing (price-staleness is monthly, so excluded).
        stale: jobName !== "price-staleness" && ageHours > 36,
        neverRan: false,
      };
    }),
  );

  return NextResponse.json({ ok: true, jobs, generatedAt: new Date().toISOString() });
}

/**
 * GET /api/cron/cleanup-anonymous — v15 DEEL 3.
 *
 * Deletes anonymous bills older than 24 hours that were never claimed
 * via signup. Prevents the table from filling up with bot-uploads
 * (rate-limit + Turnstile catch most upstream, but this is the
 * last-line garbage collector).
 */
import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { acquireCronLock, releaseCronLock } from "@/lib/cron-lock";
import { deleteStaleAnonymousBills } from "@/lib/anon-claim";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lockId = await acquireCronLock("cleanup-anonymous");
  if (!lockId) return NextResponse.json({ ok: true, skipped: "already-running" });

  let deleted = 0;
  let ok = true;
  try {
    deleted = await deleteStaleAnonymousBills(24);
  } catch (e) {
    ok = false;
    Sentry.captureException(e, { tags: { module: "cron/cleanup-anonymous" } });
  } finally {
    await releaseCronLock({ id: lockId, itemsProcessed: deleted, ok });
  }
  return NextResponse.json({ ok: true, deleted });
}

import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { followUpBrandedHtml, followUpBrandedSubject } from "@/lib/email_templates";
import { acquireCronLock, releaseCronLock } from "@/lib/cron-lock";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron (Vercel Cron). Configured via vercel.json:
 *   schedule: "0 9 * * *"  (09:00 UTC daily)
 *
 * Authorize via Authorization: Bearer ${CRON_SECRET}.
 */

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lockId = await acquireCronLock("follow-up");
  if (!lockId) {
    return NextResponse.json({ ok: true, skipped: "already-running" });
  }

  let sent = 0;
  let failed = 0;
  let considered = 0;
  try {
    const now = new Date();
    const due = await prisma.negotiation.findMany({
      where: { state: "AWAITING", followUpAt: { lte: now }, closedAt: null },
      include: { user: true, bill: true },
      take: 50,
    });
    considered = due.length;

    for (const n of due) {
      try {
        await sendEmail({
          to: n.user.email,
          subject: followUpBrandedSubject(n.bill.provider),
          html: followUpBrandedHtml({
            customerName: n.user.name ?? n.user.email,
            provider: n.bill.provider,
            negotiationId: n.id,
            expectedSavingsCents: n.expectedSavingsCents ?? 0,
          }),
        });
        await prisma.negotiation.update({
          where: { id: n.id },
          data: { followUpAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        });
        sent += 1;
      } catch (e) {
        console.error(`follow-up failed for ${n.id}`, e);
        Sentry.captureException(e as Error, {
          tags: { route: "cron/follow-up", stage: "send" },
          extra: { negotiationId: n.id },
        });
        failed += 1;
      }
    }
    return NextResponse.json({ ok: true, sent, failed, considered });
  } finally {
    await releaseCronLock({ id: lockId, itemsProcessed: sent, ok: failed === 0 });
  }
}

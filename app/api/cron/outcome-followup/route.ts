import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { followUpBrandedHtml, followUpBrandedSubject } from "@/lib/email_templates";
import { signOutcomeToken } from "@/lib/outcome_token";
import { acquireCronLock, releaseCronLock } from "@/lib/cron-lock";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron — 08:00 UTC. Bills out an outcome question 7 days after the
 * negotiation email was sent. Resend free tier caps us at 100/day; we send
 * max 50 to leave headroom for other transactional mail.
 */
const DAILY_CAP = 50;
const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev mode
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lockId = await acquireCronLock("outcome-followup");
  if (!lockId) return NextResponse.json({ ok: true, skipped: "already-running" });

  try {
    return await runOutcomeFollowup(lockId);
  } catch (e) {
    await releaseCronLock({ id: lockId, itemsProcessed: 0, ok: false });
    throw e;
  }
}

async function runOutcomeFollowup(lockId: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const due = await prisma.negotiation.findMany({
    where: {
      emailSentAt: { lte: sevenDaysAgo },
      outcomeAskedAt: null,
      state: { in: ["EMAIL_GEN", "EMAIL_SENT", "AWAITING", "COUNTER_SENT", "RESPONSE_RECEIVED"] },
      closedAt: null,
    },
    include: { user: true, bill: true },
    orderBy: { emailSentAt: "asc" },
    take: DAILY_CAP,
  });

  let sent = 0;
  let failed = 0;

  for (const n of due) {
    try {
      const token = signOutcomeToken(n.bill.id, now.getTime());
      const link = `${APP_URL}/onderhandel/${n.bill.id}/uitkomst?token=${encodeURIComponent(token)}`;
      const html = followUpBrandedHtml({
        customerName: n.user.name ?? n.user.email,
        provider: n.bill.provider,
        negotiationId: link, // template uses this as link base; full URL passes through
        expectedSavingsCents: n.expectedSavingsCents ?? 0,
      });
      await sendEmail({
        to: n.user.email,
        subject: followUpBrandedSubject(n.bill.provider),
        html,
      });
      await prisma.negotiation.update({
        where: { id: n.id },
        data: { outcomeAskedAt: now },
      });
      sent += 1;
    } catch (e) {
      console.error(`outcome-followup failed for ${n.id}`, e);
      failed += 1;
      Sentry.captureException(e, {
        tags: { module: "cron/outcome-followup", negotiationId: n.id },
      });
    }
  }

  await releaseCronLock({ id: lockId, itemsProcessed: sent, ok: failed === 0 });
  return NextResponse.json({
    ok: true,
    sent,
    failed,
    considered: due.length,
    cap: DAILY_CAP,
  });
}

/**
 * GET /api/cron/recheck-savings — daily 09:30 UTC.
 *
 * Selects negotiations 28-35 days old that don't have a verified
 * proof yet, and sends the user a one-shot reminder to upload the
 * new bill so we can compute the actual savings (DEEL 3).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { acquireCronLock, releaseCronLock } from "@/lib/cron-lock";
import * as Sentry from "@sentry/nextjs";
import { isDueForRecheck } from "@/lib/recheck-savings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lockId = await acquireCronLock("recheck-savings");
  if (!lockId) {
    return NextResponse.json({ ok: true, skipped: "already-running" });
  }

  let sent = 0;
  let failed = 0;
  let considered = 0;
  let ok = true;
  try {
    const now = new Date();
    const lower = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
    const upper = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    const candidates = await prisma.negotiation.findMany({
      where: {
        state: { in: ["EMAIL_SENT", "COUNTER_SENT", "SUCCESS_UNVERIFIED"] },
        proofVerifiedAt: null,
        OR: [
          { emailSentAt: { gte: lower, lte: upper } },
          {
            AND: [
              { emailSentAt: null },
              { closedAt: { gte: lower, lte: upper } },
            ],
          },
        ],
      },
      include: { user: true, bill: true },
      take: 100,
    });

    for (const neg of candidates) {
      considered++;
      if (!isDueForRecheck(neg, now)) continue;
      if (!neg.user.email) continue;
      try {
        const link = `${APP_URL}/onderhandel/${neg.billId}/uitkomst`;
        await sendEmail({
          to: neg.user.email,
          subject: `Ontvang je nu al je nieuwe ${neg.bill.provider}-factuur?`,
          text: `Hé,

We zien dat we ongeveer een maand geleden namens jou onderhandeld hebben met ${neg.bill.provider}.
Ontvang je nu al je nieuwe factuur? Forward 'm naar bewijs@degeldheld.com of upload 'm via:
${link}

Zodra we de nieuwe maandkosten zien, kunnen we bevestigen hoeveel je écht hebt bespaard.

— DeGeldHeld`,
          html: `<p>Hé,</p>
<p>We zien dat we ongeveer een maand geleden namens jou onderhandeld hebben met <strong>${neg.bill.provider}</strong>.
Ontvang je nu al je nieuwe factuur? Forward 'm naar <strong>bewijs@degeldheld.com</strong> of upload via
<a href="${link}">${link}</a>.</p>
<p>Zodra we de nieuwe maandkosten zien, bevestigen we hoeveel je écht hebt bespaard.</p>
<p>— DeGeldHeld</p>`,
        });
        sent++;
      } catch (e) {
        failed++;
        ok = false;
        Sentry.captureException(e, { tags: { module: "cron/recheck-savings", negotiationId: neg.id } });
      }
    }
  } finally {
    await releaseCronLock({ id: lockId, itemsProcessed: sent, ok });
  }
  return NextResponse.json({ ok: true, considered, sent, failed });
}

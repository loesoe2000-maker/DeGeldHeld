/**
 * GET /api/cron/contract-radar — v21 #2, daily.
 *
 * Finds bills whose contract ends in ~30-45 days and nudges the user to
 * re-negotiate before the provider silently bumps the price on renewal.
 * Idempotent via Bill.contractAlertSentAt; opt-out enforced by the gate.
 */
import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, logCronEvent } from "@/lib/cron-auth";
import { acquireCronLock, releaseCronLock } from "@/lib/cron-lock";
import { prisma } from "@/lib/db";
import { sendRetentionEmail } from "@/lib/notify";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://www.degeldheld.com";
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 200;

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lockId = await acquireCronLock("contract-radar");
  if (!lockId) return NextResponse.json({ ok: true, skipped: "already-running" });

  logCronEvent("contract-radar", "start");
  let alerted = 0;
  let skipped = 0;
  let ok = true;
  try {
    const now = Date.now();
    const windowStart = new Date(now + 30 * DAY_MS);
    const windowEnd = new Date(now + 45 * DAY_MS);

    const bills = await prisma.bill.findMany({
      where: {
        deletedAt: null,
        contractAlertSentAt: null,
        contractEndDate: { gte: windowStart, lte: windowEnd },
        user: { is: { marketingOptOut: false, deletedAt: null } },
      },
      select: {
        id: true,
        provider: true,
        contractEndDate: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            marketingOptOut: true,
            unsubscribeToken: true,
          },
        },
      },
      take: BATCH_LIMIT,
    });

    for (const bill of bills) {
      if (!bill.user || !bill.contractEndDate) {
        skipped++;
        continue;
      }
      const weeks = Math.max(1, Math.round((bill.contractEndDate.getTime() - now) / (7 * DAY_MS)));
      const firstName = (bill.user.name ?? "").trim().split(" ")[0] || "daar";
      const link = `${APP_URL}/onderhandel/email?bill=${bill.id}&fromContract=1`;

      const res = await sendRetentionEmail({
        user: bill.user,
        subject: `Je ${bill.provider}-contract loopt bijna af`,
        text: `Hoi ${firstName},

Je ${bill.provider}-contract loopt over ~${weeks} weken af. Providers
verhogen het tarief vaak automatisch bij verlenging — dít is hét moment
om opnieuw te onderhandelen.

Start de her-onderhandeling:
${link}

— DeGeldHeld`,
        html: `<p>Hoi ${firstName},</p>
<p>Je <strong>${bill.provider}</strong>-contract loopt over <strong>~${weeks} weken</strong> af.
Providers verhogen het tarief vaak automatisch bij verlenging — dít is hét moment om opnieuw te onderhandelen.</p>
<p><a href="${link}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Onderhandel opnieuw</a></p>`,
      });

      if (res.sent) {
        await prisma.bill.update({ where: { id: bill.id }, data: { contractAlertSentAt: new Date() } });
        alerted++;
      } else {
        skipped++;
      }
    }
  } catch (e) {
    ok = false;
    Sentry.captureException(e, { tags: { module: "cron/contract-radar" } });
  } finally {
    await releaseCronLock({ id: lockId, itemsProcessed: alerted, ok });
    logCronEvent("contract-radar", ok ? "done" : "failed", { alerted, skipped });
  }
  return NextResponse.json({ ok, alerted, skipped });
}

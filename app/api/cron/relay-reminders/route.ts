/**
 * GET /api/cron/relay-reminders — v23 DEEL 4d approval-timeout reminder.
 *
 * For negotiations stuck in relayState = AWAITING_APPROVAL with no customer
 * decision for a while, send a REMINDER. We NEVER auto-accept — the deal
 * sits in AWAITING_APPROVAL (it expires rather than getting accepted without
 * consent). Sending a reminder bumps updatedAt so it won't re-fire daily.
 */
import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, logCronEvent } from "@/lib/cron-auth";
import { acquireCronLock, releaseCronLock } from "@/lib/cron-lock";
import { prisma } from "@/lib/db";
import { sendEmail, escapeHtml } from "@/lib/email";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://www.degeldheld.com";
const REMIND_AFTER_DAYS = 3;
const BATCH_LIMIT = 200;

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lockId = await acquireCronLock("relay-reminders");
  if (!lockId) return NextResponse.json({ ok: true, skipped: "already-running" });

  logCronEvent("relay-reminders", "start");
  let reminded = 0;
  let ok = true;
  try {
    const cutoff = new Date(Date.now() - REMIND_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const stuck = await prisma.negotiation.findMany({
      where: { relayState: "AWAITING_APPROVAL", updatedAt: { lt: cutoff } },
      select: { id: true, billId: true, bill: { select: { provider: true } }, user: { select: { email: true } } },
      take: BATCH_LIMIT,
    });

    for (const neg of stuck) {
      if (!neg.user?.email) continue;
      const link = `${APP_URL}/onderhandel/${neg.billId}/relay`;
      try {
        await sendEmail({
          to: neg.user.email,
          subject: `Herinnering: je goedkeuring nodig voor ${neg.bill.provider}`,
          text: `Je onderhandeling met ${neg.bill.provider} wacht op jouw beslissing — accepteren, doorgaan of stoppen. We accepteren NOOIT automatisch; zonder jouw keuze gebeurt er niets.\n\n${link}\n\n— DeGeldHeld`,
          html: `<p>Je onderhandeling met <strong>${escapeHtml(neg.bill.provider)}</strong> wacht op jouw beslissing — accepteren, doorgaan of stoppen. We accepteren <strong>nooit</strong> automatisch; zonder jouw keuze gebeurt er niets.</p>
<p><a href="${link}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Bekijk &amp; beslis</a></p>
<p>— DeGeldHeld</p>`,
        });
        // Touch updatedAt so we don't remind again before the next window.
        await prisma.negotiation.update({ where: { id: neg.id }, data: { updatedAt: new Date() } });
        reminded++;
      } catch (e) {
        Sentry.captureException(e, { tags: { module: "cron/relay-reminders", negotiationId: neg.id } });
      }
    }
  } catch (e) {
    ok = false;
    Sentry.captureException(e, { tags: { module: "cron/relay-reminders" } });
  } finally {
    await releaseCronLock({ id: lockId, itemsProcessed: reminded, ok });
    logCronEvent("relay-reminders", ok ? "done" : "failed", { reminded });
  }
  return NextResponse.json({ ok, reminded });
}

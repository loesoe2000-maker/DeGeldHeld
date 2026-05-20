/**
 * GET /api/cron/category-nudge — v21 #1, weekly (Tue 10:00).
 *
 * After a user has won at least one negotiation, nudge them toward a
 * category they haven't uploaded yet (households that save on one fixed
 * cost usually have room on another). Throttled to one nudge / 14 days /
 * user via lastNudgeAt + the send-gate, opt-out respected by the gate.
 */
import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, logCronEvent } from "@/lib/cron-auth";
import { acquireCronLock, releaseCronLock } from "@/lib/cron-lock";
import { prisma } from "@/lib/db";
import { computeSavingsStats } from "@/lib/savings";
import { pickNudgeCategory, categoryLabel } from "@/lib/category-gap";
import { sendRetentionEmail } from "@/lib/notify";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://www.degeldheld.com";
const NUDGE_THROTTLE_HOURS = 14 * 24; // 14 days
const BATCH_LIMIT = 200;

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lockId = await acquireCronLock("category-nudge");
  if (!lockId) return NextResponse.json({ ok: true, skipped: "already-running" });

  logCronEvent("category-nudge", "start");
  let nudged = 0;
  let skipped = 0;
  let ok = true;
  try {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        marketingOptOut: false,
        negotiations: { some: { state: { in: ["SUCCESS", "BILLED"] } } },
      },
      select: {
        id: true,
        email: true,
        name: true,
        marketingOptOut: true,
        unsubscribeToken: true,
        lastNudgeAt: true,
        bills: { where: { deletedAt: null }, select: { category: true } },
        negotiations: { select: { state: true, actualSavingsCents: true } },
      },
      take: BATCH_LIMIT,
    });

    for (const u of users) {
      const gap = pickNudgeCategory(u.bills.map((b) => b.category));
      if (!gap) {
        skipped++;
        continue;
      }
      const stats = computeSavingsStats(u.negotiations);
      const savedEur = Math.round(stats.totalSavedCents / 100);
      const label = categoryLabel(gap);
      const firstName = (u.name ?? "").trim().split(" ")[0] || "daar";

      const res = await sendRetentionEmail({
        user: u,
        subject: `Bespaar ook op je ${label.toLowerCase()}?`,
        throttle: { lastAt: u.lastNudgeAt, minHours: NUDGE_THROTTLE_HOURS },
        text: `Hoi ${firstName},

Top dat je via DeGeldHeld al €${savedEur} hebt bespaard! 🎉

Huishoudens die op één vaste last besparen, hebben vaak óók ruimte op
hun ${label.toLowerCase()}. Upload die rekening — we checken gratis of we
ook daar kunnen onderhandelen:

${APP_URL}/onderhandel

— DeGeldHeld`,
        html: `<p>Hoi ${firstName},</p>
<p>Top dat je via DeGeldHeld al <strong>€${savedEur}</strong> hebt bespaard! 🎉</p>
<p>Huishoudens die op één vaste last besparen, hebben vaak óók ruimte op hun
<strong>${label}</strong>. Upload die rekening — we checken gratis of we ook
daar kunnen onderhandelen.</p>
<p><a href="${APP_URL}/onderhandel" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Check mijn ${label.toLowerCase()}</a></p>`,
      });

      if (res.sent) {
        await prisma.user.update({ where: { id: u.id }, data: { lastNudgeAt: new Date() } });
        nudged++;
      } else {
        skipped++;
      }
    }
  } catch (e) {
    ok = false;
    Sentry.captureException(e, { tags: { module: "cron/category-nudge" } });
  } finally {
    await releaseCronLock({ id: lockId, itemsProcessed: nudged, ok });
    logCronEvent("category-nudge", ok ? "done" : "failed", { nudged, skipped });
  }
  return NextResponse.json({ ok, nudged, skipped });
}

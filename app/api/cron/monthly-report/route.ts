/**
 * GET /api/cron/monthly-report — v21 #3, 1st of the month 09:00.
 *
 * A short personal digest: total saved, open negotiations, bills due for a
 * re-check, and one concrete next-best-action. One per user per calendar
 * month (lastMonthlyReportAt), opt-out enforced by the gate, inactive users
 * (no bills) skipped.
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
const BATCH_LIMIT = 500;

/** True when two dates fall in the same calendar month (UTC). */
export function sameMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lockId = await acquireCronLock("monthly-report");
  if (!lockId) return NextResponse.json({ ok: true, skipped: "already-running" });

  logCronEvent("monthly-report", "start");
  const now = new Date();
  let sent = 0;
  let skipped = 0;
  let ok = true;
  try {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        marketingOptOut: false,
        bills: { some: { deletedAt: null } },
      },
      select: {
        id: true,
        email: true,
        name: true,
        marketingOptOut: true,
        unsubscribeToken: true,
        lastMonthlyReportAt: true,
        bills: { where: { deletedAt: null }, select: { category: true, nextRecheckAt: true } },
        negotiations: { select: { state: true, actualSavingsCents: true } },
      },
      take: BATCH_LIMIT,
    });

    for (const u of users) {
      // Idempotent: at most one report per calendar month.
      if (u.lastMonthlyReportAt && sameMonth(u.lastMonthlyReportAt, now)) {
        skipped++;
        continue;
      }
      const stats = computeSavingsStats(u.negotiations);
      const savedEur = Math.round(stats.totalSavedCents / 100);
      const recheckable = u.bills.filter((b) => b.nextRecheckAt && b.nextRecheckAt <= now).length;
      const open = stats.pendingCount;

      // One concrete CTA — the biggest opportunity.
      let cta: string;
      let ctaUrl = `${APP_URL}/dashboard`;
      if (open > 0) {
        cta = `Je hebt ${open} lopende onderhandeling${open > 1 ? "en" : ""} — rond 'm af.`;
      } else if (recheckable > 0) {
        cta = `${recheckable} rekening${recheckable > 1 ? "en kunnen" : " kan"} opnieuw gecheckt worden op een lagere prijs.`;
      } else {
        const gap = pickNudgeCategory(u.bills.map((b) => b.category));
        if (gap) {
          cta = `Upload je ${categoryLabel(gap).toLowerCase()} — grote kans dat we ook daar besparen.`;
          ctaUrl = `${APP_URL}/onderhandel`;
        } else {
          cta = `Alles staat goed afgesteld. We seinen je zodra er een nieuwe besparing in zit.`;
        }
      }

      const firstName = (u.name ?? "").trim().split(" ")[0] || "daar";
      const res = await sendRetentionEmail({
        user: u,
        subject: `Je DeGeldHeld-maandoverzicht`,
        text: `Hoi ${firstName},

Je maandoverzicht:
• Totaal bespaard: €${savedEur}
• Lopende onderhandelingen: ${open}
• Rekeningen klaar voor een her-check: ${recheckable}

${cta}
${ctaUrl}

— DeGeldHeld`,
        html: `<p>Hoi ${firstName},</p>
<p><strong>Je maandoverzicht:</strong></p>
<ul>
<li>Totaal bespaard: <strong>€${savedEur}</strong></li>
<li>Lopende onderhandelingen: <strong>${open}</strong></li>
<li>Rekeningen klaar voor een her-check: <strong>${recheckable}</strong></li>
</ul>
<p>${cta}</p>
<p><a href="${ctaUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Bekijk mijn dashboard</a></p>`,
      });

      if (res.sent) {
        await prisma.user.update({ where: { id: u.id }, data: { lastMonthlyReportAt: new Date() } });
        sent++;
      } else {
        skipped++;
      }
    }
  } catch (e) {
    ok = false;
    Sentry.captureException(e, { tags: { module: "cron/monthly-report" } });
  } finally {
    await releaseCronLock({ id: lockId, itemsProcessed: sent, ok });
    logCronEvent("monthly-report", ok ? "done" : "failed", { sent, skipped });
  }
  return NextResponse.json({ ok, sent, skipped });
}

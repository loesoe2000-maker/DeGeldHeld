import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildComparison } from "@/lib/comparison";
import { acquireCronLock, releaseCronLock } from "@/lib/cron-lock";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

const RECHECK_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;     // 30d
const REENGAGE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;      // active = login < 90d
const MAIL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;         // max 1 mail / 7d / user
const SIGNIFICANT_DELTA_CENTS = 60 * 100;                 // €60/yr min trigger
const BATCH_LIMIT = 100;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lockId = await acquireCronLock("monthly-recheck");
  if (!lockId) return NextResponse.json({ ok: true, skipped: "already-running" });

  try {
    return await runMonthlyRecheck(lockId);
  } catch (e) {
    await releaseCronLock({ id: lockId, itemsProcessed: 0, ok: false });
    Sentry.captureException(e, { tags: { module: "cron/monthly-recheck" } });
    throw e;
  }
}

async function runMonthlyRecheck(lockId: string) {
  const now = new Date();
  const activeCutoff = new Date(now.getTime() - REENGAGE_WINDOW_MS);

  const due = await prisma.bill.findMany({
    where: {
      nextRecheckAt: { lte: now },
      user: {
        OR: [
          { sessions: { some: { expires: { gte: activeCutoff } } } },
          { updatedAt: { gte: activeCutoff } },
        ],
      },
    },
    include: { user: true, negotiation: true },
    take: BATCH_LIMIT,
  });

  let mailed = 0;
  let skippedNoDelta = 0;
  let skippedCooldown = 0;
  let updated = 0;

  for (const bill of due) {
    const comparison = buildComparison({
      provider: bill.provider,
      category: bill.category,
      amountCents: bill.monthlyCents ?? bill.amountCents,
      country: (bill.country as import("@/lib/providers").Country | null) ?? "NL",
    });
    const newSavings = comparison.bestSavingsCents ?? 0;
    const prevSavings = bill.negotiation?.expectedSavingsCents ?? 0;
    const delta = newSavings - prevSavings;

    // Mail-cooldown guard — per user, not per bill, so a multi-bill user
    // only gets one re-check mail per 7 days.
    const recentMail = await prisma.bill.findFirst({
      where: {
        userId: bill.userId,
        lastRecheckMailAt: { gte: new Date(now.getTime() - MAIL_COOLDOWN_MS) },
      },
      select: { id: true },
    });

    if (delta >= SIGNIFICANT_DELTA_CENTS) {
      if (recentMail) {
        skippedCooldown++;
      } else if (!bill.user) {
        // v15: anonymous bills have no user.email — skip the recheck-
        // mail until they're claimed. The cron still tracked the
        // newSavings on the bill itself.
        skippedNoDelta++;
      } else {
        try {
          await sendEmail({
            to: bill.user.email,
            subject: `Update: nieuwe markt-check op je ${bill.provider}-rekening`,
            text: `Hoi,

We deden net een nieuwe markt-check op je ${bill.provider}-rekening en zien meer ruimte:
nu €${Math.round(newSavings / 100)}/jaar besparing mogelijk (was €${Math.round(prevSavings / 100)}/jaar).

Bekijk + genereer een nieuwe onderhandel-mail:
${APP_URL}/onderhandel/email?bill=${bill.id}&fromRecheck=1

— DeGeldHeld`,
            html: `<p>Hoi,</p>
<p>We deden net een nieuwe markt-check op je <strong>${bill.provider}</strong>-rekening en zien meer ruimte:
nu <strong>€${Math.round(newSavings / 100)}/jaar</strong> besparing mogelijk (was €${Math.round(prevSavings / 100)}/jaar).</p>
<p><a href="${APP_URL}/onderhandel/email?bill=${bill.id}&amp;fromRecheck=1">Genereer nieuwe onderhandel-mail →</a></p>
<p>— DeGeldHeld</p>`,
          });
          mailed++;
          await prisma.bill.update({
            where: { id: bill.id },
            data: { lastRecheckMailAt: now },
          });
        } catch {
          // never block on outbound mail
        }
      }
    } else {
      skippedNoDelta++;
    }

    await prisma.bill.update({
      where: { id: bill.id },
      data: {
        lastRecheckAt: now,
        nextRecheckAt: new Date(now.getTime() + RECHECK_INTERVAL_MS),
      },
    });
    updated++;
  }

  await releaseCronLock({ id: lockId, itemsProcessed: mailed, ok: true });
  return NextResponse.json({ ok: true, due: due.length, mailed, skippedNoDelta, skippedCooldown, updated });
}

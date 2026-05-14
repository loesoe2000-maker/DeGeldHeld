import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { followUpHtml, followUpSubject } from "@/lib/follow_up_email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron (Vercel Cron). Configured via vercel.json:
 *   schedule: "0 9 * * *"  (09:00 UTC daily)
 *
 * Authorize via Authorization: Bearer ${CRON_SECRET}.
 */

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.negotiation.findMany({
    where: {
      state: "AWAITING",
      followUpAt: { lte: now },
      closedAt: null,
    },
    include: { user: true, bill: true },
    take: 50, // daily batch cap
  });

  let sent = 0;
  let failed = 0;
  const appUrl = process.env.APP_URL ?? "https://degeldheld.com";

  for (const n of due) {
    try {
      await sendEmail({
        to: n.user.email,
        subject: followUpSubject(n.bill.provider),
        html: followUpHtml({
          customerName: n.user.name ?? n.user.email,
          provider: n.bill.provider,
          expectedSavingsCents: n.expectedSavingsCents ?? 0,
          negotiationId: n.id,
          appUrl,
        }),
      });
      // Push next follow-up 7d into the future (max 2 tries handled at flow layer)
      await prisma.negotiation.update({
        where: { id: n.id },
        data: { followUpAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      });
      sent += 1;
    } catch (e) {
      console.error(`follow-up failed for ${n.id}`, e);
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, sent, failed, considered: due.length });
}

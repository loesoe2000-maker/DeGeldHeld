import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/account/export — GDPR Article 20 data portability.
 *
 * Returns a JSON dump of everything we hold about the requesting user.
 * Strips imageHash + rawOcr (those are derived/internal and contain no
 * additional personal data the user couldn't already see).
 *
 * Rate-limit: 3 calls per 24h per user (v14 DEEL 8). GDPR Art. 12
 * allows providers to refuse repeated requests when they're manifestly
 * unfounded or excessive — 3 / 24h is a generous cap.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const rl = rateLimit({ key: `export:${userId}`, max: 3, windowSec: 24 * 3600 });
  if (!rl.ok) return rateLimitResponse(rl);

  const [user, bills, negotiations, payments, waitlist, referralsOwned, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        notificationsEnabled: true,
        ocrTrainingOptIn: true,
        referralCode: true,
      },
    }),
    prisma.bill.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        category: true,
        amountCents: true,
        monthlyCents: true,
        totalCents: true,
        plan: true,
        period: true,
        invoiceDate: true,
        customerNumber: true,
        country: true,
        currency: true,
        createdAt: true,
        deletedAt: true,
      },
    }),
    prisma.negotiation.findMany({
      where: { userId },
      include: {
        rounds: {
          select: {
            id: true,
            roundNumber: true,
            outcome: true,
            offeredCents: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.payment.findMany({ where: { userId } }),
    prisma.waitlistEntry.findMany({ where: { userId } }),
    prisma.referral.findMany({ where: { ownerId: userId } }),
    prisma.session.findMany({ where: { userId }, select: { id: true, expires: true } }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    user,
    bills,
    negotiations: negotiations.map((n) => ({
      id: n.id,
      billId: n.billId,
      state: n.state,
      strategy: n.strategy,
      expectedSavingsCents: n.expectedSavingsCents,
      actualSavingsCents: n.actualSavingsCents,
      confidence: n.confidence,
      reasoning: n.reasoning,
      userRating: n.userRating,
      mailUsed: n.mailUsed,
      providerResponded: n.providerResponded,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      rounds: n.rounds,
    })),
    payments,
    waitlist,
    referrals: referralsOwned,
    sessions,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="dgh-export-${userId.slice(0, 8)}.json"`,
    },
  });
}

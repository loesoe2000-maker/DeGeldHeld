import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, anonymized track record. Powers /api/proof + landing page claims.
 * Cache 5 min via Cache-Control to reduce DB load.
 */

export async function GET() {
  const successful = await prisma.negotiation.findMany({
    where: { state: { in: ["SUCCESS", "BILLED"] } },
    select: { actualSavingsCents: true, bill: { select: { category: true } }, createdAt: true },
    take: 1000,
    orderBy: { createdAt: "desc" },
  });

  const failed = await prisma.negotiation.count({
    where: { state: "FAILED" },
  });

  const totalSavedCents = successful.reduce((acc, n) => acc + (n.actualSavingsCents ?? 0), 0);
  const totalAttempts = successful.length + failed;
  const successRate = totalAttempts > 0 ? successful.length / totalAttempts : 0;
  const avgSavingsCents =
    successful.length > 0 ? Math.round(totalSavedCents / successful.length) : 0;

  const byCategory: Record<string, { count: number; totalCents: number }> = {};
  for (const n of successful) {
    const cat = n.bill.category;
    byCategory[cat] = byCategory[cat] ?? { count: 0, totalCents: 0 };
    byCategory[cat].count += 1;
    byCategory[cat].totalCents += n.actualSavingsCents ?? 0;
  }

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      stats: {
        total_negotiations: totalAttempts,
        total_successful: successful.length,
        total_failed: failed,
        success_rate: Number(successRate.toFixed(3)),
        total_saved_eur: totalSavedCents / 100,
        average_saved_eur: avgSavingsCents / 100,
        by_category: byCategory,
      },
    },
    { headers: { "cache-control": "public, max-age=300, s-maxage=300" } },
  );
}

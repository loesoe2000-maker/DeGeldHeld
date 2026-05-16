import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public anonymized track record.
 *
 * v5 query params:
 *  - period:  "7d" | "30d" | "365d" | "all"  (default "all")
 *  - basis:   "actual" | "expected"          (default "actual")
 *      actual   = use actualSavingsCents (only filled after outcome capture)
 *      expected = use expectedSavingsCents (LLM estimate at email-gen time)
 *  - country: optional country filter (e.g. "NL")
 *  - category: optional category filter (e.g. "TELECOM")
 */

const PERIODS = ["7d", "30d", "365d", "all"] as const;
type Period = (typeof PERIODS)[number];
const BASES = ["actual", "expected"] as const;
type Basis = (typeof BASES)[number];

function parsePeriod(raw: string | null): Period {
  if (raw && (PERIODS as readonly string[]).includes(raw)) return raw as Period;
  return "all";
}
function parseBasis(raw: string | null): Basis {
  if (raw && (BASES as readonly string[]).includes(raw)) return raw as Basis;
  return "actual";
}
function cutoffFor(period: Period): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 365;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const period = parsePeriod(params.get("period"));
  const basis = parseBasis(params.get("basis"));
  const country = params.get("country");
  const category = params.get("category");

  const cutoff = cutoffFor(period);
  const successWhere: Record<string, unknown> = {
    state: { in: ["SUCCESS", "BILLED", "ACCEPTED"] },
  };
  if (cutoff) successWhere.createdAt = { gte: cutoff };
  const billWhere: Record<string, unknown> = {};
  if (country) billWhere.country = country;
  if (category) billWhere.category = category;
  if (Object.keys(billWhere).length > 0) successWhere.bill = billWhere;

  const failedWhere: Record<string, unknown> = {
    state: { in: ["FAILED", "REJECTED"] },
  };
  if (cutoff) failedWhere.createdAt = { gte: cutoff };
  if (Object.keys(billWhere).length > 0) failedWhere.bill = billWhere;

  const successful = await prisma.negotiation.findMany({
    where: successWhere,
    select: {
      actualSavingsCents: true,
      expectedSavingsCents: true,
      bill: { select: { category: true } },
      createdAt: true,
    },
    take: 1000,
    orderBy: { createdAt: "desc" },
  });

  const failed = await prisma.negotiation.count({ where: failedWhere });

  function valueFor(n: { actualSavingsCents: number | null; expectedSavingsCents: number | null }): number {
    if (basis === "actual") return n.actualSavingsCents ?? 0;
    return n.expectedSavingsCents ?? 0;
  }

  const totalSavedCents = successful.reduce((acc, n) => acc + valueFor(n), 0);
  const totalAttempts = successful.length + failed;
  const successRate = totalAttempts > 0 ? successful.length / totalAttempts : 0;
  const avgSavingsCents =
    successful.length > 0 ? Math.round(totalSavedCents / successful.length) : 0;

  const byCategory: Record<string, { count: number; totalCents: number }> = {};
  for (const n of successful) {
    const cat = n.bill.category;
    byCategory[cat] = byCategory[cat] ?? { count: 0, totalCents: 0 };
    byCategory[cat].count += 1;
    byCategory[cat].totalCents += valueFor(n);
  }

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      period,
      basis,
      filters: { country, category },
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

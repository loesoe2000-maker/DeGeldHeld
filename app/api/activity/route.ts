/**
 * GET /api/activity — v15 DEEL 4 public live activity feed.
 *
 * Returns the 10 most recent verified-success negotiations from the
 * last 7 days, fully anonymised (no user identifier). Cached for 30s
 * at the edge via stale-while-revalidate.
 *
 * Response shape:
 *   { items: [{ provider, savingsCents, country, ageSeconds }] }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 7;
const ITEM_LIMIT = 10;

export async function GET() {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.negotiation.findMany({
    where: {
      state: { in: ["SUCCESS", "BILLED", "ACCEPTED"] },
      createdAt: { gte: cutoff },
      actualSavingsCents: { not: null, gt: 0 },
    },
    orderBy: { createdAt: "desc" },
    take: ITEM_LIMIT,
    select: {
      createdAt: true,
      actualSavingsCents: true,
      bill: { select: { provider: true, country: true } },
    },
  });

  const now = Date.now();
  const items = rows.map((r) => ({
    provider: r.bill.provider,
    savingsCents: r.actualSavingsCents ?? 0,
    country: r.bill.country ?? "NL",
    ageSeconds: Math.max(0, Math.round((now - r.createdAt.getTime()) / 1000)),
  }));

  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}

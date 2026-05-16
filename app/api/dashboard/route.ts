import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOpenState, isClosedState } from "@/lib/savings";
import { allCategories } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 1000;

type Bucket = {
  data: ReturnType<typeof buildPayload>;
  expiresAt: number;
};
const cache = new Map<string, Bucket>();

function buildPayload(negotiations: Array<{
  id: string;
  state: string;
  expectedSavingsCents: number | null;
  actualSavingsCents: number | null;
  emailSentAt: Date | null;
  createdAt: Date;
  bill: { provider: string; category: string; amountCents: number };
}>) {
  let totalSavedCents = 0;
  let open = 0;
  let completed = 0;
  let failed = 0;
  const active: Array<{
    id: string;
    provider: string;
    category: string;
    state: string;
    amountCents: number;
    daysSinceSent: number | null;
    actionUrl: string;
  }> = [];

  for (const n of negotiations) {
    if (isClosedState(n.state as never)) {
      if (n.state === "SUCCESS" || n.state === "BILLED" || n.state === "ACCEPTED") {
        completed += 1;
        totalSavedCents += n.actualSavingsCents ?? 0;
      } else {
        failed += 1;
      }
    } else if (isOpenState(n.state as never)) {
      open += 1;
      const days =
        n.emailSentAt != null
          ? Math.max(0, Math.floor((Date.now() - n.emailSentAt.getTime()) / (24 * 60 * 60 * 1000)))
          : null;
      active.push({
        id: n.id,
        provider: n.bill.provider,
        category: n.bill.category,
        state: n.state,
        amountCents: n.bill.amountCents,
        daysSinceSent: days,
        actionUrl: `/onderhandel/${n.id}`,
      });
    }
  }

  return {
    summary: {
      totalSavedCents,
      open,
      completed,
      failed,
      total: negotiations.length,
    },
    active,
    categories: allCategories(),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const key = `dash:${userId}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { "x-cache": "HIT", "cache-control": "private, max-age=60" },
    });
  }

  const negotiations = await prisma.negotiation.findMany({
    where: { userId },
    select: {
      id: true,
      state: true,
      expectedSavingsCents: true,
      actualSavingsCents: true,
      emailSentAt: true,
      createdAt: true,
      bill: { select: { provider: true, category: true, amountCents: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const payload = buildPayload(negotiations);
  cache.set(key, { data: payload, expiresAt: Date.now() + CACHE_TTL_MS });

  return NextResponse.json(payload, {
    headers: { "x-cache": "MISS", "cache-control": "private, max-age=60" },
  });
}

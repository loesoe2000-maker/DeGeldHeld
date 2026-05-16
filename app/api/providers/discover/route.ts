import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { discoverProvider } from "@/lib/provider_discovery";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2).max(120),
  country: z.string().min(2).max(3).toUpperCase(),
});

/**
 * Per-user rate limit: 5 discoveries / hour to avoid WebFetch abuse + Groq cost.
 * Stored in-memory; production would use Redis.
 */
const userBuckets = new Map<string, number[]>();
const PER_HOUR = 5;

function checkRate(userId: string): boolean {
  const now = Date.now();
  const events = (userBuckets.get(userId) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (events.length >= PER_HOUR) return false;
  events.push(now);
  userBuckets.set(userId, events);
  return true;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  if (!checkRate(userId)) {
    return NextResponse.json({ error: "Te veel verzoeken — probeer over een uur opnieuw" }, { status: 429 });
  }

  const { name, country } = parsed.data;

  // Re-use existing candidate if same name+country already pending
  const existing = await prisma.providerCandidate.findUnique({
    where: { name_country: { name, country } },
  });
  if (existing && existing.status === "PENDING") {
    return NextResponse.json({
      ok: true,
      candidateId: existing.id,
      status: existing.status,
      retention: JSON.parse(existing.retentionJson) as Record<string, unknown>,
    });
  }

  const result = await discoverProvider({ name, country });
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 200 });
  }

  const upserted = await prisma.providerCandidate.upsert({
    where: { name_country: { name, country } },
    create: {
      name,
      country,
      retentionJson: JSON.stringify(result.retention),
      status: "PENDING",
      source: `user:${userId}`,
    },
    update: {
      retentionJson: JSON.stringify(result.retention),
      status: "PENDING",
    },
  });

  return NextResponse.json({
    ok: true,
    candidateId: upserted.id,
    status: upserted.status,
    retention: result.retention,
    sources: result.sources,
  });
}

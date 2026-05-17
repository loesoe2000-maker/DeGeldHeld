import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { discoverProvider } from "@/lib/provider_discovery";
import { z } from "zod";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2).max(120),
  country: z.string().min(2).max(3).toUpperCase(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  // 5 per day per user — WebFetch + Groq cost adds up quickly
  const rl = rateLimit({ key: `discover:${userId}`, max: 5, windowSec: 24 * 3600 });
  if (!rl.ok) return rateLimitResponse(rl);

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

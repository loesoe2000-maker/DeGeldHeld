/**
 * POST /api/negotiations/[id]/relay-pause — always-available stop/resume.
 *
 * GUARDRAIL (revocable, art. 3:72 BW): the customer can pause the relay at any
 * moment — paused → no automatic mails go out (canRelaySend returns false).
 * Resume puts it back to RELAY_ACTIVE. Owner-only.
 *
 * Body: { action: "pause" | "resume" }
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // GUARDRAIL 7 — relay gated behind the flag.
  if (!isEnabled("RELAY_ENABLED")) {
    return NextResponse.json({ error: "Not found", reason: "disabled" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await ctx.params;

  let action: "pause" | "resume" | null = null;
  try {
    const body = (await req.json()) as { action?: unknown };
    if (body.action === "pause" || body.action === "resume") action = body.action;
  } catch {
    /* invalid */
  }
  if (!action) return NextResponse.json({ error: "invalid action" }, { status: 400 });

  const neg = await prisma.negotiation.findFirst({
    where: { id, userId },
    select: { id: true, relayAuthorizedAt: true },
  });
  if (!neg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!neg.relayAuthorizedAt) {
    return NextResponse.json({ error: "no relay authorized" }, { status: 409 });
  }

  const relayState = action === "pause" ? "PAUSED" : "RELAY_ACTIVE";
  await prisma.negotiation.update({ where: { id: neg.id }, data: { relayState } });
  return NextResponse.json({ ok: true, relayState });
}

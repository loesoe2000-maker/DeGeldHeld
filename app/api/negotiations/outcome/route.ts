import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { outcomeToState, type OutcomeChoice } from "@/lib/flow";
import { verifyOutcomeToken } from "@/lib/outcome_token";
import { negotiationOutcomeSchema, firstIssueMessage } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = negotiationOutcomeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
  }

  const { negotiationId, outcome, actualSavingsCents, token } = parsed.data;

  const existing = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Auth: session OR valid HMAC token bound to this negotiation's billId.
  let authorized = false;
  const session = await auth();
  if (session?.user) {
    const sessionUserId = (session.user as { id: string }).id;
    if (sessionUserId === existing.userId) authorized = true;
  }
  if (!authorized && token) {
    const verified = verifyOutcomeToken(token);
    if (verified.ok && verified.billId === existing.billId) authorized = true;
  }
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { state, closedAt } = outcomeToState(outcome as OutcomeChoice);

  const updated = await prisma.negotiation.update({
    where: { id: negotiationId },
    data: {
      state,
      closedAt,
      actualSavingsCents:
        outcome === "SUCCESS_SAVED" ? actualSavingsCents ?? null : null,
    },
  });
  return NextResponse.json({ ok: true, state: updated.state });
}

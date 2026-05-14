import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { outcomeToState, type OutcomeChoice } from "@/lib/flow";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  negotiationId: z.string().min(1),
  outcome: z.enum(["SUCCESS_SAVED", "FAILED_NO_DEAL", "STILL_WAITING"]),
  actualSavingsCents: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
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

  const { negotiationId, outcome, actualSavingsCents } = parsed.data;
  const { state, closedAt } = outcomeToState(outcome as OutcomeChoice);

  try {
    const updated = await prisma.negotiation.update({
      where: { id: negotiationId },
      data: {
        state,
        closedAt,
        actualSavingsCents: outcome === "SUCCESS_SAVED" ? actualSavingsCents ?? null : null,
      },
    });
    return NextResponse.json({ ok: true, state: updated.state });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

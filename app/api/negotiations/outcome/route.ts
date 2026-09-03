import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { outcomeToState, type OutcomeChoice } from "@/lib/flow";
import { verifyOutcomeToken } from "@/lib/outcome_token";
import { negotiationOutcomeSchema, firstIssueMessage } from "@/lib/schemas";
import { isEnabled } from "@/lib/feature-flags";

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

  // v39 closed-guard: het outcome-token is 30 dagen geldig — een oude tab of
  // follow-up-mail mag een afgerekende uitkomst niet terugdraaien (FEE_PAID →
  // AWAITING zou een geïnde fee zonder administratie achterlaten, en een
  // her-post kon actualSavingsCents wissen). "Afgerekend" = er staat een
  // bedrag, óf een fee-/succes-state. Een legacy auto-gesloten ACCEPTED
  // zónder bedrag mag juist WÉL alsnog bevestigd worden (unbrick, zie
  // /uitkomst-pagina die dezelfde definitie hanteert).
  const settled =
    existing.actualSavingsCents != null ||
    ["FEE_PAID", "BILLED_PENDING_PAYMENT", "BILLED_OVERDUE", "SUCCESS", "BILLED"].includes(
      existing.state,
    );
  if (settled) {
    return NextResponse.json({ error: "Uitkomst is al vastgelegd." }, { status: 409 });
  }

  // v11: when proof-flow is enabled, a SUCCESS_SAVED claim parks the
  // negotiation in SUCCESS_UNVERIFIED until the user uploads a proof
  // (via /api/outcome/[id]/proof or via the bewijs@ webhook).
  // actualSavingsCents stays null until verified — so /proof aggregates
  // never count an unverified claim.
  const proofGateOn = isEnabled("PROOF_REQUIRED");
  const { state, closedAt } = outcomeToState(outcome as OutcomeChoice, {
    proofRequired: proofGateOn,
  });

  const updated = await prisma.negotiation.update({
    where: { id: negotiationId },
    data: {
      state,
      closedAt,
      // Alleen schrijven als er echt een nieuwe waarde is — andere outcomes
      // laten een eerder vastgelegd bedrag met rust (belt & braces naast de
      // closed-guard hierboven).
      ...(outcome === "SUCCESS_SAVED" && !proofGateOn
        ? { actualSavingsCents: actualSavingsCents ?? null }
        : {}),
    },
  });
  return NextResponse.json({ ok: true, state: updated.state });
}

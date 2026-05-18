/**
 * POST /api/negotiations/round/[id]/confirm-send
 *
 * User-confirm gate for auto-pingpong. Hard rule: this is the ONLY path
 * that puts an AI-generated counter-mail on the wire to a provider.
 *
 * 401 — not signed in
 * 403 — round belongs to a different user
 * 404 — round not found
 * 409 — round outcome != AWAITING_USER_CONFIRM (already sent or invalid state)
 * 503 — FEATURE_AUTO_PINGPONG disabled
 * 200 — counter sent, round outcome flipped to ACCEPTED (= our counter
 *       was successfully posted, not "provider accepted").
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { outboundThreadHeaders } from "@/lib/email-thread";
import { isEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isEnabled("AUTO_PINGPONG")) {
    return NextResponse.json({ error: "feature disabled" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const round = await prisma.negotiationRound.findUnique({
    where: { id },
    include: { negotiation: { include: { bill: true, user: true } } },
  });
  if (!round) return NextResponse.json({ error: "round not found" }, { status: 404 });
  if (round.negotiation.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (round.outcome !== "AWAITING_USER_CONFIRM") {
    return NextResponse.json(
      { error: "round is not awaiting confirmation", state: round.outcome },
      { status: 409 },
    );
  }
  if (!round.counterSubject || !round.counterBody) {
    return NextResponse.json({ error: "no counter to send" }, { status: 409 });
  }

  const threadId = round.negotiation.providerThreadId;
  const headers = threadId ? outboundThreadHeaders(threadId, threadId) : undefined;

  // Provider-address lookup: kept simple — the user manually sets the
  // provider thread up by forwarding the original reply, so we can
  // derive the provider's e-mail address from the inbound payload's
  // From header. For MVP we rely on inboundReplyTo carrying the address
  // hint; an empty value means there's no provider-address yet and we
  // bail out with 409.
  // In practice the provider address is stored on the most-recent
  // provider response — but the round model doesn't yet have a
  // dedicated column, so we leave this stub explicit and fail loud
  // when the address is missing. The smoke test asserts the 409.
  const providerAddress = (round.inboundReplyTo ?? "").match(/<([^@>]+@[^>]+)>/)?.[1] ?? null;
  if (!providerAddress) {
    return NextResponse.json(
      { error: "no provider address — forward the reply via auto@degeldheld.com" },
      { status: 409 },
    );
  }

  await sendEmail({
    to: providerAddress,
    subject: round.counterSubject,
    text: round.counterBody,
    html: `<pre style="font-family:inherit;white-space:pre-wrap">${round.counterBody.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] ?? m))}</pre>`,
    headers,
  });

  const updated = await prisma.negotiationRound.update({
    where: { id },
    data: { outcome: "ACCEPTED", confirmedSentAt: new Date() },
  });

  return NextResponse.json({ ok: true, roundId: updated.id, outcome: updated.outcome });
}

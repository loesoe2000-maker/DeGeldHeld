/**
 * POST /api/negotiations/[id]/relay-approve  — GUARDRAIL 2 (human-in-the-loop).
 *
 * The negotiation is in AWAITING_APPROVAL (a deal/commitment surfaced by the
 * relay). ONLY this endpoint, on an explicit owner action, can:
 *   - accept   → send the acceptance mail on behalf + close the relay (DONE).
 *                The saving is NOT marked verified here — that still requires
 *                proof (existing /bewijs flow → v19 fee on verified savings).
 *   - continue → resume relaying + send one more counter.
 *   - stop     → pause the relay (no more mails).
 *
 * Body: { action: "accept" | "continue" | "stop" }
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendRelayMail } from "@/lib/relay-send";
import { generateEmail } from "@/lib/negotiator";
import { buildComparison } from "@/lib/comparison";
import type { Category, Country } from "@/lib/providers";
import type { BillCategory } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "accept" | "continue" | "stop";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await ctx.params;

  let action: Action | null = null;
  try {
    const body = (await req.json()) as { action?: unknown };
    if (body.action === "accept" || body.action === "continue" || body.action === "stop") {
      action = body.action;
    }
  } catch {
    /* invalid body */
  }
  if (!action) return NextResponse.json({ error: "invalid action" }, { status: 400 });

  // Owner-only.
  const neg = await prisma.negotiation.findFirst({
    where: { id, userId },
    include: { bill: true, user: true, rounds: { orderBy: { roundNumber: "desc" }, take: 1 } },
  });
  if (!neg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (neg.relayState !== "AWAITING_APPROVAL") {
    return NextResponse.json({ error: "not awaiting approval", relayState: neg.relayState }, { status: 409 });
  }

  const lastOffer = neg.rounds[0]?.offeredCents ?? null;
  const billCategory = neg.bill.category as BillCategory;

  if (action === "stop") {
    await prisma.negotiation.update({ where: { id: neg.id }, data: { relayState: "PAUSED" } });
    return NextResponse.json({ ok: true, relayState: "PAUSED" });
  }

  if (action === "accept") {
    const offerStr =
      lastOffer != null ? `€${(lastOffer / 100).toFixed(2).replace(".", ",")} per maand` : "het aangeboden tarief";
    const body =
      `Hartelijk dank voor uw voorstel. Namens ${neg.user.name ?? "de klant"} gaan we ` +
      `akkoord met ${offerStr}. Graag deze wijziging doorvoeren en een schriftelijke ` +
      `bevestiging sturen.`;
    // Re-activate momentarily so the consent gate passes for this explicit,
    // human-approved send; then close the relay.
    await prisma.negotiation.update({ where: { id: neg.id }, data: { relayState: "RELAY_ACTIVE" } });
    const sent = await sendRelayMail({
      negotiationId: neg.id,
      subject: `Akkoord — ${neg.bill.provider}`,
      body,
      kind: "accept",
    });
    // Close the relay regardless of send outcome; the saving stays UNVERIFIED
    // until proof arrives (we never mark a saving 'behaald' here).
    await prisma.negotiation.update({
      where: { id: neg.id },
      data: { relayState: "DONE", state: "AWAITING" },
    });
    await prisma.negotiationRound.updateMany({
      where: { negotiationId: neg.id, outcome: "AWAITING_USER_CONFIRM" },
      data: { outcome: "ACCEPTED", confirmedSentAt: new Date() },
    });
    return NextResponse.json({ ok: true, relayState: "DONE", sent: sent.ok, reason: sent.ok ? undefined : sent.reason });
  }

  // continue → resume relaying + send one more counter referencing the offer.
  const comparison = buildComparison({
    provider: neg.bill.provider,
    category: billCategory as unknown as Category,
    amountCents: neg.bill.monthlyCents ?? neg.bill.amountCents,
    country: (neg.bill.country as Country | null) ?? "NL",
  });
  const draft = await generateEmail({
    customerName: neg.user.name ?? "",
    customerEmail: neg.user.email ?? undefined,
    provider: neg.bill.provider,
    category: billCategory,
    currentPlan: neg.bill.plan,
    currentMonthlyCents: neg.bill.monthlyCents ?? neg.bill.amountCents,
    customerNumber: neg.bill.customerNumber,
    alternatives: comparison.topAlternatives,
    roundContext: { roundNumber: neg.rounds.length + 1, previousOfferedCents: lastOffer, previousTone: "constructief" },
  });
  await prisma.negotiation.update({ where: { id: neg.id }, data: { relayState: "RELAY_ACTIVE", state: "COUNTER_SENT" } });
  const sent = await sendRelayMail({ negotiationId: neg.id, subject: draft.subject, body: draft.body, kind: "counter" });
  return NextResponse.json({ ok: true, relayState: "RELAY_ACTIVE", sent: sent.ok });
}

/**
 * POST /api/negotiations/[id]/relay-authorize
 *
 * GUARDRAIL 1 (consent-first): the customer authorizes DeGeldHeld to
 * negotiate on their behalf. Records the exact accepted text + a timestamp +
 * a crypto-random relay token, and flips relayState → RELAY_ACTIVE. Nothing
 * is ever relayed without this. Only the bill owner can authorize (anti-abuse).
 *
 * Body (optional): { providerEmail?: string }
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateRelayToken, relayMandateText } from "@/lib/relay";
import { sendFirstRelayMail } from "@/lib/relay-send";
import { isEnabled } from "@/lib/feature-flags";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) ? t : null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // GUARDRAIL 7 — relay is OWNER/lawyer-gated. Off → relay does not exist.
  if (!isEnabled("RELAY_ENABLED")) {
    return NextResponse.json({ error: "Not found", reason: "disabled" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const { id } = await ctx.params;

  // Anti-abuse: only the owner of this negotiation can authorize a relay.
  const negotiation = await prisma.negotiation.findFirst({
    where: { id, userId },
    include: { bill: { select: { provider: true } } },
  });
  if (!negotiation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // GUARDRAIL 4 — KAART VERPLICHT. "Wij doen het werk" → a proven saving must
  // be chargeable. No linked fee-card + accepted mandate → no relay. Send the
  // customer to the card-link step (the consent UI shows the FeeMandatePrompt).
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { feePaymentMethodId: true, feeMandateAcceptedAt: true },
  });
  if (!user?.feePaymentMethodId || !user.feeMandateAcceptedAt) {
    return NextResponse.json({ error: "card required", reason: "card-required" }, { status: 409 });
  }

  let providerEmail: string | null = null;
  try {
    const body = (await req.json()) as { providerEmail?: unknown };
    providerEmail = cleanEmail(body.providerEmail);
  } catch {
    /* no body → defaults */
  }

  // Idempotent: keep an existing token (so the reply-to stays stable).
  const token = negotiation.relayToken ?? generateRelayToken();
  const authText = relayMandateText(negotiation.bill.provider);

  await prisma.negotiation.update({
    where: { id: negotiation.id },
    data: {
      relayAuthorizedAt: new Date(),
      relayAuthText: authText,
      relayToken: token,
      relayState: "RELAY_ACTIVE",
      ...(providerEmail ? { providerEmail } : {}),
    },
  });

  // DEEL 2: if we have a provider address, send the first mail on behalf
  // right away (consent-gated inside sendFirstRelayMail). Best-effort — the
  // relay stays authorized even if the provider address isn't known yet.
  let firstSend: string | null = null;
  if (providerEmail) {
    try {
      const r = await sendFirstRelayMail(negotiation.id);
      firstSend = r.ok ? "sent" : r.reason;
    } catch (e) {
      Sentry.captureException(e, { tags: { module: "relay-authorize" } });
      firstSend = "error";
    }
  } else {
    firstSend = "no-provider-address";
  }

  return NextResponse.json({ ok: true, relayState: "RELAY_ACTIVE", firstSend });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyAndParseWebhook,
  shouldMarkPaid,
  shouldMarkRefunded,
  shouldMarkFailed,
  isSubscriptionEvent,
  subscriptionStatusFromEvent,
  type WebhookEvent,
} from "@/lib/payments";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  // v18: a missing webhook secret is a hard misconfiguration. NEVER
  // silently process an unsigned event — fail loud with 500 so the
  // owner notices, and Stripe retries once the secret is set.
  if (!secret) {
    const msg = "[stripe-webhook] STRIPE_WEBHOOK_SECRET missing — refusing to process";
    console.error(msg);
    try {
      Sentry.captureMessage(msg, { level: "error", tags: { module: "stripe-webhook" } });
    } catch {
      /* sentry optional */
    }
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();
  const verified = verifyAndParseWebhook(body, sig, secret);
  if (!verified.ok) {
    // Bad/forged signature → 400. Stripe does not retry a 400.
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  const event = verified.event;

  // v18: idempotency. Stripe retries events; record each id and skip
  // duplicates so we never double-charge / double-flip state.
  try {
    await prisma.processedStripeEvent.create({
      data: { id: event.eventId, type: event.type },
    });
  } catch {
    // Unique-constraint violation → already processed → ack + skip.
    return NextResponse.json({ ok: true, duplicate: event.eventId });
  }

  try {
    await handleEvent(event);
  } catch (e) {
    // Processing failed — let Stripe retry. We already recorded the
    // event id, so delete the marker so the retry actually re-runs.
    try {
      await prisma.processedStripeEvent.delete({ where: { id: event.eventId } });
    } catch {
      /* best-effort */
    }
    Sentry.captureException(e, {
      tags: { module: "stripe-webhook", eventType: event.type, eventId: event.eventId },
    });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, type: event.type });
}

async function handleEvent(event: WebhookEvent): Promise<void> {
  const { type, negotiationId, billId, kind, sessionId, paymentIntentId, eventId } = event;

  // --- Subscription (DeGeldHeld Plus) ---
  if (isSubscriptionEvent(type)) {
    const status = subscriptionStatusFromEvent(type, event.subscriptionStatus);
    if (!status) return;
    const where = event.customerId
      ? { stripeCustomerId: event.customerId }
      : event.subscriptionId
        ? { stripeSubscriptionId: event.subscriptionId }
        : null;
    if (!where) return;
    const user = await prisma.user.findFirst({ where });
    if (!user) return;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: status,
        subscriptionPlan: "plus",
        ...(event.subscriptionId ? { stripeSubscriptionId: event.subscriptionId } : {}),
      },
    });
    return;
  }

  // --- DEEL 10 paywall flow: mark the Bill as paid ---
  if (kind === "paywall" && billId) {
    if (shouldMarkPaid(type)) {
      await prisma.bill.update({
        where: { id: billId },
        data: { paidAt: new Date() },
      });
    }
    return;
  }

  // --- Success-fee / no-cure-no-pay flow ---
  if (!negotiationId) return; // unknown metadata → ack, no-op

  if (shouldMarkPaid(type)) {
    await prisma.payment.update({
      where: { negotiationId },
      data: {
        status: "PAID",
        stripePaymentId: paymentIntentId ?? sessionId,
        stripeEventId: eventId,
      },
    });
    await prisma.negotiation.update({
      where: { id: negotiationId },
      data: { state: "BILLED" },
    });
  } else if (shouldMarkRefunded(type)) {
    await prisma.payment.update({
      where: { negotiationId },
      data: { status: "REFUNDED", refundedAt: new Date(), stripeEventId: eventId },
    });
  } else if (shouldMarkFailed(type)) {
    await prisma.payment.update({
      where: { negotiationId },
      data: { status: "FAILED", stripeEventId: eventId },
    });
  }
}

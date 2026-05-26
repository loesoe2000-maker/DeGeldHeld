import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  verifyAndParseWebhook,
  shouldMarkPaid,
  shouldMarkRefunded,
  shouldMarkFailed,
  isSubscriptionEvent,
  subscriptionStatusFromEvent,
  isFeeSetupCompleted,
  getSetupPaymentMethod,
  persistFeeSetup,
  type WebhookEvent,
} from "@/lib/payments";
import * as Sentry from "@sentry/nextjs";
import { notifyOwner } from "@/lib/owner-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SHA-256 hash van de Stripe payload — voor idempotency-audit. */
function payloadHash(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

/** Beste-poging audit-row; mag de webhook-flow NOOIT breken. */
async function logWebhookEvent(opts: {
  eventId: string;
  type: string;
  outcome: "duplicate" | "ok" | "handler-failed" | "signature-failed";
  payloadHash: string;
  resolvedRef?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId: opts.eventId,
        type: opts.type,
        outcome: opts.outcome,
        payloadHash: opts.payloadHash,
        resolvedRef: opts.resolvedRef ?? null,
        errorMessage: opts.errorMessage ?? null,
      },
    });
  } catch {
    /* best-effort — audit-log breekt de webhook nooit */
  }
}

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
  const hash = payloadHash(body);
  const verified = verifyAndParseWebhook(body, sig, secret);
  if (!verified.ok) {
    // v36 audit-trail: signature-fail laten we óók noteren (Stripe spoofing-
    // pogingen / config-fout). eventId onbekend → gebruik hash-prefix.
    void logWebhookEvent({
      eventId: `sig-fail:${hash.slice(0, 24)}`,
      type: "unknown",
      outcome: "signature-failed",
      payloadHash: hash,
      errorMessage: verified.error,
    });
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
    void logWebhookEvent({
      eventId: event.eventId,
      type: event.type,
      outcome: "duplicate",
      payloadHash: hash,
    });
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
    // v36 audit + owner-alert.
    void logWebhookEvent({
      eventId: event.eventId,
      type: event.type,
      outcome: "handler-failed",
      payloadHash: hash,
      errorMessage: (e as Error).message,
    });
    // v36 — owner-alert: webhook-processing fail = potentieel verloren state-
    // transition (Stripe retries 3 dgn, daarna stop). Owner moet kunnen reageren.
    void notifyOwner("stripe-webhook-error", {
      summary: `Stripe webhook ${event.type} processing failed`,
      ref: event.eventId,
      details: {
        eventId: event.eventId,
        eventType: event.type,
        error: (e as Error).message,
      },
    });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  // v36 — happy-path audit. resolvedRef = de business-entity die hierdoor
  // veranderde (negotiationId / billId / customerId). Owner kan zo per
  // referentie traceren welk event-pad ze raakte.
  const ref =
    event.negotiationId ??
    event.billId ??
    event.subscriptionId ??
    event.customerId ??
    null;
  void logWebhookEvent({
    eventId: event.eventId,
    type: event.type,
    outcome: "ok",
    payloadHash: hash,
    resolvedRef: ref,
  });
  return NextResponse.json({ ok: true, type: event.type });
}

async function handleEvent(event: WebhookEvent): Promise<void> {
  const { type, negotiationId, billId, kind, sessionId, paymentIntentId, eventId } = event;

  // --- v19 fee-mandate: card linked via setup-checkout ---
  if (isFeeSetupCompleted(event) && event.setupIntentId) {
    const pm = await getSetupPaymentMethod(event.setupIntentId, event.customerId);
    if (pm) {
      await persistFeeSetup({
        userId: event.userId,
        customerId: event.customerId,
        paymentMethodId: pm,
      });
    }
    return;
  }

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

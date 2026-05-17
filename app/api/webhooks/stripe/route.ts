import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyAndParseWebhook,
  shouldMarkPaid,
  shouldMarkRefunded,
  shouldMarkFailed,
} from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature") ?? "";
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  const body = await req.text();
  const verified = verifyAndParseWebhook(body, sig, secret);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }
  const { type, negotiationId, billId, kind, sessionId, paymentIntentId } = verified.event;

  // --- DEEL 10 paywall flow: mark the Bill as paid ---
  if (kind === "paywall" && billId) {
    if (shouldMarkPaid(type)) {
      await prisma.bill.update({
        where: { id: billId },
        data: { paidAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true, type, kind: "paywall", billId });
  }

  // --- Legacy success-fee flow ---
  if (!negotiationId) return NextResponse.json({ ok: true, ignored: "no metadata" });

  if (shouldMarkPaid(type)) {
    await prisma.payment.update({
      where: { negotiationId },
      data: { status: "PAID", stripePaymentId: paymentIntentId ?? sessionId },
    });
    await prisma.negotiation.update({
      where: { id: negotiationId },
      data: { state: "BILLED" },
    });
  } else if (shouldMarkRefunded(type)) {
    await prisma.payment.update({
      where: { negotiationId },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });
  } else if (shouldMarkFailed(type)) {
    await prisma.payment.update({
      where: { negotiationId },
      data: { status: "FAILED" },
    });
  }

  return NextResponse.json({ ok: true, type });
}

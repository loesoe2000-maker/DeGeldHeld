import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createCheckoutSession,
  createPaywallCheckoutSession,
} from "@/lib/payments";
import { firstIssueMessage } from "@/lib/schemas";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Two shapes: legacy success-fee (negotiationId) and DEEL 10 paywall
// (billId + kind: "paywall"). Discriminated by `kind`.
const successFeeSchema = z.object({
  negotiationId: z.string().min(1, "negotiationId vereist"),
  kind: z.literal("success-fee").optional(),
});
const paywallSchema = z.object({
  billId: z.string().min(1, "billId vereist"),
  kind: z.literal("paywall"),
});
const requestSchema = z.union([paywallSchema, successFeeSchema]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const rl = rateLimit({ key: `checkout:${userId}`, max: 10, windowSec: 3600 });
  if (!rl.ok) return rateLimitResponse(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
  }

  const appUrl = process.env.APP_URL ?? "https://degeldheld.com";

  // --- DEEL 10 paywall flow ---
  if ("kind" in parsed.data && parsed.data.kind === "paywall") {
    const bill = await prisma.bill.findFirst({
      where: { id: parsed.data.billId, userId },
    });
    if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (bill.paidAt) {
      return NextResponse.json({
        ok: true,
        checkoutUrl: `${appUrl}/onderhandel/analyse?bill=${bill.id}&paid=1`,
        amountCents: 0,
        alreadyPaid: true,
      });
    }
    const co = await createPaywallCheckoutSession({
      userEmail: session.user.email!,
      billId: bill.id,
      appUrl,
    });
    return NextResponse.json({ ok: true, checkoutUrl: co.url, amountCents: co.amountCents });
  }

  // --- Legacy success-fee flow ---
  const negotiation = await prisma.negotiation.findFirst({
    where: { id: parsed.data.negotiationId, userId },
  });
  if (!negotiation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (negotiation.state !== "SUCCESS") {
    return NextResponse.json({ error: "Negotiation not successful" }, { status: 400 });
  }
  if (!negotiation.actualSavingsCents || negotiation.actualSavingsCents <= 0) {
    return NextResponse.json({ error: "No savings to bill" }, { status: 400 });
  }

  const co = await createCheckoutSession({
    userEmail: session.user.email!,
    negotiationId: negotiation.id,
    yearlySavingsCents: negotiation.actualSavingsCents,
    appUrl,
  });

  await prisma.payment.upsert({
    where: { negotiationId: negotiation.id },
    update: { stripeSessionId: co.id, amountCents: co.amountCents, status: "PENDING" },
    create: {
      userId,
      negotiationId: negotiation.id,
      stripeSessionId: co.id,
      amountCents: co.amountCents,
      status: "PENDING",
    },
  });

  return NextResponse.json({ ok: true, checkoutUrl: co.url, amountCents: co.amountCents });
}

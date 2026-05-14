import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCheckoutSession } from "@/lib/payments";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ negotiationId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

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
    appUrl: process.env.APP_URL ?? "https://degeldheld.com",
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

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  negotiationId: z.string().min(1).optional(),
  billId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success || (!parsed.data.negotiationId && !parsed.data.billId)) {
    return NextResponse.json(
      { error: "negotiationId of billId vereist" },
      { status: 400 },
    );
  }

  const where = parsed.data.negotiationId
    ? { id: parsed.data.negotiationId, userId }
    : { billId: parsed.data.billId!, userId };

  const negotiation = await prisma.negotiation.findFirst({ where });
  if (!negotiation) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  if (negotiation.emailSentAt) {
    return NextResponse.json({ ok: true, alreadySent: true });
  }

  const updated = await prisma.negotiation.update({
    where: { id: negotiation.id },
    data: {
      emailSentAt: new Date(),
      // Move out of EMAIL_GEN into AWAITING / EMAIL_SENT so the follow-up cron picks it up.
      state: negotiation.state === "EMAIL_GEN" ? "EMAIL_SENT" : negotiation.state,
    },
  });
  return NextResponse.json({ ok: true, emailSentAt: updated.emailSentAt });
}

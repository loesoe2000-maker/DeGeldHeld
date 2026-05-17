import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  negotiationId: z.string().min(1),
  providerNumber: z.string().regex(/^\+?\d{6,15}$/),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const neg = await prisma.negotiation.findFirst({
    where: { id: parsed.data.negotiationId, userId },
    select: { id: true },
  });
  if (!neg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ourNumber = process.env.TWILIO_WHATSAPP_NUMBER ?? "";
  if (!ourNumber) {
    return NextResponse.json({ error: "Server WhatsApp number not configured" }, { status: 503 });
  }

  const thread = await prisma.whatsAppThread.upsert({
    where: { negotiationId: neg.id },
    create: {
      negotiationId: neg.id,
      providerNumber: parsed.data.providerNumber,
      ourNumber,
      status: "active",
    },
    update: {
      providerNumber: parsed.data.providerNumber,
      status: "active",
    },
  });
  return NextResponse.json({ ok: true, threadId: thread.id, ourNumber });
}

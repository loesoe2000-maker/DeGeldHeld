/**
 * /api/outbound/whatsapp — user-confirmed counter-send.
 *
 * Hard requirement: AI counters NEVER auto-send. The user must POST
 * {messageId} after explicitly clicking "Akkoord, verstuur".
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { isWhatsAppEnabled } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  messageId: z.string().min(1),
});

async function sendViaTwilio(opts: {
  to: string;
  from: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return { ok: false, error: "twilio-not-configured" };
  }
  const form = new URLSearchParams({
    From: `whatsapp:${opts.from}`,
    To: `whatsapp:${opts.to}`,
    Body: opts.body,
  });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
    },
    body: form.toString(),
  });
  if (!r.ok) {
    const text = await r.text();
    return { ok: false, error: `twilio-${r.status}: ${text.slice(0, 120)}` };
  }
  return { ok: true };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isWhatsAppEnabled()) return NextResponse.json({ error: "WhatsApp not enabled" }, { status: 503 });
  const userId = (session.user as { id: string }).id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Load message + thread + ownership-check via negotiation.userId
  const msg = await prisma.whatsAppMessage.findUnique({
    where: { id: parsed.data.messageId },
    include: {
      thread: { include: { negotiation: { select: { userId: true } } } },
    },
  });
  if (!msg || msg.thread.negotiation.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!msg.pendingApproval || msg.direction !== "outbound") {
    return NextResponse.json({ error: "Message not awaiting approval" }, { status: 400 });
  }

  const result = await sendViaTwilio({
    to: msg.thread.providerNumber,
    from: msg.thread.ourNumber,
    body: msg.body,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await prisma.whatsAppMessage.update({
    where: { id: msg.id },
    data: { pendingApproval: false, receivedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

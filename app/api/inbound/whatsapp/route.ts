/**
 * /api/inbound/whatsapp — Twilio WhatsApp Business webhook.
 *
 * Verifies HMAC, matches incoming message to a WhatsAppThread, persists
 * the inbound row, generates an AI counter-draft (pendingApproval=true),
 * and notifies the user by email. The counter is NEVER auto-sent — the
 * user must accept it via /onderhandel/[billId]/whatsapp UI.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyTwilioSignature,
  verify360dialogSecret,
  parseTwilioMessage,
  analyseProviderResponse,
  isWhatsAppEnabled,
} from "@/lib/whatsapp";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

export async function POST(req: Request) {
  if (!isWhatsAppEnabled()) {
    return NextResponse.json({ error: "WhatsApp not enabled" }, { status: 503 });
  }
  const provider = process.env.WHATSAPP_PROVIDER ?? "twilio";
  const url = req.url;

  // Both Twilio (form-encoded) and 360dialog (JSON) supported.
  let params: Record<string, string> = {};
  const ct = req.headers.get("content-type") ?? "";
  let body: unknown;
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const usp = new URLSearchParams(text);
    usp.forEach((v, k) => (params[k] = v));
    body = params;
  } else {
    body = await req.json();
    params = (body as Record<string, string>) ?? {};
  }

  // Signature verification
  if (provider === "twilio") {
    const signature = req.headers.get("x-twilio-signature");
    const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
    if (!verifyTwilioSignature({ url, params, signature, authToken })) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    const headerSecret = req.headers.get("x-360dialog-secret");
    if (!verify360dialogSecret(headerSecret)) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }
  }

  const msg = parseTwilioMessage(params);
  if (!msg) return NextResponse.json({ error: "Missing from/to" }, { status: 400 });

  // Match to thread by providerNumber == msg.fromNumber
  const thread = await prisma.whatsAppThread.findFirst({
    where: { providerNumber: msg.fromNumber, status: "active" },
    include: { negotiation: { include: { user: true, bill: true } } },
  });
  if (!thread) {
    return NextResponse.json({ ok: true, ignored: "no-matching-thread" });
  }

  await prisma.whatsAppMessage.create({
    data: {
      threadId: thread.id,
      direction: "inbound",
      body: msg.body,
      mediaUrl: msg.mediaUrl,
    },
  });

  const monthlyEur = (thread.negotiation.bill.monthlyCents ?? thread.negotiation.bill.amountCents) / 100;
  const counter = await analyseProviderResponse({
    providerName: thread.negotiation.bill.provider,
    providerMessage: msg.body,
    currentMonthlyEur: monthlyEur,
  });

  await prisma.whatsAppMessage.create({
    data: {
      threadId: thread.id,
      direction: "outbound",
      body: counter.counter,
      pendingApproval: true,
    },
  });

  try {
    await sendEmail({
      to: thread.negotiation.user.email,
      subject: `Provider antwoord op WhatsApp — review counter`,
      text: `${thread.negotiation.bill.provider} antwoordde via WhatsApp.

AI-counter (jij moet bevestigen voor verzenden):
${counter.counter}

Open: ${APP_URL}/onderhandel/${thread.negotiation.billId}/whatsapp`,
      html: `<p><strong>${thread.negotiation.bill.provider}</strong> antwoordde via WhatsApp.</p>
<blockquote>${msg.body}</blockquote>
<p>AI-counter (akkoord vereist):</p>
<pre>${counter.counter}</pre>
<p><a href="${APP_URL}/onderhandel/${thread.negotiation.billId}/whatsapp">Bekijk + verstuur →</a></p>`,
    });
  } catch {
    // never block on outbound mail
  }

  return NextResponse.json({ ok: true, threadId: thread.id });
}

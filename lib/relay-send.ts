/**
 * lib/relay-send.ts — v23 outbound relay (mail namens de klant).
 *
 * EVERY function here calls canRelaySend() first (GUARDRAIL 1). There is no
 * code path that puts a relay mail on the wire without an active, authorized
 * relay. Mails go out with reply-to = onderhandel+<token>@ so provider
 * replies route back to the inbound handler, in a stable RFC-5322 thread.
 */
import { prisma } from "@/lib/db";
import { sendEmail, escapeHtml } from "@/lib/email";
import { generateThreadId, messageIdFor } from "@/lib/email-thread";
import { canRelaySend, relayReplyTo } from "@/lib/relay";

export type RelaySendResult =
  | { ok: true; messageId: string; threadId: string }
  | { ok: false; reason: string };

/** Signature block making the on-behalf relationship explicit to the provider. */
function relaySignature(customerName: string): string {
  const name = (customerName ?? "").trim() || "de klant";
  return `\n\nMet vriendelijke groet,\nnamens ${name}\n— verzonden via DeGeldHeld`;
}

/**
 * Send (or re-send) a relay mail to the provider on the customer's behalf.
 * `kind` is "first" (initial outreach) or "counter" (a routine counter).
 * Always consent-gated; needs a providerEmail + a relay token.
 */
export async function sendRelayMail(opts: {
  negotiationId: string;
  subject: string;
  body: string;
  kind: "first" | "counter";
}): Promise<RelaySendResult> {
  const neg = await prisma.negotiation.findUnique({
    where: { id: opts.negotiationId },
    include: { bill: { select: { provider: true } }, user: { select: { name: true } } },
  });
  if (!neg) return { ok: false, reason: "negotiation not found" };

  // GUARDRAIL 1 — consent-first. No authorized, active relay → never send.
  if (!canRelaySend(neg)) return { ok: false, reason: "relay not authorized/active" };
  if (!neg.relayToken) return { ok: false, reason: "no relay token" };
  if (!neg.providerEmail) return { ok: false, reason: "no-provider-address" };

  // Keep a stable thread so provider replies match this negotiation.
  const threadId = neg.providerThreadId ?? generateThreadId();
  const subject = opts.subject.includes(`[NEGOTIATION-${neg.id}]`)
    ? opts.subject
    : `${opts.subject} [NEGOTIATION-${neg.id}]`;

  const text = opts.body + relaySignature(neg.user.name ?? "");
  const html = `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`;

  const sent = await sendEmail({
    to: neg.providerEmail,
    subject,
    text,
    html,
    replyTo: relayReplyTo(neg.relayToken),
    headers: { "Message-ID": messageIdFor(threadId) },
  });

  // Persist the thread + outbound bookkeeping. The first send marks the
  // negotiation EMAIL_SENT; counters bump the loop-guard counter.
  await prisma.negotiation.update({
    where: { id: neg.id },
    data: {
      providerThreadId: threadId,
      ...(opts.kind === "first" ? { emailSentAt: new Date(), state: "EMAIL_SENT" } : {}),
      ...(opts.kind === "counter" ? { relayAutoRounds: { increment: 1 } } : {}),
    },
  });

  return { ok: true, messageId: sent.id, threadId };
}

/** Send the FIRST negotiation email on behalf (uses the stored draft). */
export async function sendFirstRelayMail(negotiationId: string): Promise<RelaySendResult> {
  const neg = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    select: { emailSubject: true, emailBody: true, bill: { select: { provider: true } } },
  });
  if (!neg) return { ok: false, reason: "negotiation not found" };
  if (!neg.emailBody) return { ok: false, reason: "no draft email" };
  return sendRelayMail({
    negotiationId,
    subject: neg.emailSubject ?? `Verzoek tariefherziening ${neg.bill.provider}`,
    body: neg.emailBody,
    kind: "first",
  });
}

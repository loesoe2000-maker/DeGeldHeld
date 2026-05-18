/**
 * lib/inbound-router.ts — auto-pingpong inbound matcher.
 *
 * Wired into POST /api/inbound/router (Resend webhook).
 *
 * Flow:
 *   1. Verify HMAC against RESEND_INBOUND_SECRET (NOT the same key as
 *      regular inbound; auto-pingpong has its own webhook URL + secret).
 *   2. Extract thread-id from In-Reply-To header.
 *   3. Look up Negotiation by providerThreadId.
 *   4. analyseProviderResponse() on the email body.
 *   5. If action === "counter": generate a counter-mail via generateEmail()
 *      and persist as a new NegotiationRound with outcome
 *      AWAITING_USER_CONFIRM. **Never** auto-send.
 *   6. Notify the user via a one-shot e-mail with a deeplink to
 *      /onderhandel/[billId]/ronde/[n] so they can review + confirm.
 *
 * Hard rule: this module NEVER calls sendEmail() to the *provider* on
 * its own. The user-confirm gate at /api/negotiations/round/[id]/confirm-send
 * is the only path that puts a counter-mail on the wire.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { extractThreadId } from "@/lib/email-thread";
import { analyseProviderResponse, MAX_ROUNDS } from "@/lib/rounds";
import { generateEmail } from "@/lib/negotiator";
import { buildComparison } from "@/lib/comparison";
import type { Country, Category } from "@/lib/providers";
import type { BillCategory } from "@prisma/client";
import { sendEmail } from "@/lib/email";

export const INBOUND_ROUTER_SIG_HEADER = "resend-signature";

export function verifyInboundRouterSignature(
  rawBody: string,
  signatureHex: string | null,
): boolean {
  const secret = process.env.RESEND_INBOUND_SECRET;
  if (!secret) return false;
  if (!signatureHex) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(signatureHex, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type InboundRouterPayload = {
  from: string;
  subject: string;
  text: string;
  inReplyTo: string | null;
  references: string | null;
  messageId: string | null;
};

export function parseInboundRouterPayload(raw: unknown): InboundRouterPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const dataRaw = (obj.data ?? obj) as Record<string, unknown>;

  const headers = (dataRaw.headers ?? {}) as Record<string, unknown>;
  function h(name: string): string | null {
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lower && typeof v === "string") return v;
    }
    const direct = dataRaw[name];
    if (typeof direct === "string") return direct;
    return null;
  }

  let from = "";
  const fromRaw = dataRaw.from;
  if (typeof fromRaw === "string") from = fromRaw;
  else if (fromRaw && typeof fromRaw === "object" && typeof (fromRaw as Record<string, unknown>).email === "string") {
    from = (fromRaw as { email: string }).email;
  }

  if (!from) return null;
  return {
    from: from.toLowerCase().trim(),
    subject: typeof dataRaw.subject === "string" ? dataRaw.subject : "",
    text: typeof dataRaw.text === "string" ? dataRaw.text : "",
    inReplyTo: h("In-Reply-To"),
    references: h("References"),
    messageId: h("Message-ID"),
  };
}

export type RouteResult =
  | { ok: false; reason: "no-thread-id" | "no-match" | "max-rounds" | "no-counter-needed" }
  | { ok: true; roundId: string; negotiationId: string };

/**
 * Core auto-pingpong logic. Side-effect: writes a new NegotiationRound
 * with outcome AWAITING_USER_CONFIRM and notifies the user via mail.
 * Caller is the webhook route; it must have already verified HMAC.
 *
 * Splitting this out from the route handler lets tests exercise the
 * full pipeline against an in-memory mock without spinning up Next.js.
 */
export async function routeInboundReply(
  payload: InboundRouterPayload,
  opts: { notifyUser?: boolean } = {},
): Promise<RouteResult> {
  const threadId = extractThreadId(payload.inReplyTo) ?? extractThreadId(payload.references);
  if (!threadId) return { ok: false, reason: "no-thread-id" };

  const negotiation = await prisma.negotiation.findUnique({
    where: { providerThreadId: threadId },
    include: { bill: true, rounds: { orderBy: { roundNumber: "asc" } }, user: true },
  });
  if (!negotiation) return { ok: false, reason: "no-match" };

  const usedRounds = negotiation.rounds.length;
  if (usedRounds >= MAX_ROUNDS) return { ok: false, reason: "max-rounds" };

  const analysis = await analyseProviderResponse(payload.text);
  if (analysis.action !== "counter") {
    return { ok: false, reason: "no-counter-needed" };
  }

  const billCategory = negotiation.bill.category as BillCategory;
  const comparison = buildComparison({
    provider: negotiation.bill.provider,
    category: billCategory as unknown as Category,
    amountCents: negotiation.bill.monthlyCents ?? negotiation.bill.amountCents,
    country: (negotiation.bill.country as Country | null) ?? "NL",
  });

  const previousOfferedCents =
    analysis.offeredCents ??
    negotiation.rounds[negotiation.rounds.length - 1]?.offeredCents ??
    null;

  const draft = await generateEmail({
    customerName: negotiation.user.name ?? "",
    customerEmail: negotiation.user.email ?? undefined,
    provider: negotiation.bill.provider,
    category: billCategory,
    currentPlan: negotiation.bill.plan,
    currentMonthlyCents: negotiation.bill.monthlyCents ?? negotiation.bill.amountCents,
    customerNumber: negotiation.bill.customerNumber,
    alternatives: comparison.topAlternatives,
    roundContext: {
      roundNumber: usedRounds + 1,
      previousOfferedCents,
      previousTone: analysis.tone,
    },
  });

  const round = await prisma.negotiationRound.create({
    data: {
      negotiationId: negotiation.id,
      roundNumber: usedRounds + 1,
      providerResponse: payload.text,
      analysisJson: JSON.stringify(analysis),
      offeredCents: analysis.offeredCents,
      counterSubject: draft.subject,
      counterBody: draft.body,
      outcome: "AWAITING_USER_CONFIRM",
      inboundMessageId: payload.messageId,
      inboundReplyTo: payload.inReplyTo,
    },
  });

  if (opts.notifyUser !== false && negotiation.user.email) {
    const appUrl = process.env.APP_URL ?? "https://degeldheld.com";
    const link = `${appUrl}/onderhandel/${negotiation.billId}/ronde/${round.roundNumber}`;
    await sendEmail({
      to: negotiation.user.email,
      subject: `${negotiation.bill.provider} reageerde — bekijk de counter-mail`,
      text: `${negotiation.bill.provider} heeft gereageerd op je onderhandel-mail.
We hebben een counter-mail klaargezet. Bekijk + bevestig hier:
${link}

(De counter wordt niet automatisch verzonden — je moet 'm zelf bevestigen.)

— DeGeldHeld`,
      html: `<p><strong>${negotiation.bill.provider}</strong> heeft gereageerd op je onderhandel-mail.</p>
<p>We hebben een counter-mail klaargezet. <a href="${link}">Bekijk + bevestig hier →</a></p>
<p><em>De counter wordt niet automatisch verzonden — je moet 'm zelf bevestigen.</em></p>
<p>— DeGeldHeld</p>`,
    });
  }

  return { ok: true, roundId: round.id, negotiationId: negotiation.id };
}

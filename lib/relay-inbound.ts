/**
 * lib/relay-inbound.ts — v23 inbound relay (provider reply → decide → act).
 *
 * A provider reply arrives at onderhandel+<token>@ (reply-to we set on the
 * outbound relay mail). This module:
 *   1. resolves the negotiation by relay token (anti-abuse: a token routes
 *      ONLY to its own negotiation),
 *   2. dedupes on the inbound Message-ID (idempotency — never counter twice),
 *   3. analyses the reply and runs relayDecision() (GUARDRAIL 2):
 *        - routine counter → auto-send via the relay (DEEL 3),
 *        - deal / commitment / provider-pushback / loop-guard → AWAITING_APPROVAL,
 *          customer decides (DEEL 4 — NEVER auto-accepted),
 *        - walk_away → PAUSED, hand back,
 *   4. notifies the customer every round (full transparency).
 */
import { prisma } from "@/lib/db";
import { sendEmail, escapeHtml } from "@/lib/email";
import { analyseProviderResponse } from "@/lib/rounds";
import { generateEmail } from "@/lib/negotiator";
import { buildComparison } from "@/lib/comparison";
import type { Category, Country } from "@/lib/providers";
import type { BillCategory } from "@prisma/client";
import { canRelaySend, relayDecision, type RelayDecision } from "@/lib/relay";
import { sendRelayMail } from "@/lib/relay-send";

const APP_URL = process.env.APP_URL ?? "https://www.degeldheld.com";

export type RelayInboundResult =
  | { ok: true; action: RelayDecision["kind"]; roundId?: string }
  | { ok: false; reason: string };

type RelayInboundPayload = {
  relayToken: string;
  from: string;
  text: string;
  messageId: string | null;
};

async function notifyCustomer(opts: {
  email: string | null;
  billId: string;
  subject: string;
  intro: string;
  cta?: boolean;
}): Promise<void> {
  if (!opts.email) return;
  const link = `${APP_URL}/onderhandel/${opts.billId}/relay`;
  try {
    await sendEmail({
      to: opts.email,
      subject: opts.subject,
      text: `${opts.intro}\n\nBekijk de status & gesprekken:\n${link}\n\n— DeGeldHeld`,
      html: `<p>${escapeHtml(opts.intro)}</p>
<p><a href="${link}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Bekijk de status &amp; gesprekken</a></p>
<p>— DeGeldHeld</p>`,
    });
  } catch {
    /* never block on outbound mail */
  }
}

/**
 * Process one provider reply for a relay negotiation. Consent-gated; pure
 * routing via relayDecision().
 */
export async function handleRelayReply(payload: RelayInboundPayload): Promise<RelayInboundResult> {
  // Case-insensitive token match: email systems routinely lowercase the
  // local-part, so a mixed-case relayToken in the reply-to
  // (onderhandel+<token>@) can come back lowercased on the provider's reply.
  // Match insensitively so the reply still routes to its negotiation.
  const negotiation = await prisma.negotiation.findFirst({
    where: { relayToken: { equals: payload.relayToken, mode: "insensitive" } },
    include: { bill: true, user: true, rounds: { orderBy: { roundNumber: "asc" } } },
  });
  // Anti-abuse: an unknown/forged token matches nothing.
  if (!negotiation) return { ok: false, reason: "no negotiation for token" };

  // Idempotency: same provider Message-ID already processed → no-op.
  if (
    payload.messageId &&
    negotiation.rounds.some((r) => r.inboundMessageId === payload.messageId)
  ) {
    return { ok: true, action: "noop" };
  }

  // Learn the provider's real reply address for subsequent relay sends.
  if (!negotiation.providerEmail && payload.from) {
    await prisma.negotiation.update({
      where: { id: negotiation.id },
      data: { providerEmail: payload.from },
    });
    negotiation.providerEmail = payload.from;
  }

  // Paused / done / awaiting → record the reply but never auto-act.
  if (negotiation.relayState !== "RELAY_ACTIVE") {
    return { ok: true, action: "noop" };
  }

  const analysis = await analyseProviderResponse(payload.text);
  const decision = relayDecision({
    analysis,
    providerText: payload.text,
    autoRoundsUsed: negotiation.relayAutoRounds,
  });

  const nextRoundNumber = negotiation.rounds.length + 1;
  const billCategory = negotiation.bill.category as BillCategory;

  if (decision.kind === "auto_counter") {
    // Routine counter — the automatic path. Generate + send on behalf.
    const comparison = buildComparison({
      provider: negotiation.bill.provider,
      category: billCategory as unknown as Category,
      amountCents: negotiation.bill.monthlyCents ?? negotiation.bill.amountCents,
      country: (negotiation.bill.country as Country | null) ?? "NL",
    });
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
        roundNumber: nextRoundNumber,
        previousOfferedCents: analysis.offeredCents,
        previousTone: analysis.tone,
      },
    });

    const sent = await sendRelayMail({
      negotiationId: negotiation.id,
      subject: draft.subject,
      body: draft.body,
      kind: "counter",
    });
    if (!sent.ok) return { ok: false, reason: sent.reason };

    const round = await prisma.negotiationRound.create({
      data: {
        negotiationId: negotiation.id,
        roundNumber: nextRoundNumber,
        providerResponse: payload.text,
        analysisJson: JSON.stringify(analysis),
        offeredCents: analysis.offeredCents,
        counterSubject: draft.subject,
        counterBody: draft.body,
        outcome: "PENDING",
        inboundMessageId: payload.messageId,
        confirmedSentAt: new Date(), // relay sent it automatically
      },
    });
    await notifyCustomer({
      email: negotiation.user.email,
      billId: negotiation.billId,
      subject: `${negotiation.bill.provider} reageerde — we counterden namens jou`,
      intro: `${negotiation.bill.provider} reageerde op je onderhandeling. We hebben namens jou automatisch een tegenvoorstel gestuurd. Je hoeft niets te doen — we houden je op de hoogte.`,
    });
    return { ok: true, action: "auto_counter", roundId: round.id };
  }

  if (decision.kind === "needs_approval") {
    // GUARDRAIL 2 — a deal/commitment/pushback/loop-guard. Hand to the
    // customer; NEVER auto-accept. Record the offer + flip to approval.
    const round = await prisma.negotiationRound.create({
      data: {
        negotiationId: negotiation.id,
        roundNumber: nextRoundNumber,
        providerResponse: payload.text,
        analysisJson: JSON.stringify(analysis),
        offeredCents: analysis.offeredCents,
        outcome: "AWAITING_USER_CONFIRM",
        inboundMessageId: payload.messageId,
      },
    });
    await prisma.negotiation.update({
      where: { id: negotiation.id },
      data: { state: "RESPONSE_RECEIVED", relayState: "AWAITING_APPROVAL" },
    });
    const offerLine =
      analysis.offeredCents != null
        ? `Provider biedt €${(analysis.offeredCents / 100).toFixed(2).replace(".", ",")}/maand` +
          (negotiation.bill.monthlyCents
            ? ` (€${(((negotiation.bill.monthlyCents - analysis.offeredCents) * 12) / 100).toFixed(0)}/jaar besparing)`
            : "")
        : "Provider deed een voorstel dat jouw goedkeuring nodig heeft";
    const reasonNote =
      decision.reason === "provider_pushback"
        ? " De provider wil dat jij zelf bevestigt — doe dit even zelf via de link."
        : decision.reason === "loop_guard"
          ? " We hebben een aantal rondes gedaan; tijd dat jij beslist."
          : "";
    await notifyCustomer({
      email: negotiation.user.email,
      billId: negotiation.billId,
      subject: `${negotiation.bill.provider}: jouw goedkeuring nodig`,
      intro: `${offerLine}. Wil je dit accepteren, doorgaan met onderhandelen, of stoppen?${reasonNote}`,
      cta: true,
    });
    return { ok: true, action: "needs_approval", roundId: round.id };
  }

  if (decision.kind === "stop") {
    await prisma.negotiationRound.create({
      data: {
        negotiationId: negotiation.id,
        roundNumber: nextRoundNumber,
        providerResponse: payload.text,
        analysisJson: JSON.stringify(analysis),
        outcome: "REJECTED",
        inboundMessageId: payload.messageId,
      },
    });
    await prisma.negotiation.update({
      where: { id: negotiation.id },
      data: { relayState: "PAUSED" },
    });
    await notifyCustomer({
      email: negotiation.user.email,
      billId: negotiation.billId,
      subject: `${negotiation.bill.provider}: onderhandeling afgewezen`,
      intro: `${negotiation.bill.provider} gaf aan niet verder te willen onderhandelen. We hebben de relay gepauzeerd — bekijk je opties.`,
    });
    return { ok: true, action: "stop" };
  }

  // noop — escalate/unclear → surface to the customer, leave state.
  await notifyCustomer({
    email: negotiation.user.email,
    billId: negotiation.billId,
    subject: `${negotiation.bill.provider} reageerde — even meekijken`,
    intro: `${negotiation.bill.provider} reageerde, maar het antwoord vraagt om jouw blik. Bekijk de thread.`,
  });
  return { ok: true, action: "noop" };
}

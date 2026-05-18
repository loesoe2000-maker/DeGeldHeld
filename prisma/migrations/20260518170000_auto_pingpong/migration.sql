-- v10 auto-pingpong: inbound provider-reply detection + counter-mail
-- confirmation flow.

-- Extend RoundOutcome with AWAITING_USER_CONFIRM state.
ALTER TYPE "RoundOutcome" ADD VALUE IF NOT EXISTS 'AWAITING_USER_CONFIRM';

-- Per-negotiation email thread-id so Resend inbound webhook can match
-- a provider's reply to the correct negotiation.
ALTER TABLE "Negotiation" ADD COLUMN "providerThreadId" TEXT;
CREATE UNIQUE INDEX "Negotiation_providerThreadId_key" ON "Negotiation"("providerThreadId");

-- Inbound mail metadata + confirm-send bookkeeping on NegotiationRound.
ALTER TABLE "NegotiationRound" ADD COLUMN "inboundMessageId" TEXT;
ALTER TABLE "NegotiationRound" ADD COLUMN "inboundReplyTo" TEXT;
ALTER TABLE "NegotiationRound" ADD COLUMN "confirmedSentAt" TIMESTAMP(3);

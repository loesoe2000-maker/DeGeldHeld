-- v11 revenue verification — bewijsstuk-flow vóór een claim als
-- "geverifieerde besparing" telt.

-- Extend NegotiationState with verification + billing states.
ALTER TYPE "NegotiationState" ADD VALUE IF NOT EXISTS 'SUCCESS_UNVERIFIED';
ALTER TYPE "NegotiationState" ADD VALUE IF NOT EXISTS 'BILLED_PENDING_PAYMENT';
ALTER TYPE "NegotiationState" ADD VALUE IF NOT EXISTS 'BILLED_OVERDUE';

-- Per-Negotiation proof bookkeeping.
ALTER TABLE "Negotiation"
  ADD COLUMN "proofRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "proofVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "feeInvoicedAt" TIMESTAMP(3),
  ADD COLUMN "feeAmountCents" INTEGER;

-- New OutcomeProof table.
CREATE TABLE "OutcomeProof" (
    "id" TEXT NOT NULL,
    "negotiationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storageUrl" TEXT,
    "parsedAmountCents" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "verifierNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutcomeProof_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutcomeProof_negotiationId_idx" ON "OutcomeProof"("negotiationId");
CREATE INDEX "OutcomeProof_verificationStatus_idx" ON "OutcomeProof"("verificationStatus");
ALTER TABLE "OutcomeProof"
  ADD CONSTRAINT "OutcomeProof_negotiationId_fkey"
  FOREIGN KEY ("negotiationId") REFERENCES "Negotiation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

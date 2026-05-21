-- v19 auto no-cure-no-pay: off-session charge bookkeeping.
ALTER TYPE "NegotiationState" ADD VALUE IF NOT EXISTS 'FEE_PAID';

ALTER TABLE "Negotiation" ADD COLUMN     "feePaidAt" TIMESTAMP(3);
ALTER TABLE "Negotiation" ADD COLUMN     "feePaymentIntentId" TEXT;

-- v18: Stripe webhook hardening — idempotency table + audit-trail
-- event id + subscription identifiers on User.

CREATE TABLE "ProcessedStripeEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProcessedStripeEvent_processedAt_idx" ON "ProcessedStripeEvent"("processedAt");

ALTER TABLE "Payment" ADD COLUMN "stripeEventId" TEXT;

ALTER TABLE "User"
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT;
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

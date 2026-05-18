-- v11 anti-fraud + audit logging

-- User suspend bookkeeping
ALTER TABLE "User"
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedReason" TEXT;

-- FraudFlag — scored detection rows persisted by the daily cron.
CREATE TABLE "FraudFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FraudFlag_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FraudFlag_userId_idx" ON "FraudFlag"("userId");
CREATE INDEX "FraudFlag_resolved_createdAt_idx" ON "FraudFlag"("resolved", "createdAt");
ALTER TABLE "FraudFlag"
  ADD CONSTRAINT "FraudFlag_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

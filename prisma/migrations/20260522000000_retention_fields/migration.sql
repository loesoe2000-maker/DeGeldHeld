-- v21 retention engine — anti-spam foundation + contract-end radar.

-- User: opt-out + unsubscribe token + per-type idempotency timestamps.
ALTER TABLE "User" ADD COLUMN     "marketingOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN     "unsubscribeToken" TEXT;
ALTER TABLE "User" ADD COLUMN     "lastNudgeAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "lastMonthlyReportAt" TIMESTAMP(3);

-- Bill: contract-end radar.
ALTER TABLE "Bill" ADD COLUMN     "contractEndDate" TIMESTAMP(3);
ALTER TABLE "Bill" ADD COLUMN     "contractAlertSentAt" TIMESTAMP(3);

-- Unique unsubscribe token (nullable, so a partial unique index).
CREATE UNIQUE INDEX "User_unsubscribeToken_key" ON "User"("unsubscribeToken");

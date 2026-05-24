-- v30: Box 3 proof-back NCNP-loop (Box3Claim) + Plus monthly rescans (PlusRescan).
-- AVG-grondslag: noodzakelijk voor uitvoering NCNP-overeenkomst (zie V30_REPORT.md).

-- Box3Claim — INTENT | AWAITING_PROOF | PROOF_RECEIVED | CHARGED | FAILED
CREATE TABLE "Box3Claim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jaar" INTEGER NOT NULL,
    "verwachteTeruggaveCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "werkelijkTeruggaveCents" INTEGER,
    "proofStorageUrl" TEXT,
    "proofUploadedAt" TIMESTAMP(3),
    "chargedAt" TIMESTAMP(3),
    "feeCents" INTEGER,
    "stripePaymentIntentId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Box3Claim_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Box3Claim_userId_status_idx" ON "Box3Claim"("userId", "status");
CREATE INDEX "Box3Claim_status_createdAt_idx" ON "Box3Claim"("status", "createdAt");

ALTER TABLE "Box3Claim" ADD CONSTRAINT "Box3Claim_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PlusRescan — monthly cron output per user
CREATE TABLE "PlusRescan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "findingsJson" JSONB NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    CONSTRAINT "PlusRescan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlusRescan_userId_runAt_idx" ON "PlusRescan"("userId", "runAt");

ALTER TABLE "PlusRescan" ADD CONSTRAINT "PlusRescan_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "HuurServicekostenClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "boekjaar" INTEGER NOT NULL,
    "verhuurderNaam" TEXT,
    "verwachteRestitutieCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "werkelijkeRestitutieCents" INTEGER,
    "uitspraakStorageUrl" TEXT,
    "uitspraakUploadedAt" TIMESTAMP(3),
    "chargedAt" TIMESTAMP(3),
    "feeCents" INTEGER,
    "stripePaymentIntentId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuurServicekostenClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergieEindafrekeningClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "verwachteRestitutieCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "werkelijkeRestitutieCents" INTEGER,
    "uitspraakStorageUrl" TEXT,
    "uitspraakUploadedAt" TIMESTAMP(3),
    "chargedAt" TIMESTAMP(3),
    "feeCents" INTEGER,
    "stripePaymentIntentId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnergieEindafrekeningClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "resolvedRef" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HuurServicekostenClaim_userId_status_idx" ON "HuurServicekostenClaim"("userId", "status");

-- CreateIndex
CREATE INDEX "HuurServicekostenClaim_status_createdAt_idx" ON "HuurServicekostenClaim"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EnergieEindafrekeningClaim_userId_status_idx" ON "EnergieEindafrekeningClaim"("userId", "status");

-- CreateIndex
CREATE INDEX "EnergieEindafrekeningClaim_status_createdAt_idx" ON "EnergieEindafrekeningClaim"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAction_adminEmail_createdAt_idx" ON "AdminAction"("adminEmail", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAction_targetType_targetId_idx" ON "AdminAction"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_stripeEventId_idx" ON "StripeWebhookEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_type_receivedAt_idx" ON "StripeWebhookEvent"("type", "receivedAt");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_outcome_receivedAt_idx" ON "StripeWebhookEvent"("outcome", "receivedAt");

-- AddForeignKey
ALTER TABLE "HuurServicekostenClaim" ADD CONSTRAINT "HuurServicekostenClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergieEindafrekeningClaim" ADD CONSTRAINT "EnergieEindafrekeningClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

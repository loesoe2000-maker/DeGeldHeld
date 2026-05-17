-- CreateTable: BankConnection
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BankConnection_userId_idx" ON "BankConnection"("userId");
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: DetectedRecurring
CREATE TABLE "DetectedRecurring" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankConnectionId" TEXT,
    "counterpartyName" TEXT NOT NULL,
    "monthlyCents" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OVERIG',
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 2,
    "convertedBillId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DetectedRecurring_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DetectedRecurring_userId_idx" ON "DetectedRecurring"("userId");
CREATE INDEX "DetectedRecurring_userId_convertedBillId_idx" ON "DetectedRecurring"("userId", "convertedBillId");
ALTER TABLE "DetectedRecurring" ADD CONSTRAINT "DetectedRecurring_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

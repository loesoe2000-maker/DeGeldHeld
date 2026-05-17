-- AlterTable
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "usedById" TEXT,
    "usedAt" TIMESTAMP(3),
    "rewardCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_code_key" ON "Referral"("code");

-- CreateIndex
CREATE INDEX "Referral_ownerId_idx" ON "Referral"("ownerId");

-- CreateIndex
CREATE INDEX "Referral_code_idx" ON "Referral"("code");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

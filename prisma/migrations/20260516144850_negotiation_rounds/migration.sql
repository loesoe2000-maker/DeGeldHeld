-- CreateEnum
CREATE TYPE "RoundOutcome" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'ESCALATED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NegotiationState" ADD VALUE 'EMAIL_SENT';
ALTER TYPE "NegotiationState" ADD VALUE 'RESPONSE_RECEIVED';
ALTER TYPE "NegotiationState" ADD VALUE 'COUNTER_SENT';
ALTER TYPE "NegotiationState" ADD VALUE 'ACCEPTED';
ALTER TYPE "NegotiationState" ADD VALUE 'REJECTED';

-- CreateTable
CREATE TABLE "NegotiationRound" (
    "id" TEXT NOT NULL,
    "negotiationId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "providerResponse" TEXT,
    "responseOcrText" TEXT,
    "analysisJson" TEXT,
    "offeredCents" INTEGER,
    "counterSubject" TEXT,
    "counterBody" TEXT,
    "outcome" "RoundOutcome" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegotiationRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NegotiationRound_negotiationId_idx" ON "NegotiationRound"("negotiationId");

-- CreateIndex
CREATE UNIQUE INDEX "NegotiationRound_negotiationId_roundNumber_key" ON "NegotiationRound"("negotiationId", "roundNumber");

-- AddForeignKey
ALTER TABLE "NegotiationRound" ADD CONSTRAINT "NegotiationRound_negotiationId_fkey" FOREIGN KEY ("negotiationId") REFERENCES "Negotiation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ProviderCandidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "retentionJson" TEXT NOT NULL,
    "status" "CandidateStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderCandidate_status_idx" ON "ProviderCandidate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCandidate_name_country_key" ON "ProviderCandidate"("name", "country");

-- v17: persist category-specific OCR fields on Bill so the analyse
-- page compares against the user's real invoice, not hardcoded
-- market medians. All nullable.

ALTER TABLE "Bill"
  ADD COLUMN "energyKwhRateCents" INTEGER,
  ADD COLUMN "energyM3RateCents" INTEGER,
  ADD COLUMN "energyContractType" TEXT,
  ADD COLUMN "insuranceCoverage" TEXT,
  ADD COLUMN "insuranceDeductibleCents" INTEGER,
  ADD COLUMN "mortgageInterestPct" DOUBLE PRECISION,
  ADD COLUMN "mortgageTermYears" INTEGER,
  ADD COLUMN "bankAccountTier" TEXT,
  ADD COLUMN "streamingTier" TEXT;

-- v13 DEEL 7 — optionele subscription als alternatief voor
-- no-cure-no-pay fee. Drie velden, alle nullable.

ALTER TABLE "User"
  ADD COLUMN "subscriptionStatus" TEXT,
  ADD COLUMN "subscriptionPlan" TEXT,
  ADD COLUMN "subscriptionRenewsAt" TIMESTAMP(3);

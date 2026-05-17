-- DEEL 10 — paywall: add Bill.position + Bill.paidAt
ALTER TABLE "Bill" ADD COLUMN     "paidAt" TIMESTAMP(3);
ALTER TABLE "Bill" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill position by createdAt rank per user, so existing users
-- keep their original "first upload is free" status.
UPDATE "Bill" b
SET "position" = sub.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" ASC) AS rn
  FROM "Bill"
) sub
WHERE b.id = sub.id;

CREATE INDEX "Bill_userId_createdAt_idx" ON "Bill"("userId", "createdAt");

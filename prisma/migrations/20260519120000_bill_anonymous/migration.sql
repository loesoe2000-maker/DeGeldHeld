-- v15 DEEL 1 — anonymous bill upload.
-- userId becomes nullable so visitors can upload before signup.
-- Anonymous bills carry anonymousSessionId (cookie value) until
-- claimed on magic-link signup.

ALTER TABLE "Bill" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Bill" ADD COLUMN "anonymousSessionId" TEXT;
ALTER TABLE "Bill" ADD COLUMN "claimedAt" TIMESTAMP(3);

CREATE INDEX "Bill_anonymousSessionId_idx" ON "Bill"("anonymousSessionId");

-- Drop existing FK and re-add as nullable so the constraint matches
-- the now-nullable column.
ALTER TABLE "Bill" DROP CONSTRAINT IF EXISTS "Bill_userId_fkey";
ALTER TABLE "Bill"
  ADD CONSTRAINT "Bill_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

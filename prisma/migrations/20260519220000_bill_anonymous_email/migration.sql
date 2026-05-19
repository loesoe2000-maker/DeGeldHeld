ALTER TABLE "Bill" ADD COLUMN "anonymousEmail" TEXT;
CREATE INDEX "Bill_anonymousEmail_idx" ON "Bill"("anonymousEmail");

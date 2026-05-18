-- v10 categories-v2: subType column op Bill. String voor flexibiliteit.
-- Bestaande Bills krijgen NULL — backfill via scripts/migrate-categories-v2.ts.

ALTER TABLE "Bill" ADD COLUMN "subType" TEXT;

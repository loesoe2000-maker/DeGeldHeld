-- v3.1: invoiceDate (parsed) for stale-warning on /onderhandel/analyse.
ALTER TABLE "Bill" ADD COLUMN IF NOT EXISTS "invoiceDate" TIMESTAMP(3);

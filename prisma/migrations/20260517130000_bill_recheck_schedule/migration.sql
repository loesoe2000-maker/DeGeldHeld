-- AlterTable
ALTER TABLE "Bill" ADD COLUMN "lastRecheckAt" TIMESTAMP(3);
ALTER TABLE "Bill" ADD COLUMN "nextRecheckAt" TIMESTAMP(3);
ALTER TABLE "Bill" ADD COLUMN "lastRecheckMailAt" TIMESTAMP(3);

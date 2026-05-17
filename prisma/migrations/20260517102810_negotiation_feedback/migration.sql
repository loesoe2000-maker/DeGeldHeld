-- AlterTable
ALTER TABLE "Negotiation" ADD COLUMN     "mailUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "providerResponded" BOOLEAN,
ADD COLUMN     "userRating" INTEGER;

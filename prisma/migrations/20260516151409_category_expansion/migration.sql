-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BillCategory" ADD VALUE 'WATER';
ALTER TYPE "BillCategory" ADD VALUE 'GEMEENTE';
ALTER TYPE "BillCategory" ADD VALUE 'STREAMING';
ALTER TYPE "BillCategory" ADD VALUE 'GYM';
ALTER TYPE "BillCategory" ADD VALUE 'OV';
ALTER TYPE "BillCategory" ADD VALUE 'SOFTWARE';
ALTER TYPE "BillCategory" ADD VALUE 'OPSLAG';

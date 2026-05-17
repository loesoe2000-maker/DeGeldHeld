-- AlterTable: User GDPR + prefs
ALTER TABLE "User" ADD COLUMN "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "ocrTrainingOptIn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Bill soft-delete
ALTER TABLE "Bill" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OcrTrainingSample" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "imageStorageUrl" TEXT,
    "anonymizedJson" TEXT NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewerUserId" TEXT,
    "billCategory" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OcrTrainingSample_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OcrTrainingSample_reviewed_idx" ON "OcrTrainingSample"("reviewed");
CREATE INDEX "OcrTrainingSample_billCategory_idx" ON "OcrTrainingSample"("billCategory");

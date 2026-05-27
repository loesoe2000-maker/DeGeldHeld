-- v36 idee 4 — UserDocument-vault. Klant uploadt huurcontract / aangifte /
-- beschikking / etc. één keer en hergebruikt deze in elke check of claim.
-- AVG-grondslag: art. 6 lid 1b (uitvoering NCNP-overeenkomst). Bewaartermijn
-- standaard tot account-deletion, voor fiscaal-relevante stukken 7 jaar.

CREATE TABLE "UserDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserDocument_userId_createdAt_idx" ON "UserDocument"("userId", "createdAt");
CREATE INDEX "UserDocument_userId_kind_idx" ON "UserDocument"("userId", "kind");

ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

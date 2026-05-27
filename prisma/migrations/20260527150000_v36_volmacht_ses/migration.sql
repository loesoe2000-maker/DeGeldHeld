-- v36 idee 2 — Digitale volmacht (SES — Simple Electronic Signature).
-- Eén ondertekend mandaat per claim met IP-hash + timestamp + accepted-text.
-- eIDAS-laagste niveau. Geldig voor huurcommissie + energie-claim
-- correspondentie; voor Box 3 is DigiD vereist (Belastingdienst).
-- AVG-grondslag: art. 6 lid 1b (uitvoering NCNP). Bewaartermijn 7 jaar
-- (financiële administratie / juridische audit-trail).

CREATE TABLE "Volmacht" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "mandateText" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "Volmacht_pkey" PRIMARY KEY ("id")
);

-- Eén actieve volmacht per (claimType, claimId)-paar.
CREATE UNIQUE INDEX "Volmacht_claimType_claimId_key" ON "Volmacht"("claimType", "claimId");
CREATE INDEX "Volmacht_userId_signedAt_idx" ON "Volmacht"("userId", "signedAt");

ALTER TABLE "Volmacht" ADD CONSTRAINT "Volmacht_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

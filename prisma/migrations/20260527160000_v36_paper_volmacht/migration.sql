-- v36 idee 2 — papier-volmacht ondersteuning.
-- Huurcommissie + Geschillencommissie Energie eisen een schriftelijke
-- ondertekende machtiging. SES alleen is onvoldoende. Klant downloadt
-- een voorgevuld PDF-formulier, ondertekent met de hand, en uploadt de
-- scan/foto terug — die wordt hier vastgelegd naast de SES-audit-trail.

ALTER TABLE "Volmacht" ADD COLUMN "signedDocumentUrl" TEXT;
ALTER TABLE "Volmacht" ADD COLUMN "signedDocumentFilename" TEXT;
ALTER TABLE "Volmacht" ADD COLUMN "signedDocumentUploadedAt" TIMESTAMP(3);
ALTER TABLE "Volmacht" ADD COLUMN "zaakIdentifier" TEXT;

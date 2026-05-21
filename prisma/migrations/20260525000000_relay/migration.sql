-- v23 relay (negotiate-on-behalf): consent + token + state on Negotiation.
ALTER TABLE "Negotiation" ADD COLUMN     "relayAuthorizedAt" TIMESTAMP(3);
ALTER TABLE "Negotiation" ADD COLUMN     "relayAuthText" TEXT;
ALTER TABLE "Negotiation" ADD COLUMN     "relayToken" TEXT;
ALTER TABLE "Negotiation" ADD COLUMN     "relayState" TEXT;
ALTER TABLE "Negotiation" ADD COLUMN     "relayAutoRounds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Negotiation" ADD COLUMN     "providerEmail" TEXT;

CREATE UNIQUE INDEX "Negotiation_relayToken_key" ON "Negotiation"("relayToken");

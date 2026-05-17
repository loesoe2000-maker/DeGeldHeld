-- CreateTable: WhatsAppThread
CREATE TABLE "WhatsAppThread" (
    "id" TEXT NOT NULL,
    "negotiationId" TEXT NOT NULL,
    "providerNumber" TEXT NOT NULL,
    "ourNumber" TEXT NOT NULL,
    "userPhoneNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppThread_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsAppThread_negotiationId_key" ON "WhatsAppThread"("negotiationId");
CREATE INDEX "WhatsAppThread_providerNumber_idx" ON "WhatsAppThread"("providerNumber");
ALTER TABLE "WhatsAppThread" ADD CONSTRAINT "WhatsAppThread_negotiationId_fkey"
  FOREIGN KEY ("negotiationId") REFERENCES "Negotiation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: WhatsAppMessage
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "pendingApproval" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WhatsAppMessage_threadId_idx" ON "WhatsAppMessage"("threadId");
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "WhatsAppThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

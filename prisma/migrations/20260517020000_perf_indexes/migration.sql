-- DEEL 11 perf: composite index for cron + dashboard queries
CREATE INDEX "Negotiation_state_emailSentAt_idx" ON "Negotiation"("state", "emailSentAt");

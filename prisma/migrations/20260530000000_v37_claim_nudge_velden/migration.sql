-- v37 — deadline-nudge idempotentie-velden op huur + energie claims.
-- lastNudgeKind: welke nudge laatst verstuurd (intent-stil / reactie-verlopen /
-- behandeling-traag) zodat de dagelijkse cron 'm niet herhaalt. lastNudgeAt:
-- timestamp voor audit.

ALTER TABLE "HuurServicekostenClaim" ADD COLUMN "lastNudgeKind" TEXT;
ALTER TABLE "HuurServicekostenClaim" ADD COLUMN "lastNudgeAt" TIMESTAMP(3);

ALTER TABLE "EnergieEindafrekeningClaim" ADD COLUMN "lastNudgeKind" TEXT;
ALTER TABLE "EnergieEindafrekeningClaim" ADD COLUMN "lastNudgeAt" TIMESTAMP(3);

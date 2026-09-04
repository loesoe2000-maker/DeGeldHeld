-- v40 F4 — kalibratie-logboek huurprijs-check.
-- Bewaart per proefzaak onze voorspelling naast de werkelijkheid: eerst de
-- officiele Huurprijscheck (direct beschikbaar → lanceer-gate), later de
-- uitspraak van de Huurcommissie (4-6 maanden → doorlopende kalibratie).
-- inputJson maakt elke case reproduceerbaar als de rekenlib wijzigt.

CREATE TABLE "HuurprijsPilotCase" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "onzePunten" INTEGER NOT NULL,
    "onzePuntenRuim" INTEGER NOT NULL,
    "onzeMaxHuurCents" INTEGER,
    "onsVerdict" TEXT NOT NULL,
    "onzeRoute" TEXT NOT NULL,
    "kaleHuurCents" INTEGER NOT NULL,
    "officieelPunten" INTEGER,
    "officieelMaxHuurCents" INTEGER,
    "officieelGecheckWhen" TIMESTAMP(3),
    "uitspraakUitkomst" TEXT,
    "uitspraakPunten" INTEGER,
    "uitspraakVerlagingCents" INTEGER,
    "uitspraakDatum" TIMESTAMP(3),
    "intakeNotitie" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuurprijsPilotCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HuurprijsPilotCase_createdAt_idx" ON "HuurprijsPilotCase"("createdAt");

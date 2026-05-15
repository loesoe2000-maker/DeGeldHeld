-- v3.1: split monthly subscription vs invoice total on Bill.
-- monthlyCents = vast maand-abonnement (voor markt-vergelijking)
-- totalCents   = factuur-totaal incl. eenmalige posten
ALTER TABLE "Bill" ADD COLUMN IF NOT EXISTS "monthlyCents" INTEGER;
ALTER TABLE "Bill" ADD COLUMN IF NOT EXISTS "totalCents" INTEGER;

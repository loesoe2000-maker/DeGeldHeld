-- Add BANK to BillCategory enum (v3 — bank as separate category for ABN/ING/Rabo/SNS/Knab/Bunq etc.)
ALTER TYPE "BillCategory" ADD VALUE IF NOT EXISTS 'BANK';

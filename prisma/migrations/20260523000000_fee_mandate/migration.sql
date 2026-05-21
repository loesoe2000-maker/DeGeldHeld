-- v19 auto no-cure-no-pay: saved card + recorded mandate consent on User.
ALTER TABLE "User" ADD COLUMN     "feePaymentMethodId" TEXT;
ALTER TABLE "User" ADD COLUMN     "feeMandateAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "feeMandateText" TEXT;

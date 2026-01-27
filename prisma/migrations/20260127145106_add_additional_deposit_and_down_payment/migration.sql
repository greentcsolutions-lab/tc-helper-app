-- AlterTable
ALTER TABLE "calendar_settings" ADD COLUMN     "disconnectedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "parses" ADD COLUMN     "additionalDeposit" JSONB,
ADD COLUMN     "downPaymentAmount" TEXT;

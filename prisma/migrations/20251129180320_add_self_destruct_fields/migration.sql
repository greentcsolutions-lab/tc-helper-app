-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('PENDING', 'NEEDS_REVIEW', 'COMPLETED');

-- AlterTable
ALTER TABLE "parses" ADD COLUMN     "criticalPageNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ParseStatus" NOT NULL DEFAULT 'PENDING';

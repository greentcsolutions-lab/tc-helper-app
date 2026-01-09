-- AlterTable
ALTER TABLE "users" ADD COLUMN "name" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "role" TEXT,
ADD COLUMN "problems" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "referralSource" TEXT;

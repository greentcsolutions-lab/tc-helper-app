/*
  Warnings:

  - Added the required column `updatedAt` to the `parses` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "parses" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "highResZipKey" TEXT,
ADD COLUMN     "highResZipUrl" TEXT,
ADD COLUMN     "lowResZipKey" TEXT,
ADD COLUMN     "lowResZipUrl" TEXT,
ADD COLUMN     "pageCount" INTEGER,
ADD COLUMN     "renderZipKey" TEXT,
ADD COLUMN     "renderZipUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "state" SET DEFAULT 'Unknown',
ALTER COLUMN "rawJson" SET DEFAULT '{}',
ALTER COLUMN "formatted" SET DEFAULT '{}',
ALTER COLUMN "status" SET DEFAULT 'PROCESSING';

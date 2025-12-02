/*
  Warnings:

  - The `status` column on the `parses` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "parses" ADD COLUMN     "pdfBuffer" BYTEA,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "ParseStatus";

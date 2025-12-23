-- CreateMigration: Add Phase 1 dual-DPI storage fields
-- Version: 1.0.0 - 2025-12-23
-- Purpose: Support parallel rendering architecture with selective high-res extraction

-- Add new dual-DPI storage fields
ALTER TABLE "parses" ADD COLUMN "lowResZipUrl" TEXT;
ALTER TABLE "parses" ADD COLUMN "lowResZipKey" TEXT;
ALTER TABLE "parses" ADD COLUMN "highResZipUrl" TEXT;
ALTER TABLE "parses" ADD COLUMN "highResZipKey" TEXT;

-- Add page count field (moved from classification to render phase)
-- ALTER TABLE "parses" ADD COLUMN "pageCount" INTEGER; -- Already exists from previous migration

-- Add comment to deprecated fields (informational only - PostgreSQL doesn't support column comments in ALTER)
COMMENT ON COLUMN "parses"."renderZipUrl" IS 'DEPRECATED: Use lowResZipUrl/highResZipUrl instead (Phase 1+)';
COMMENT ON COLUMN "parses"."renderZipKey" IS 'DEPRECATED: Use lowResZipKey/highResZipKey instead (Phase 1+)';
COMMENT ON COLUMN "parses"."pdfBuffer" IS 'DEPRECATED: Deleted after parallel render completes (Phase 1+)';
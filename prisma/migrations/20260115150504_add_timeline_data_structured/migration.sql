-- AlterTable: Add timelineDataStructured column to parses table
-- This is a SAFE migration that only ADDS a column (does not drop or modify existing data)
ALTER TABLE "parses" ADD COLUMN "timelineDataStructured" JSONB;

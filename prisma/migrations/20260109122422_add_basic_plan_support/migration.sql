-- Safe migration: Only add columns if they don't exist

-- Add planType if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'planType') THEN
        ALTER TABLE "users" ADD COLUMN "planType" TEXT NOT NULL DEFAULT 'FREE';
    END IF;
END $$;

-- Add parseLimit if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'parseLimit') THEN
        ALTER TABLE "users" ADD COLUMN "parseLimit" INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

-- Add parseCount if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'parseCount') THEN
        ALTER TABLE "users" ADD COLUMN "parseCount" INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add parseResetDate if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'parseResetDate') THEN
        ALTER TABLE "users" ADD COLUMN "parseResetDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Add archived to parses if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'parses' AND column_name = 'archived') THEN
        ALTER TABLE "parses" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Add archived to tasks if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'tasks' AND column_name = 'archived') THEN
        ALTER TABLE "tasks" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

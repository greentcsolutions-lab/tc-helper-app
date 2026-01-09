-- Safe migration: Only add onboarding columns if they don't exist

-- Add name if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'name') THEN
        ALTER TABLE "users" ADD COLUMN "name" TEXT;
    END IF;
END $$;

-- Add phone if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE "users" ADD COLUMN "phone" TEXT;
    END IF;
END $$;

-- Add role if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE "users" ADD COLUMN "role" TEXT;
    END IF;
END $$;

-- Add problems if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'problems') THEN
        ALTER TABLE "users" ADD COLUMN "problems" TEXT[] DEFAULT ARRAY[]::TEXT[];
    END IF;
END $$;

-- Add referralSource if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'referralSource') THEN
        ALTER TABLE "users" ADD COLUMN "referralSource" TEXT;
    END IF;
END $$;

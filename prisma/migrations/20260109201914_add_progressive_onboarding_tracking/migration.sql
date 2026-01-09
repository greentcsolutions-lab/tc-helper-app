-- Safe migration: Only add progressive onboarding tracking columns if they don't exist

-- Add onboardingDismissedCount if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'onboardingDismissedCount') THEN
        ALTER TABLE "users" ADD COLUMN "onboardingDismissedCount" INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add onboardingOptedOut if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'onboardingOptedOut') THEN
        ALTER TABLE "users" ADD COLUMN "onboardingOptedOut" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Add lastOnboardingPrompt if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'lastOnboardingPrompt') THEN
        ALTER TABLE "users" ADD COLUMN "lastOnboardingPrompt" TIMESTAMP(3);
    END IF;
END $$;

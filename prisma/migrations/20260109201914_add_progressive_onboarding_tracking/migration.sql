-- AlterTable
ALTER TABLE "users" ADD COLUMN "onboardingDismissedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "onboardingOptedOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastOnboardingPrompt" TIMESTAMP(3);

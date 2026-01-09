-- AlterTable: Add subscription and usage tracking fields to users
ALTER TABLE "users" ADD COLUMN "planType" TEXT NOT NULL DEFAULT 'FREE';
ALTER TABLE "users" ADD COLUMN "parseLimit" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "users" ADD COLUMN "parseCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "parseResetDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Add archived field to parses
ALTER TABLE "parses" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add archived field to tasks
ALTER TABLE "tasks" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

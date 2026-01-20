/*
  Warnings:

  - You are about to drop the column `lastSyncAt` on the `calendar_settings` table. All the data in the column will be lost.
  - You are about to drop the column `dueDateType` on the `user_task_templates` table. All the data in the column will be lost.
  - You are about to drop the column `dueDateValue` on the `user_task_templates` table. All the data in the column will be lost.
  - You are about to drop the column `isDefaultForAll` on the `user_task_templates` table. All the data in the column will be lost.
  - You are about to drop the column `isDefaultForBuyerSide` on the `user_task_templates` table. All the data in the column will be lost.
  - You are about to drop the column `isDefaultForListings` on the `user_task_templates` table. All the data in the column will be lost.
  - You are about to drop the column `taskTypes` on the `user_task_templates` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `user_task_templates` table. All the data in the column will be lost.
  - Added the required column `name` to the `user_task_templates` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "tasks_timelineEventKey_idx";

-- AlterTable
ALTER TABLE "calendar_settings" DROP COLUMN "lastSyncAt",
ADD COLUMN     "lastSyncStatus" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "nextSyncToken" TEXT;

-- AlterTable
ALTER TABLE "parses" ADD COLUMN     "pdfPublicUrl" TEXT,
ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "assignedToRole" TEXT,
ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "user_task_templates" DROP COLUMN "dueDateType",
DROP COLUMN "dueDateValue",
DROP COLUMN "isDefaultForAll",
DROP COLUMN "isDefaultForBuyerSide",
DROP COLUMN "isDefaultForListings",
DROP COLUMN "taskTypes",
DROP COLUMN "title",
ADD COLUMN     "fileType" TEXT NOT NULL DEFAULT 'escrow',
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "tasks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "templateCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "quota" SET DEFAULT 1;

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clerkOrgId" TEXT,
    "planType" TEXT NOT NULL DEFAULT 'TEAMS',
    "maxMembers" INTEGER NOT NULL DEFAULT 5,
    "quota" INTEGER NOT NULL DEFAULT 10,
    "credits" INTEGER NOT NULL DEFAULT 10,
    "parseLimit" INTEGER NOT NULL DEFAULT 10,
    "parseCount" INTEGER NOT NULL DEFAULT 0,
    "parseResetDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "priceId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_clerkOrgId_key" ON "teams"("clerkOrgId");

-- CreateIndex
CREATE INDEX "teams_clerkOrgId_idx" ON "teams"("clerkOrgId");

-- CreateIndex
CREATE INDEX "team_members_teamId_idx" ON "team_members"("teamId");

-- CreateIndex
CREATE INDEX "team_members_userId_idx" ON "team_members"("userId");

-- CreateIndex
CREATE INDEX "team_members_clerkUserId_idx" ON "team_members"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_userId_key" ON "team_members"("teamId", "userId");

-- AddForeignKey
ALTER TABLE "parses" ADD CONSTRAINT "parses_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_task_templates" ADD CONSTRAINT "user_task_templates_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

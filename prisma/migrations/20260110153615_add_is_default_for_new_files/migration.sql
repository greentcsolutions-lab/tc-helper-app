-- AlterTable
ALTER TABLE "user_task_templates" ADD COLUMN IF NOT EXISTS "isDefaultForNewFiles" BOOLEAN NOT NULL DEFAULT false;

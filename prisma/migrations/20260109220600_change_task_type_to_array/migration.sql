-- AlterTable tasks: Change taskType (String) to taskTypes (String[])
-- Step 1: Add new taskTypes column
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "taskTypes" TEXT[];

-- Step 2: Migrate existing data from taskType to taskTypes (convert single value to array)
UPDATE "tasks" SET "taskTypes" = ARRAY["taskType"]::TEXT[] WHERE "taskTypes" IS NULL;

-- Step 3: Drop old taskType column
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "taskType";

-- AlterTable user_task_templates: Change taskType (String) to taskTypes (String[])
-- Step 1: Add new taskTypes column
ALTER TABLE "user_task_templates" ADD COLUMN IF NOT EXISTS "taskTypes" TEXT[];

-- Step 2: Migrate existing data from taskType to taskTypes (convert single value to array)
UPDATE "user_task_templates" SET "taskTypes" = ARRAY["taskType"]::TEXT[] WHERE "taskTypes" IS NULL;

-- Step 3: Drop old taskType column
ALTER TABLE "user_task_templates" DROP COLUMN IF EXISTS "taskType";

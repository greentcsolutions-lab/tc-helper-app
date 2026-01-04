-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parseId" TEXT,
    "taskType" TEXT NOT NULL,
    "timelineEventId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "propertyAddress" TEXT,
    "amount" DOUBLE PRECISION,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "dueDateType" TEXT NOT NULL DEFAULT 'specific',
    "dueDateValue" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "columnId" TEXT NOT NULL DEFAULT 'not_started',
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_task_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskType" TEXT NOT NULL,
    "isDefaultForAll" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultForListings" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultForBuyerSide" BOOLEAN NOT NULL DEFAULT false,
    "dueDateType" TEXT NOT NULL DEFAULT 'days_after_acceptance',
    "dueDateValue" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_task_templates_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "customTaskCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "tasks_userId_parseId_idx" ON "tasks"("userId", "parseId");

-- CreateIndex
CREATE INDEX "tasks_userId_status_idx" ON "tasks"("userId", "status");

-- CreateIndex
CREATE INDEX "tasks_userId_dueDate_idx" ON "tasks"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "user_task_templates_userId_idx" ON "user_task_templates"("userId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parseId_fkey" FOREIGN KEY ("parseId") REFERENCES "parses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_task_templates" ADD CONSTRAINT "user_task_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

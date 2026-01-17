-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "timelineEventKey" TEXT;

-- CreateIndex
CREATE INDEX "tasks_timelineEventKey_idx" ON "tasks"("timelineEventKey");

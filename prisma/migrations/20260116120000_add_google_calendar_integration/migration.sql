-- AlterTable: Add Google Calendar sync columns to tasks (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='googleCalendarEventId') THEN
    ALTER TABLE "tasks" ADD COLUMN "googleCalendarEventId" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='syncedToCalendar') THEN
    ALTER TABLE "tasks" ADD COLUMN "syncedToCalendar" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='lastSyncedAt') THEN
    ALTER TABLE "tasks" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
  END IF;
END $$;

-- CreateTable: Only create if doesn't exist
CREATE TABLE IF NOT EXISTS "calendar_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "googleTokenExpiry" TIMESTAMP(3),
    "primaryCalendarId" TEXT,
    "archivedCalendarId" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "includeFullDetails" BOOLEAN NOT NULL DEFAULT true,
    "syncNonAppEvents" BOOLEAN NOT NULL DEFAULT true,
    "excludeFinancialData" BOOLEAN NOT NULL DEFAULT true,
    "webhookChannelId" TEXT,
    "webhookResourceId" TEXT,
    "webhookExpiration" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "initialSyncCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Only create if doesn't exist
CREATE TABLE IF NOT EXISTS "calendar_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "isAppEvent" BOOLEAN NOT NULL DEFAULT false,
    "matchedPropertyAddress" TEXT,
    "inferredTaskTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Only create if doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_settings_userId_key" ON "calendar_settings"("userId");

-- CreateIndex: Only create if doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_events_googleEventId_key" ON "calendar_events"("googleEventId");

-- CreateIndex: Only create if doesn't exist
CREATE INDEX IF NOT EXISTS "calendar_events_userId_isAppEvent_idx" ON "calendar_events"("userId", "isAppEvent");

-- CreateIndex: Only create if doesn't exist
CREATE INDEX IF NOT EXISTS "calendar_events_userId_start_idx" ON "calendar_events"("userId", "start");

-- CreateIndex: Only create if doesn't exist
CREATE INDEX IF NOT EXISTS "calendar_events_googleEventId_idx" ON "calendar_events"("googleEventId");

-- CreateIndex: Only create if doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_googleCalendarEventId_key" ON "tasks"("googleCalendarEventId");

-- CreateIndex: Only create if doesn't exist
CREATE INDEX IF NOT EXISTS "tasks_googleCalendarEventId_idx" ON "tasks"("googleCalendarEventId");

-- AddForeignKey: Only add if doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'calendar_settings_userId_fkey'
    AND table_name = 'calendar_settings'
  ) THEN
    ALTER TABLE "calendar_settings" ADD CONSTRAINT "calendar_settings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'calendar_events_userId_fkey'
    AND table_name = 'calendar_events'
  ) THEN
    ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

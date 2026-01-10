-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "googleCalendarEventId" TEXT,
ADD COLUMN "syncedToCalendar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "calendar_settings" (
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

-- CreateTable
CREATE TABLE "calendar_events" (
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

-- CreateIndex
CREATE UNIQUE INDEX "calendar_settings_userId_key" ON "calendar_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_googleEventId_key" ON "calendar_events"("googleEventId");

-- CreateIndex
CREATE INDEX "calendar_events_userId_isAppEvent_idx" ON "calendar_events"("userId", "isAppEvent");

-- CreateIndex
CREATE INDEX "calendar_events_userId_start_idx" ON "calendar_events"("userId", "start");

-- CreateIndex
CREATE INDEX "calendar_events_googleEventId_idx" ON "calendar_events"("googleEventId");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_googleCalendarEventId_key" ON "tasks"("googleCalendarEventId");

-- CreateIndex
CREATE INDEX "tasks_googleCalendarEventId_idx" ON "tasks"("googleCalendarEventId");

-- AddForeignKey
ALTER TABLE "calendar_settings" ADD CONSTRAINT "calendar_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

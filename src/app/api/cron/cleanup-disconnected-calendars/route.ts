// src/app/api/cron/cleanup-disconnected-calendars/route.ts
// Version: 1.0.0 - 2026-01-24
// Deletes Google Calendar metadata 30 days after user disconnects
// This ensures compliance with privacy policy promises

import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  console.log('[cron:calendar-cleanup] Starting disconnected calendar metadata cleanup...\n');

  const results = {
    settingsDeleted: 0,
    eventsDeleted: 0,
    tasksUnlinked: 0,
  };

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // Delete calendar metadata for users who disconnected 30+ days ago
    // ═══════════════════════════════════════════════════════════════════════
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    console.log('[cron:calendar-cleanup] 🗑️ Finding disconnected calendar settings...');

    // Find calendar settings that were disconnected 30+ days ago
    const disconnectedSettings = await db.calendarSettings.findMany({
      where: {
        disconnectedAt: {
          not: null,
          lt: thirtyDaysAgo,
        },
      },
      select: {
        id: true,
        userId: true,
        disconnectedAt: true,
      },
    });

    console.log(`[cron:calendar-cleanup] Found ${disconnectedSettings.length} disconnected calendar(s) older than 30 days`);

    for (const setting of disconnectedSettings) {
      console.log(`[cron:calendar-cleanup] Processing user ${setting.userId} (disconnected ${setting.disconnectedAt?.toISOString()})...`);

      try {
        // 1. Unlink all tasks from Google Calendar events
        const tasksUpdated = await db.task.updateMany({
          where: {
            userId: setting.userId,
            googleCalendarEventId: { not: null },
          },
          data: {
            googleCalendarEventId: null,
            syncedToCalendar: false,
          },
        });
        results.tasksUnlinked += tasksUpdated.count;
        console.log(`[cron:calendar-cleanup]   ✓ Unlinked ${tasksUpdated.count} tasks`);

        // 2. Delete all calendar events
        const eventsDeleted = await db.calendarEvent.deleteMany({
          where: { userId: setting.userId },
        });
        results.eventsDeleted += eventsDeleted.count;
        console.log(`[cron:calendar-cleanup]   ✓ Deleted ${eventsDeleted.count} calendar events`);

        // 3. Delete calendar settings
        await db.calendarSettings.delete({
          where: { id: setting.id },
        });
        results.settingsDeleted++;
        console.log(`[cron:calendar-cleanup]   ✓ Deleted calendar settings for user ${setting.userId}`);

      } catch (error: any) {
        console.error(`[cron:calendar-cleanup]   ✗ Failed to cleanup user ${setting.userId}:`, error.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n[cron:calendar-cleanup] ✅ Cleanup complete!');
    console.log(`[cron:calendar-cleanup]   Calendar settings deleted: ${results.settingsDeleted}`);
    console.log(`[cron:calendar-cleanup]   Calendar events deleted: ${results.eventsDeleted}`);
    console.log(`[cron:calendar-cleanup]   Tasks unlinked: ${results.tasksUnlinked}`);

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });

  } catch (error: any) {
    console.error('[cron:calendar-cleanup] ❌ Cleanup failed:', error);
    return Response.json(
      {
        success: false,
        error: error.message,
        ...results,
      },
      { status: 500 }
    );
  }
}

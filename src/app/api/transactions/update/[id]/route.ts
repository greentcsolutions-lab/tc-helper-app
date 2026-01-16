// src/app/api/transactions/update/[id]/route.ts
// API route for updating transaction fields

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { syncTimelineEventsToCalendar } from '@/lib/google-calendar/sync-timeline-events';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await db.user.findUnique({
      where: { clerkId: user.id },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const parseId = params.id;
    const updates = await req.json();

    // Verify the parse belongs to this user
    const existingParse = await db.parse.findUnique({
      where: { id: parseId },
      select: { userId: true },
    });

    if (!existingParse) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (existingParse.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Parse model is IMMUTABLE after extraction - it's the extraction layer
    // ONLY allow updating status (for archiving) and timelineDataStructured (intercepted to update tasks)
    // ALL other extraction data must remain unchanged

    const { timelineDataStructured, status, ...extractionData } = updates;

    // Log and reject any attempts to modify extraction data
    if (Object.keys(extractionData).length > 0) {
      console.warn('[transactions/update] Attempted to modify immutable Parse extraction data:', Object.keys(extractionData));
      console.warn('[transactions/update] Parse model is immutable. Only Tasks can be modified.');
    }

    // Allow status updates (for archiving)
    let updatedParse = null;
    if (status !== undefined) {
      updatedParse = await db.parse.update({
        where: { id: parseId },
        data: { status },
      });
      console.log(`[transactions/update] Updated Parse status to: ${status}`);
    } else {
      // Just fetch the current parse to return
      updatedParse = await db.parse.findUnique({
        where: { id: parseId },
      });
    }

    // If timeline data was provided, update the corresponding tasks (NOT Parse!)
    if (timelineDataStructured && typeof timelineDataStructured === 'object') {
      console.log('[transactions/update] Updating tasks from timeline data changes (Parse remains immutable)');

      for (const [eventKey, eventData] of Object.entries(timelineDataStructured as any)) {
        const event = eventData as any;

        // Find the task by parseId + timelineEventKey
        const task = await db.task.findFirst({
          where: {
            parseId,
            timelineEventKey: eventKey,
            userId: dbUser.id,
          },
        });

        if (task) {
          // Build update data
          const taskUpdate: any = {};

          // Update date if provided and not waived
          if (event.effectiveDate && !event.waived) {
            // Convert date string to Date object using UTC to avoid timezone issues
            const dateStr = event.effectiveDate.split('T')[0]; // Get YYYY-MM-DD
            taskUpdate.dueDate = new Date(dateStr + 'T00:00:00.000Z'); // Force UTC midnight
            console.log(`[transactions/update] Task ${task.id} (${eventKey}): dueDate ${event.effectiveDate} → ${taskUpdate.dueDate.toISOString()}`);
          }

          // Update title if provided
          if (event.displayName) {
            taskUpdate.title = event.displayName;
          }

          // Update description if provided
          if (event.description !== undefined) {
            taskUpdate.description = event.description;
          }

          // Update waived status if changed
          if (event.waived !== undefined) {
            taskUpdate.archived = event.waived; // Waived tasks are archived
          }

          // Only update if we have changes
          if (Object.keys(taskUpdate).length > 0) {
            await db.task.update({
              where: { id: task.id },
              data: taskUpdate,
            });
            console.log(`[transactions/update] Updated task ${task.id} (${eventKey})`);
          }
        } else {
          console.warn(`[transactions/update] Task not found for eventKey: ${eventKey}`);
        }
      }
    }

    // Trigger Google Calendar sync (it reads from tasks now)
    // Sync in background - don't wait for it
    syncTimelineEventsToCalendar(parseId, dbUser.id).catch((error) => {
      console.error('Failed to sync timeline events to calendar after update:', error);
    });

    return NextResponse.json({
      success: true,
      parse: updatedParse,
      message: 'Transaction updated successfully',
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}

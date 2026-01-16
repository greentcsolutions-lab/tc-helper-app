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

    // Update the parse with the provided fields
    const updatedParse = await db.parse.update({
      where: { id: parseId },
      data: updates,
    });

    // Trigger Google Calendar sync if timeline data was updated
    if (updates.timelineDataStructured || updates.closingDate || updates.effectiveDate ||
        updates.initialDepositDueDate || updates.sellerDeliveryOfDisclosuresDate ||
        updates.contingencies) {
      // Sync in background - don't wait for it
      syncTimelineEventsToCalendar(parseId, dbUser.id).catch((error) => {
        console.error('Failed to sync timeline events to calendar after update:', error);
      });
    }

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

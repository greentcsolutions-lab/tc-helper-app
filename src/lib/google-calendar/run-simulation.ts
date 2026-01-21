// src/lib/google-calendar/run-simulation.ts
// A script to simulate the Google Calendar sync process.

import { PrismaClient } from '@prisma/client';
import { initializeCalendars } from './calendar-init';
import { performInitialSync } from './sync';
import { syncCalendarToApp } from './calendar-to-app';

const prisma = new PrismaClient();

const SIMULATION_USER_EMAIL = 'simulation-user@test.com';

async function runSimulation() {
  console.log('--- Starting Google Calendar Sync Simulation ---');

  // 1. Setup: Create a temporary user and calendar settings
  const user = await prisma.user.create({
    data: {
      clerkId: `simulated-clerk-id-${Date.now()}`,
      email: SIMULATION_USER_EMAIL,
    },
  });

  await prisma.calendarSettings.create({
    data: {
      userId: user.id,
      googleAccessToken: 'simulated-access-token',
      googleRefreshToken: 'simulated-refresh-token',
    },
  });

  console.log(`[Setup] Created user ${user.id} with email ${user.email}`);

  // 2. Simulate the end of the OAuth callback
  console.log('\n--- Simulating OAuth Callback ---');
  await initializeCalendars(user.id);
  console.log('[OAuth] `initializeCalendars` called.');

  // 3. Create some dummy tasks for the initial sync
  console.log('\n--- Creating dummy tasks ---');
  await prisma.task.createMany({
    data: [
      {
        userId: user.id,
        title: 'Simulated Task 1: Closing Docs',
        dueDate: new Date(),
        propertyAddress: '123 Main St',
      },
      {
        userId: user.id,
        title: 'Simulated Task 2: Inspection',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        propertyAddress: '456 Oak Ave',
      },
    ],
  });
  console.log('[Setup] Created 2 dummy tasks.');

  // 4. Perform the initial sync
  console.log('\n--- Simulating Initial Sync (App -> Calendar) ---');
  const initialSyncResult = await performInitialSync(user.id);
  console.log('[Initial Sync] `performInitialSync` result:', initialSyncResult);

  // 5. Simulate a change from Google Calendar (Webhook)
  console.log('\n--- Simulating Webhook (Calendar -> App) ---');
  // Create a dummy calendar event that the sync process should pick up
  const simulatedGoogleEventId = `simulated-google-event-${Date.now()}`;
  await prisma.calendarEvent.create({
    data: {
      userId: user.id,
      googleEventId: simulatedGoogleEventId,
      calendarId: 'simulated-primary-calendar-id',
      title: '[789 Pine Ln] New Task from Google',
      description: 'This task was created in Google Calendar.',
      start: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      allDay: true,
      isAppEvent: true, // Mark as an app event so it gets processed
      matchedPropertyAddress: '789 Pine Ln',
    },
  });
  console.log('[Webhook] Created a dummy CalendarEvent.');

  // Now, run the sync from calendar to app
  const calendarToAppResult = await syncCalendarToApp(user.id);
  console.log('[Webhook] `syncCalendarToApp` result:', calendarToAppResult);

  // Check if the new task was created
  const newTaskFromGoogle = await prisma.task.findFirst({
    where: { googleCalendarEventId: simulatedGoogleEventId },
  });
  console.log('[Webhook] Verified new task from Google:', newTaskFromGoogle ? 'FOUND' : 'NOT FOUND');


  // 7. Cleanup
  console.log('\n--- Cleaning up ---');
  await prisma.user.delete({ where: { id: user.id } });
  console.log(`[Cleanup] Deleted user ${user.id}`);

  console.log('\n--- Simulation Complete ---');
}

runSimulation()
  .catch((e) => {
    console.error('Simulation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

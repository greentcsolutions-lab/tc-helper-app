// src/app/tasks/page.tsx
// Tasks page - Server component that fetches tasks and renders TasksClient

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import TasksClient from "@/components/tasks/TasksClient";
import { syncAllTimelineTasks } from "@/lib/tasks/sync-timeline-tasks";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const dbUser = await db.user.findUnique({
    where: { clerkId: user.id },
    select: { id: true },
  });

  if (!dbUser) redirect("/onboarding");

  // Sync timeline tasks before fetching
  await syncAllTimelineTasks(dbUser.id);

  // Fetch all tasks for the user (exclude archived tasks)
  const tasks = await db.task.findMany({
    where: {
      userId: dbUser.id,
      archived: {
        not: true, // Exclude archived tasks
      },
    },
    include: {
      parse: {
        select: {
          id: true,
          propertyAddress: true,
          effectiveDate: true,
          closingDate: true,
          status: true,
        },
      },
    },
    orderBy: [
      { columnId: 'asc' },
      { sortOrder: 'asc' },
      { dueDate: 'asc' },
    ],
  });

  // Fetch user's parses for the transaction dropdown
  const parses = await db.parse.findMany({
    where: {
      userId: dbUser.id,
      status: {
        in: ['COMPLETED', 'NEEDS_REVIEW'], // Only show completed/reviewed transactions
      },
    },
    select: {
      id: true,
      fileName: true,
      propertyAddress: true,
      transactionType: true,
      effectiveDate: true,
      closingDate: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return <TasksClient initialTasks={tasks} parses={parses} />;
}

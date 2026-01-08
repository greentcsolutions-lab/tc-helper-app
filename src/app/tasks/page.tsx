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

  // Fetch all tasks for the user
  const tasks = await db.task.findMany({
    where: {
      userId: dbUser.id,
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

  return <TasksClient initialTasks={tasks} />;
}

// src/components/dashboard/NextTaskCard.tsx
// Dashboard widget showing the next upcoming task

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckSquare, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { getTaskStatus, formatDaysUntilDue, TASK_TYPES } from "@/types/task";

type Task = any; // Use Prisma-generated type
import Link from "next/link";
import { format } from "date-fns";

interface NextTaskCardProps {
  tasks: Task[];
}

/**
 * Simplifies a full address to just the street address
 */
function simplifyAddress(address: string | undefined | null): string {
  if (!address) return "";
  const parts = address.split(',');
  return parts[0].trim();
}

/**
 * Gets the badge color for a task type
 */
function getTaskTypeColor(taskType: string): string {
  switch (taskType) {
    case TASK_TYPES.TIMELINE:
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case TASK_TYPES.BROKER:
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case TASK_TYPES.ESCROW:
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case TASK_TYPES.LENDER:
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

export default function NextTaskCard({ tasks }: NextTaskCardProps) {
  // Filter for incomplete tasks and sort by due date
  const incompleteTasks = tasks
    .filter((task) => task.status !== 'completed')
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const nextTask = incompleteTasks[0];

  if (!nextTask) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Next Task
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No upcoming tasks. You're all caught up!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = getTaskStatus(nextTask);
  const isOverdue = status === 'overdue';
  const daysUntilDue = formatDaysUntilDue(nextTask.dueDate);

  return (
    <Card className={isOverdue ? 'border-red-500 border-2' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          Next Task
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks">
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Task Card */}
          <Link href={`/tasks?taskId=${nextTask.id}`} className="p-4 rounded-lg border hover:bg-muted/50 transition-colors block">
            {/* Task Type Badges - can have multiple */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {nextTask.taskTypes?.map((type: string) => (
                <Badge
                  key={type}
                  className={`${getTaskTypeColor(type)} text-xs capitalize`}
                  variant="outline"
                >
                  {type}
                </Badge>
              ))}
            </div>

            {/* Title */}
            <h3 className="font-semibold text-lg leading-tight mb-2">
              {nextTask.title}
            </h3>

            {/* Property Address */}
            {nextTask.propertyAddress && (
              <p className="text-sm text-muted-foreground mb-3">
                {simplifyAddress(nextTask.propertyAddress)}
              </p>
            )}

            {/* Due Date and Status */}
            <div className="flex items-center justify-between pt-3 border-t">
              <div className="flex items-center gap-2">
                {isOverdue ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-red-500">Overdue</p>
                      <p className="text-xs text-muted-foreground">
                        {format(nextTask.dueDate, "MMM d, yyyy")}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{daysUntilDue}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(nextTask.dueDate, "MMM d, yyyy")}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Amount if applicable */}
              {nextTask.amount && (
                <div className="text-right">
                  <p className="text-lg font-bold">
                    ${nextTask.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Amount</p>
                </div>
              )}
            </div>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

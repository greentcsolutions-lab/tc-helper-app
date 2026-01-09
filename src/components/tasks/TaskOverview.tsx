// src/components/tasks/TaskOverview.tsx
// Right sidebar showing task progress by type

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TASK_TYPES, TASK_STATUS } from "@/types/task";
import { useMemo } from "react";

type Task = any;

interface TaskOverviewProps {
  tasks: Task[];
}

const TASK_TYPE_CONFIG = [
  {
    type: TASK_TYPES.TIMELINE,
    label: 'Timeline',
    color: 'bg-blue-500',
  },
  {
    type: TASK_TYPES.BROKER,
    label: 'Broker',
    color: 'bg-purple-500',
  },
  {
    type: TASK_TYPES.ESCROW,
    label: 'Escrow',
    color: 'bg-orange-500',
  },
  {
    type: TASK_TYPES.LENDER,
    label: 'Lender',
    color: 'bg-green-500',
  },
];

export default function TaskOverview({ tasks }: TaskOverviewProps) {
  const taskStats = useMemo(() => {
    return TASK_TYPE_CONFIG.map((config) => {
      // Filter tasks that have this type in their taskTypes array
      const tasksOfType = tasks.filter((task) =>
        task.taskTypes?.includes(config.type)
      );
      const completedTasks = tasksOfType.filter(
        (task) => task.status === TASK_STATUS.COMPLETED
      );

      return {
        ...config,
        completed: completedTasks.length,
        total: tasksOfType.length,
      };
    });
  }, [tasks]);

  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Task Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {taskStats.map((stat) => (
          <div key={stat.type} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-muted-foreground">
                {stat.label}
              </span>
              <span className="text-sm font-semibold">
                {stat.completed}/{stat.total}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${stat.color} transition-all duration-300`}
                style={{
                  width: stat.total > 0 ? `${(stat.completed / stat.total) * 100}%` : '0%',
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

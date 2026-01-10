// src/components/tasks/TaskCard.tsx
// Individual task card component for drag-and-drop task board

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { getTaskStatus, formatDaysUntilDue, TASK_TYPES } from "@/types/task";

type Task = any; // Use Prisma-generated type
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onShiftLeft?: () => void;
  onShiftRight?: () => void;
  disableDrag?: boolean;
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

export default function TaskCard({ task, onEdit, onShiftLeft, onShiftRight, disableDrag }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: disableDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const status = getTaskStatus(task);
  const isOverdue = status === 'overdue';
  const daysUntilDue = formatDaysUntilDue(task.dueDate);

  return (
    <div ref={setNodeRef} style={style} {...(disableDrag ? {} : { ...attributes, ...listeners })}>
      <Card
        className={`${disableDrag ? '' : 'cursor-grab active:cursor-grabbing'} hover:shadow-md transition-shadow ${
          isOverdue ? 'border-red-500 border-2' : ''
        }`}
      >
        <CardContent className="p-4 space-y-3">
          {/* Task Type Badges - can have multiple */}
          <div className="flex flex-wrap gap-1.5">
            {task.taskTypes?.map((type: string) => (
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
          <div>
            <h3 className="font-semibold text-sm leading-tight line-clamp-2">
              {task.title}
            </h3>
          </div>

          {/* Property Address */}
          {task.propertyAddress && (
            <p className="text-xs text-muted-foreground truncate">
              {simplifyAddress(task.propertyAddress)}
            </p>
          )}

          {/* Footer with time remaining */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {isOverdue ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-red-500 font-medium">{daysUntilDue}</span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  <span>{daysUntilDue}</span>
                </>
              )}
            </div>

            {/* Optional metadata icons */}
            <div className="flex items-center gap-1.5">
              {task.description && (
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {task.amount && (
                <span className="text-xs font-medium text-muted-foreground">
                  ${task.amount.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Navigation Buttons */}
          {(onShiftLeft || onShiftRight) && (
            <div className="flex items-center justify-center gap-2 pt-2 border-t">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShiftLeft?.();
                }}
                disabled={!onShiftLeft}
                className={`p-1.5 rounded hover:bg-muted transition-colors ${
                  !onShiftLeft ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                }`}
                title="Move left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShiftRight?.();
                }}
                disabled={!onShiftRight}
                className={`p-1.5 rounded hover:bg-muted transition-colors ${
                  !onShiftRight ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                }`}
                title="Move right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

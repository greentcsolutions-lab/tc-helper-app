// src/components/tasks/TasksClient.tsx
// Client component for the Tasks page with drag-and-drop functionality

"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TASK_STATUS, getTaskStatus } from "@/types/task";

type Task = any; // Use Prisma-generated type
import TaskCard from "./TaskCard";
import { Filter, Plus } from "lucide-react";

interface TasksClientProps {
  initialTasks: Task[];
}

const COLUMNS = [
  { id: TASK_STATUS.NOT_STARTED, title: "Not Started", color: "bg-gray-100" },
  { id: TASK_STATUS.PENDING, title: "Pending", color: "bg-yellow-100" },
  { id: TASK_STATUS.COMPLETED, title: "Completed", color: "bg-green-100" },
] as const;

// Droppable Column Component
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-3 min-h-[200px] p-2 rounded-lg border-2 border-dashed ${
        isOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'
      }`}
    >
      {children}
    </div>
  );
}

export default function TasksClient({ initialTasks }: TasksClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [columnVisibility, setColumnVisibility] = useState({
    [TASK_STATUS.NOT_STARTED]: true,
    [TASK_STATUS.PENDING]: true,
    [TASK_STATUS.COMPLETED]: true,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      [TASK_STATUS.NOT_STARTED]: [],
      [TASK_STATUS.PENDING]: [],
      [TASK_STATUS.COMPLETED]: [],
    };

    tasks.forEach((task) => {
      // Calculate computed status (including overdue)
      const status = getTaskStatus(task);

      // Overdue tasks stay in their current column but are highlighted
      const columnId = status === 'overdue' ? task.columnId : task.status;

      if (grouped[columnId]) {
        grouped[columnId].push(task);
      }
    });

    // Sort tasks within each column
    Object.keys(grouped).forEach((columnId) => {
      grouped[columnId].sort((a, b) => {
        // First by sortOrder
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        // Then by due date
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
    });

    return grouped;
  }, [tasks]);

  // Count tasks in each column
  const taskCounts = useMemo(() => {
    return {
      [TASK_STATUS.NOT_STARTED]: tasksByColumn[TASK_STATUS.NOT_STARTED].length,
      [TASK_STATUS.PENDING]: tasksByColumn[TASK_STATUS.PENDING].length,
      [TASK_STATUS.COMPLETED]: tasksByColumn[TASK_STATUS.COMPLETED].length,
    };
  }, [tasksByColumn]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Check if dropped over a column
    const targetColumn = COLUMNS.find((col) => col.id === over.id);
    if (targetColumn) {
      // Moved to a different column
      if (task.columnId !== targetColumn.id) {
        await updateTaskColumn(taskId, targetColumn.id);
      }
    } else {
      // Dropped over another task - update sort order
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask && task.columnId === overTask.columnId) {
        await updateTaskSortOrder(taskId, overTask.sortOrder);
      }
    }
  };

  const updateTaskColumn = async (taskId: string, newColumnId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columnId: newColumnId,
          status: newColumnId, // Update status to match column
        }),
      });

      if (response.ok) {
        const { task: updatedTask } = await response.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...updatedTask } : t))
        );
      }
    } catch (error) {
      console.error('Failed to update task column:', error);
    }
  };

  const updateTaskSortOrder = async (taskId: string, newSortOrder: number) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: newSortOrder }),
      });

      if (response.ok) {
        const { task: updatedTask } = await response.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...updatedTask } : t))
        );
      }
    } catch (error) {
      console.error('Failed to update task sort order:', error);
    }
  };

  const toggleColumnVisibility = (columnId: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId]: !prev[columnId as keyof typeof prev],
    }));
  };

  const shiftTask = async (taskId: string, direction: 'left' | 'right') => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentIndex = COLUMNS.findIndex((col) => col.id === task.columnId);
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= COLUMNS.length) return;

    const newColumnId = COLUMNS[newIndex].id;
    await updateTaskColumn(taskId, newColumnId);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            Manage your transaction tasks and deadlines
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Column Visibility Toggles */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground mr-2">Show:</span>
        {COLUMNS.map((column) => (
          <Badge
            key={column.id}
            variant={columnVisibility[column.id] ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleColumnVisibility(column.id)}
          >
            {column.title} ({taskCounts[column.id]})
          </Badge>
        ))}
      </div>

      {/* Task Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLUMNS.map((column) => (
            <div
              key={column.id}
              className={`space-y-4 ${
                !columnVisibility[column.id] ? "hidden" : ""
              }`}
            >
              {/* Column Header */}
              <Card className={column.color}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{column.title}</span>
                    <Badge variant="secondary">{taskCounts[column.id]}</Badge>
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* Column Content */}
              <SortableContext
                items={tasksByColumn[column.id].map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <DroppableColumn id={column.id}>
                  {tasksByColumn[column.id].map((task) => {
                    const columnIndex = COLUMNS.findIndex((col) => col.id === column.id);
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onShiftLeft={columnIndex > 0 ? () => shiftTask(task.id, 'left') : undefined}
                        onShiftRight={columnIndex < COLUMNS.length - 1 ? () => shiftTask(task.id, 'right') : undefined}
                      />
                    );
                  })}
                  {tasksByColumn[column.id].length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No tasks
                    </div>
                  )}
                </DroppableColumn>
              </SortableContext>
            </div>
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

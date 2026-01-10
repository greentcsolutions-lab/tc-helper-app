// src/components/tasks/TasksClient.tsx
// Client component for the Tasks page with drag-and-drop functionality
// Version: 1.2.0 01/09/2026
// dummy comment :D

"use client";

import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TASK_STATUS, getTaskStatus } from "@/types/task";

type Task = any; // Use Prisma-generated type
import TaskCard from "./TaskCard";
import TaskOverview from "./TaskOverview";
import NewTaskDialog from "./NewTaskDialog";
import { Filter } from "lucide-react";

type Parse = {
  id: string;
  fileName: string;
  propertyAddress: string | null;
  effectiveDate: Date | string | null;
  closingDate: Date | string | null;
};

interface TasksClientProps {
  initialTasks: Task[];
  parses: Parse[];
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

export default function TasksClient({ initialTasks, parses }: TasksClientProps) {
  // Deserialize dates from server-side rendered data
  const [tasks, setTasks] = useState<Task[]>(() =>
    initialTasks.map((task) => ({
      ...task,
      dueDate: new Date(task.dueDate),
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt),
      completedAt: task.completedAt ? new Date(task.completedAt) : null,
    }))
  );
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [originalColumnId, setOriginalColumnId] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState({
    [TASK_STATUS.NOT_STARTED]: true,
    [TASK_STATUS.PENDING]: true,
    [TASK_STATUS.COMPLETED]: true,
  });
  const [isMobile, setIsMobile] = useState(false);

  // Detect screen size changes
  useEffect(() => {
    // Initial check
    const checkMobile = () => {
      // Use 640px (sm breakpoint) to target only phones, not tablets/Chromebooks
      // Phones: typically < 640px
      // Tablets/Chromebooks/Desktop: >= 640px
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();

    // Add listener for window resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 600, // Long delay to ensure it's intentional and doesn't block scrolling
        tolerance: 8, // Allow slight finger movement during long press
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

    // Debug log after calculation (not during to avoid hydration issues)
    if (typeof window !== 'undefined') {
      console.log('📊 tasksByColumn calculated:', {
        not_started: grouped.not_started?.length || 0,
        pending: grouped.pending?.length || 0,
        completed: grouped.completed?.length || 0,
      });
    }

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
      // Use task.status as source of truth for the visual column position
      // (task.columnId might be stale from a previous drag that didn't persist)
      const status = getTaskStatus(task);
      const visualColumnId = status === 'overdue' ? task.columnId : task.status;
      console.log('🎬 DragStart:', { taskId: task.id, status: task.status, columnId: task.columnId, visualColumnId });
      setOriginalColumnId(visualColumnId);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Check if we're over a column
    const overColumn = COLUMNS.find((col) => col.id === overId);
    if (overColumn && activeTask.columnId !== overColumn.id) {
      console.log('🔄 DragOver: Moving task to column', { taskId: activeId, from: activeTask.columnId, to: overColumn.id });
      // Optimistically move task to the new column for visual feedback
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, columnId: overColumn.id, status: overColumn.id } : t
        )
      );
      return;
    }

    // Check if we're over another task
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask && activeTask.columnId !== overTask.columnId) {
      console.log('🔄 DragOver: Moving task to another task\'s column', { taskId: activeId, from: activeTask.columnId, to: overTask.columnId });
      // Move to the column containing the task we're over
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, columnId: overTask.columnId, status: overTask.columnId } : t
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const taskId = active.id as string;

    console.log('🎯 DragEnd started', { taskId, overId: over?.id, originalColumnId });

    setActiveTask(null);

    if (!over || !originalColumnId) {
      console.log('❌ DragEnd: Dropped outside or no original column, reverting');
      // Dragged outside or no original column - revert to original position
      if (originalColumnId) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, columnId: originalColumnId, status: originalColumnId } : t
          )
        );
      }
      setOriginalColumnId(null);
      return;
    }

    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      console.log('❌ DragEnd: Task not found');
      setOriginalColumnId(null);
      return;
    }

    const currentColumnId = task.columnId;
    console.log('📍 DragEnd: Current task state', { taskId, currentColumnId, taskStatus: task.status });

    // Determine target column
    let targetColumnId = currentColumnId;

    const targetColumn = COLUMNS.find((col) => col.id === over.id);
    if (targetColumn) {
      targetColumnId = targetColumn.id;
      console.log('🎯 DragEnd: Dropped on column', targetColumnId);
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) {
        targetColumnId = overTask.columnId;
        console.log('🎯 DragEnd: Dropped on task in column', targetColumnId);
      }
    }

    console.log('🔍 DragEnd: Comparison', { originalColumnId, targetColumnId, willPersist: originalColumnId !== targetColumnId });

    // If column changed from original, persist to database
    if (originalColumnId !== targetColumnId) {
      await persistTaskColumn(taskId, targetColumnId, originalColumnId);
    } else {
      console.log('⏭️  DragEnd: No change, skipping persist');
    }

    setOriginalColumnId(null);
  };

  const updateTaskColumn = async (taskId: string, newColumnId: string) => {
    // Optimistic update - update UI immediately
    const previousTasks = tasks;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, columnId: newColumnId, status: newColumnId, updatedAt: new Date() }
          : t
      )
    );

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columnId: newColumnId,
          status: newColumnId, // Update status to match column
        }),
      });

      if (!response.ok) {
        // Rollback on error
        setTasks(previousTasks);
        const error = await response.json();
        console.error('Failed to update task column:', error);
        throw new Error(error.error || 'Failed to update task');
      }

      const { task: updatedTask } = await response.json();

      // Convert date strings back to Date objects
      if (updatedTask.dueDate) {
        updatedTask.dueDate = new Date(updatedTask.dueDate);
      }
      if (updatedTask.createdAt) {
        updatedTask.createdAt = new Date(updatedTask.createdAt);
      }
      if (updatedTask.updatedAt) {
        updatedTask.updatedAt = new Date(updatedTask.updatedAt);
      }
      if (updatedTask.completedAt) {
        updatedTask.completedAt = new Date(updatedTask.completedAt);
      }

      // Update with real data from server
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updatedTask } : t))
      );
    } catch (error) {
      console.error('Failed to update task column:', error);
      // Rollback already happened above
    }
  };

  const persistTaskColumn = async (
    taskId: string,
    newColumnId: string,
    fallbackColumnId: string
  ) => {
    // Persist to database (UI already updated by dragOver)
    console.log('Persisting task:', { taskId, newColumnId, fallbackColumnId });

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columnId: newColumnId,
          status: newColumnId,
        }),
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        // Rollback to original column on error
        console.error('API call failed, rolling back to:', fallbackColumnId);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, columnId: fallbackColumnId, status: fallbackColumnId } : t
          )
        );
        const error = await response.json();
        console.error('Failed to persist task column:', error);
        return;
      }

      // Success - UI already updated by dragOver, just log confirmation
      const { task: updatedTask } = await response.json();
      console.log('✅ Server confirmed task update. columnId:', updatedTask.columnId, 'status:', updatedTask.status);

      // Don't update state here - dragOver already did it and we don't want to trigger re-render
      // The task should stay in the position dragOver put it in
    } catch (error) {
      // Rollback on error
      console.error('Exception during persist, rolling back:', error);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, columnId: fallbackColumnId, status: fallbackColumnId } : t
        )
      );
      console.error('Failed to persist task column:', error);
    }
  };


  const toggleColumnVisibility = (columnId: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId]: !prev[columnId as keyof typeof prev],
    }));
  };

  const shiftTask = (taskId: string, direction: 'left' | 'right') => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentIndex = COLUMNS.findIndex((col) => col.id === task.columnId);
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= COLUMNS.length) return;

    const newColumnId = COLUMNS[newIndex].id;
    // Don't await - optimistic update handles it
    updateTaskColumn(taskId, newColumnId);
  };

  // Mobile Layout with Tabs
  const MobileLayout = () => (
    <div className="h-full p-4">
      <Tabs defaultValue="board" className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Tasks</h1>
          <NewTaskDialog parses={parses} />
        </div>

        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="flex-1 space-y-4 overflow-auto">
          {COLUMNS.map((column) => {
            if (!columnVisibility[column.id]) return null;
            const columnIndex = COLUMNS.findIndex((col) => col.id === column.id);

            return (
              <div key={column.id} className="space-y-2">
                {/* Column Header */}
                <Card className={column.color}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{column.title}</span>
                      <Badge variant="secondary">{taskCounts[column.id]}</Badge>
                    </CardTitle>
                  </CardHeader>
                </Card>

                {/* Horizontal Scrolling Tasks */}
                {tasksByColumn[column.id].length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                    {tasksByColumn[column.id].map((task) => (
                      <div key={task.id} className="flex-shrink-0 w-[85vw] snap-start">
                        <TaskCard
                          task={task}
                          onShiftLeft={columnIndex > 0 ? () => shiftTask(task.id, 'left') : undefined}
                          onShiftRight={columnIndex < COLUMNS.length - 1 ? () => shiftTask(task.id, 'right') : undefined}
                          disableDrag={true}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed border-muted-foreground/20 rounded-lg">
                    No tasks
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="overview" className="flex-1 overflow-auto">
          <TaskOverview tasks={tasks} />
        </TabsContent>
      </Tabs>
    </div>
  );

  // Desktop Layout with Sidebar
  const DesktopLayout = () => (
    <div className="flex gap-0.5 h-full">
      {/* Main Content */}
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tasks</h1>
            <p className="text-muted-foreground">
              Manage your transaction tasks and deadlines
            </p>
          </div>
          <NewTaskDialog parses={parses} />
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
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
          <DragOverlay dropAnimation={null}>
            {activeTask && <TaskCard task={activeTask} />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 p-6 border-l bg-muted/20">
        <TaskOverview tasks={tasks} />
      </div>
    </div>
  );

  // Conditionally render only one layout to avoid duplicate DOM elements
  return isMobile ? <MobileLayout /> : <DesktopLayout />;
}

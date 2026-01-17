// src/components/tasks/TasksTable.tsx
// Table view component for tasks with sortable columns
// Version: 1.0.0 01/10/2026

"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TASK_STATUS, TASK_TYPES, getTaskStatus, getDaysUntilDue, formatDaysUntilDue } from "@/types/task";
import { ArrowUp, ArrowDown, AlertTriangle, Trash2, Pencil, Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Task = any; // Use Prisma-generated type

type SortField = "title" | "dueDate" | "propertyAddress" | "status" | "taskTypes";
type SortDirection = "asc" | "desc";

// Task type configuration for colors and labels
const TASK_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  [TASK_TYPES.TIMELINE]: {
    label: 'Timeline',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  [TASK_TYPES.BROKER]: {
    label: 'Broker',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  [TASK_TYPES.ESCROW]: {
    label: 'Escrow',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  [TASK_TYPES.LENDER]: {
    label: 'Lender',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
};

interface TasksTableProps {
  tasks: Task[];
  onUpdateTaskStatus: (taskId: string, newStatus: string) => Promise<void>;
  onDeleteTasks: (taskIds: string[]) => Promise<void>;
  onEditTask?: (task: Task) => void;
  onViewTask?: (task: Task) => void;
}

export default function TasksTable({ tasks, onUpdateTaskStatus, onDeleteTasks, onEditTask, onViewTask }: TasksTableProps) {
  const [sortField, setSortField] = useState<SortField>("dueDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter to only show not_started and pending tasks (default behavior)
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      return task.status === TASK_STATUS.NOT_STARTED || task.status === TASK_STATUS.PENDING;
    });
  }, [tasks]);

  // Sort tasks based on current sort field and direction
  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "title":
          comparison = (a.title || "").localeCompare(b.title || "");
          break;
        case "dueDate":
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        case "propertyAddress":
          comparison = (a.propertyAddress || "").localeCompare(b.propertyAddress || "");
          break;
        case "status":
          // Sort by status: not_started, pending, completed
          const statusOrder: Record<string, number> = {
            'not_started': 1,
            'pending': 2,
            'completed': 3,
          };
          comparison = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
          break;
        case "taskTypes":
          // Sort by first task type alphabetically
          const aTypes = (a.taskTypes || []).join(", ");
          const bTypes = (b.taskTypes || []).join(", ");
          comparison = aTypes.localeCompare(bTypes);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredTasks, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await onUpdateTaskStatus(taskId, newStatus);

      if (newStatus === TASK_STATUS.COMPLETED) {
        toast.success("Task marked as completed");
      } else {
        toast.success("Task status updated");
      }
    } catch (error) {
      toast.error("Failed to update task status");
      console.error("Failed to update task status:", error);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTaskIds.size === sortedTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(sortedTasks.map((task) => task.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedTaskIds.size === 0) return;

    const confirmMessage =
      selectedTaskIds.size === 1
        ? "Are you sure you want to delete this task?"
        : `Are you sure you want to delete ${selectedTaskIds.size} tasks?`;

    if (!confirm(confirmMessage)) return;

    setIsDeleting(true);
    try {
      await onDeleteTasks(Array.from(selectedTaskIds));
      setSelectedTaskIds(new Set());
      toast.success(
        selectedTaskIds.size === 1
          ? "Task deleted successfully"
          : `${selectedTaskIds.size} tasks deleted successfully`
      );
    } catch (error) {
      toast.error("Failed to delete tasks");
      console.error("Failed to delete tasks:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    setIsDeleting(true);
    try {
      await onDeleteTasks([taskId]);
      toast.success("Task deleted successfully");
    } catch (error) {
      toast.error("Failed to delete task");
      console.error("Failed to delete task:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 inline ml-1" />
    );
  };

  const allSelected = sortedTasks.length > 0 && selectedTaskIds.size === sortedTasks.length;
  const someSelected = selectedTaskIds.size > 0 && selectedTaskIds.size < sortedTasks.length;

  return (
    <div className="space-y-3">
      {/* Bulk Actions Toolbar */}
      {selectedTaskIds.size > 0 && (
        <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedTaskIds.size} {selectedTaskIds.size === 1 ? "task" : "tasks"} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteSelected}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all tasks"
                  className={someSelected ? "data-[state=checked]:bg-muted-foreground" : ""}
                />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("title")}
              >
                Task Title <SortIcon field="title" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[200px]"
                onClick={() => handleSort("propertyAddress")}
              >
                Property <SortIcon field="propertyAddress" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[150px]"
                onClick={() => handleSort("taskTypes")}
              >
                Categories <SortIcon field="taskTypes" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[130px]"
                onClick={() => handleSort("dueDate")}
              >
                Due Date <SortIcon field="dueDate" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[140px]"
                onClick={() => handleSort("status")}
              >
                Status <SortIcon field="status" />
              </TableHead>
              <TableHead className="w-[140px]">Days Until/Overdue</TableHead>
              <TableHead className="w-[130px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No tasks to display
                </TableCell>
              </TableRow>
            ) : (
              sortedTasks.map((task) => {
                const taskStatus = getTaskStatus(task);
                const isOverdue = taskStatus === "overdue";
                const daysUntil = getDaysUntilDue(task.dueDate);
                const daysText = formatDaysUntilDue(task.dueDate);
                const isSelected = selectedTaskIds.has(task.id);

                return (
                  <TableRow
                    key={task.id}
                    className={`${isOverdue ? "bg-red-50" : ""} ${isSelected ? "bg-muted/50" : ""}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleTaskSelection(task.id)}
                        aria-label={`Select ${task.title}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px]">
                      <div className="truncate" title={task.title}>
                        {task.title}
                      </div>
                    </TableCell>
                    <TableCell className="w-[200px]">
                      <div className="truncate" title={task.propertyAddress || "-"}>
                        {task.propertyAddress || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="w-[150px]">
                      <div className="flex flex-wrap gap-1">
                        {task.isAiGenerated && (
                          <Badge
                            variant="outline"
                            className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 dark:from-purple-900/30 dark:to-pink-900/30 dark:text-purple-400 border-0 text-xs"
                            title="AI Generated"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI Generated
                          </Badge>
                        )}
                        {task.taskTypes?.map((type: string) => {
                          const typeConfig = TASK_TYPE_CONFIG[type];
                          return (
                            <Badge
                              key={type}
                              variant="outline"
                              className={`${typeConfig?.color || ""} border-0 text-xs`}
                            >
                              {typeConfig?.label || type}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="w-[130px]">
                      {format(new Date(task.dueDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="w-[140px]">
                      <Select
                        value={task.status}
                        onValueChange={(value) => handleStatusChange(task.id, value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TASK_STATUS.NOT_STARTED}>
                            Not Started
                          </SelectItem>
                          <SelectItem value={TASK_STATUS.PENDING}>
                            Pending
                          </SelectItem>
                          <SelectItem value={TASK_STATUS.COMPLETED}>
                            Completed
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="w-[140px]">
                      <div className="flex items-center gap-2">
                        {isOverdue && (
                          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className={isOverdue ? "text-red-600 font-semibold" : ""}>
                          {daysText}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="w-[130px]">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onViewTask?.(task)}
                          className="h-8 w-8"
                          title="View task"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditTask?.(task)}
                          className="h-8 w-8"
                          title="Edit task"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTask(task.id)}
                          disabled={isDeleting}
                          className="h-8 w-8"
                          title="Delete task"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
            </TableBody>
        </Table>
      </div>
    </div>
  );
}

// src/components/tasks/NewTaskDialog.tsx
// Dialog for creating a new task

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_TYPES, TASK_STATUS, DUE_DATE_TYPES } from "@/types/task";

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: () => void;
}

export default function NewTaskDialog({
  open,
  onOpenChange,
  onTaskCreated,
}: NewTaskDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    taskType: TASK_TYPES.TIMELINE,
    status: TASK_STATUS.NOT_STARTED,
    dueDateType: DUE_DATE_TYPES.SPECIFIC,
    dueDateValue: "",
    specificDate: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Calculate the actual due date based on type
      let dueDate: string;
      let dueDateValue: number | null = null;

      if (formData.dueDateType === DUE_DATE_TYPES.SPECIFIC) {
        dueDate = formData.specificDate;
      } else {
        // For days-based calculations, we need the value
        dueDateValue = parseInt(formData.dueDateValue);
        if (isNaN(dueDateValue)) {
          alert("Please enter a valid number of days");
          setIsLoading(false);
          return;
        }

        // For custom tasks, we'll set a placeholder date
        // The backend should calculate based on parse dates if parseId is provided
        const today = new Date();
        if (formData.dueDateType === DUE_DATE_TYPES.DAYS_AFTER_ACCEPTANCE) {
          today.setDate(today.getDate() + dueDateValue);
        } else if (formData.dueDateType === DUE_DATE_TYPES.DAYS_FROM_CLOSE) {
          today.setDate(today.getDate() + dueDateValue);
        }
        dueDate = today.toISOString();
      }

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          taskType: formData.taskType,
          status: formData.status,
          columnId: formData.status, // Match status and columnId
          dueDateType: formData.dueDateType,
          dueDateValue,
          dueDate,
          isCustom: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create task");
      }

      // Reset form
      setFormData({
        title: "",
        taskType: TASK_TYPES.TIMELINE,
        status: TASK_STATUS.NOT_STARTED,
        dueDateType: DUE_DATE_TYPES.SPECIFIC,
        dueDateValue: "",
        specificDate: "",
      });

      onTaskCreated();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create task:", error);
      alert(error instanceof Error ? error.message : "Failed to create task");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a custom task to track important deadlines
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Name */}
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Task Name *
            </label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g., Submit inspection report"
            />
          </div>

          {/* Task Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Task Category *</label>
            <Select
              value={formData.taskType}
              onValueChange={(value) =>
                setFormData({ ...formData, taskType: value as any })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TASK_TYPES.TIMELINE}>Timeline</SelectItem>
                <SelectItem value={TASK_TYPES.BROKER}>Broker</SelectItem>
                <SelectItem value={TASK_TYPES.ESCROW}>Escrow</SelectItem>
                <SelectItem value={TASK_TYPES.LENDER}>Lender</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Task Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Has this task been started?</label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value as any })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TASK_STATUS.NOT_STARTED}>Not Started</SelectItem>
                <SelectItem value={TASK_STATUS.PENDING}>Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Due Date Type */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Due Date *</label>

            <div className="space-y-2">
              {/* Radio: Specific Date */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="dueDateType"
                  value={DUE_DATE_TYPES.SPECIFIC}
                  checked={formData.dueDateType === DUE_DATE_TYPES.SPECIFIC}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dueDateType: e.target.value as any,
                    })
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm">Specific Date</span>
              </label>
              {formData.dueDateType === DUE_DATE_TYPES.SPECIFIC && (
                <Input
                  type="date"
                  required
                  value={formData.specificDate}
                  onChange={(e) =>
                    setFormData({ ...formData, specificDate: e.target.value })
                  }
                  className="ml-6"
                />
              )}

              {/* Radio: Days After Acceptance */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="dueDateType"
                  value={DUE_DATE_TYPES.DAYS_AFTER_ACCEPTANCE}
                  checked={formData.dueDateType === DUE_DATE_TYPES.DAYS_AFTER_ACCEPTANCE}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dueDateType: e.target.value as any,
                    })
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm">Days After Acceptance</span>
              </label>
              {formData.dueDateType === DUE_DATE_TYPES.DAYS_AFTER_ACCEPTANCE && (
                <Input
                  type="number"
                  required
                  min="0"
                  value={formData.dueDateValue}
                  onChange={(e) =>
                    setFormData({ ...formData, dueDateValue: e.target.value })
                  }
                  placeholder="Number of days"
                  className="ml-6"
                />
              )}

              {/* Radio: Days Before Close */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="dueDateType"
                  value={DUE_DATE_TYPES.DAYS_FROM_CLOSE}
                  checked={formData.dueDateType === DUE_DATE_TYPES.DAYS_FROM_CLOSE}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dueDateType: e.target.value as any,
                    })
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm">Days Before Close</span>
              </label>
              {formData.dueDateType === DUE_DATE_TYPES.DAYS_FROM_CLOSE && (
                <Input
                  type="number"
                  required
                  min="0"
                  value={formData.dueDateValue}
                  onChange={(e) =>
                    setFormData({ ...formData, dueDateValue: e.target.value })
                  }
                  placeholder="Number of days before close"
                  className="ml-6"
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// src/components/tasks/NewTaskDialog.tsx
// Dialog for creating new custom tasks

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

type Parse = {
  id: string;
  fileName: string;
  propertyAddress: string | null;
  effectiveDate: Date | string | null;
  closingDate: Date | string | null;
};

type Task = any; // Use Prisma-generated type

interface NewTaskDialogProps {
  parses: Parse[];
  editTask?: Task | null; // Optional task to edit
  open?: boolean; // Controlled open state
  onOpenChange?: (open: boolean) => void; // Controlled open state handler
  onTaskUpdated?: () => void; // Callback when task is updated
  mode?: 'create' | 'edit' | 'view'; // Dialog mode
}

export default function NewTaskDialog({
  parses,
  editTask = null,
  open: controlledOpen,
  onOpenChange,
  onTaskUpdated,
  mode: initialMode,
}: NewTaskDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'view'>(initialMode || 'create');

  // Use controlled open state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  // Update dialog mode when initialMode or editTask changes
  useEffect(() => {
    if (initialMode) {
      setDialogMode(initialMode);
    } else if (editTask) {
      setDialogMode('edit');
    } else {
      setDialogMode('create');
    }
  }, [initialMode, editTask]);

  const isEditMode = dialogMode === 'edit';
  const isViewMode = dialogMode === 'view';
  const isReadOnly = isViewMode;

  // Form state - initialize from editTask if in edit mode
  const [title, setTitle] = useState(editTask?.title || "");
  const [parseId, setParseId] = useState<string>(editTask?.parseId || "");
  const [taskTypes, setTaskTypes] = useState<string[]>(editTask?.taskTypes || ["broker"]);
  const [dueDateType, setDueDateType] = useState<"specific" | "days_after_acceptance" | "days_from_close">(
    editTask?.dueDateType || "specific"
  );
  const [specificDate, setSpecificDate] = useState(
    editTask?.dueDate ? new Date(editTask.dueDate).toISOString().split('T')[0] : ""
  );
  const [relativeDays, setRelativeDays] = useState(
    editTask?.dueDateValue ? String(editTask.dueDateValue) : ""
  );
  const [status, setStatus] = useState<"not_started" | "pending" | "completed">(
    editTask?.status || "not_started"
  );

  // Update form when editTask changes
  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title || "");
      setParseId(editTask.parseId || "");
      setTaskTypes(editTask.taskTypes || ["broker"]);
      setDueDateType(editTask.dueDateType || "specific");
      setSpecificDate(
        editTask.dueDate ? new Date(editTask.dueDate).toISOString().split('T')[0] : ""
      );
      setRelativeDays(editTask.dueDateValue ? String(editTask.dueDateValue) : "");
      setStatus(editTask.status || "not_started");
    }
  }, [editTask]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate required fields
      if (!title.trim()) {
        throw new Error("Task name is required");
      }

      if (!taskTypes || taskTypes.length === 0) {
        throw new Error("Please select at least one task category");
      }

      // Calculate due date
      let dueDate: Date | string;
      let dueDateValue: number | undefined;

      if (dueDateType === "specific") {
        if (!specificDate) {
          throw new Error("Please specify a due date");
        }
        dueDate = new Date(specificDate);
      } else {
        if (!relativeDays || parseInt(relativeDays) < 0) {
          throw new Error("Please specify the number of days");
        }
        dueDateValue = parseInt(relativeDays);

        // For relative dates, we need to calculate the actual date based on the transaction
        const selectedParse = parses.find(p => p.id === parseId);
        if (!selectedParse) {
          throw new Error("Please select a transaction for relative dates");
        }

        const baseDate = dueDateType === "days_after_acceptance"
          ? selectedParse.effectiveDate
          : selectedParse.closingDate;

        if (!baseDate) {
          throw new Error(`Transaction is missing ${dueDateType === "days_after_acceptance" ? "acceptance" : "closing"} date`);
        }

        const base = new Date(baseDate);
        dueDate = new Date(base);
        dueDate.setDate(dueDate.getDate() + dueDateValue);
      }

      // Extract propertyAddress from selected parse
      const selectedParse = parseId ? parses.find(p => p.id === parseId) : null;
      const propertyAddress = selectedParse?.propertyAddress || null;

      // Create or update the task
      const url = isEditMode ? `/api/tasks/${editTask.id}` : "/api/tasks";
      const method = isEditMode ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          parseId: parseId || undefined,
          propertyAddress, // Include property address from selected transaction
          taskTypes, // Now an array
          dueDate,
          dueDateType,
          dueDateValue,
          status,
          columnId: status,
          ...(!isEditMode && { isCustom: true }), // Only set isCustom for new tasks
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} task`);
      }

      // Success! Close dialog and refresh
      setOpen(false);
      if (!isEditMode) {
        resetForm();
      }

      // Call the callback if provided (for optimistic updates)
      if (onTaskUpdated) {
        onTaskUpdated();
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setParseId("");
    setTaskTypes(["broker"]);
    setDueDateType("specific");
    setSpecificDate("");
    setRelativeDays("");
    setStatus("not_started");
    setError(null);
  };

  const toggleTaskType = (type: string) => {
    setTaskTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  // Check if this is a timeline task (categories are locked)
  const isTimelineTask = editTask?.taskTypes?.includes('timeline');

  // Check if this is an anchor point task (Acceptance or Closing)
  const isAnchorPoint = editTask?.timelineEventId?.endsWith('-acceptance') ||
                        editTask?.timelineEventId?.endsWith('-closing');
  const isTitleLocked = isAnchorPoint;

  const handleSwitchToEdit = () => {
    setDialogMode('edit');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {dialogMode === 'create' && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isViewMode ? 'View Task' : (isEditMode ? 'Edit Task' : 'Create New Task')}
            </DialogTitle>
            <DialogDescription>
              {isViewMode
                ? 'View task details below. Click Edit to make changes.'
                : (isEditMode
                  ? 'Update the task details below.'
                  : 'Add a custom task to your workflow. Fill in the details below.')}
              {isTimelineTask && !isViewMode && (
                <div className="mt-2 text-sm text-orange-600 dark:text-orange-400">
                  Note: Timeline tasks cannot change categories
                </div>
              )}
              {isTitleLocked && !isViewMode && (
                <div className="mt-2 text-sm text-orange-600 dark:text-orange-400">
                  Note: Timeline anchor points (Acceptance, Closing) cannot change names
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            {/* Task Name */}
            <div className="grid gap-3">
              <Label htmlFor="title">Task Name *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Follow up with lender"
                required
                disabled={isReadOnly || isTitleLocked}
                className={isTitleLocked ? 'opacity-60 cursor-not-allowed' : ''}
              />
            </div>

            {/* Transaction */}
            <div className="grid gap-3">
              <Label htmlFor="parse">Transaction</Label>
              <Select value={parseId} onValueChange={setParseId} disabled={isReadOnly}>
                <SelectTrigger id="parse">
                  <SelectValue placeholder="Select a transaction (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {parses.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No transactions available
                    </SelectItem>
                  ) : (
                    parses.map((parse) => (
                      <SelectItem key={parse.id} value={parse.id}>
                        {parse.propertyAddress || parse.fileName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Task Categories - Multiple Selection - 2 Column Grid */}
            <div className="grid gap-3">
              <Label>Task Category *</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="type-broker"
                    checked={taskTypes.includes("broker")}
                    onCheckedChange={() => toggleTaskType("broker")}
                    disabled={isReadOnly || isTimelineTask}
                  />
                  <Label htmlFor="type-broker" className={`font-normal ${(isReadOnly || isTimelineTask) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    Broker
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="type-escrow"
                    checked={taskTypes.includes("escrow")}
                    onCheckedChange={() => toggleTaskType("escrow")}
                    disabled={isReadOnly || isTimelineTask}
                  />
                  <Label htmlFor="type-escrow" className={`font-normal ${(isReadOnly || isTimelineTask) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    Escrow
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="type-lender"
                    checked={taskTypes.includes("lender")}
                    onCheckedChange={() => toggleTaskType("lender")}
                    disabled={isReadOnly || isTimelineTask}
                  />
                  <Label htmlFor="type-lender" className={`font-normal ${(isReadOnly || isTimelineTask) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    Lender
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="type-timeline"
                    checked={taskTypes.includes("timeline")}
                    onCheckedChange={() => toggleTaskType("timeline")}
                    disabled={isReadOnly || isTimelineTask}
                  />
                  <Label htmlFor="type-timeline" className={`font-normal ${(isReadOnly || isTimelineTask) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    Timeline
                  </Label>
                </div>
              </div>
            </div>

            {/* Due Date Type */}
            <div className="grid gap-3">
              <Label>Due Date *</Label>
              <RadioGroup value={dueDateType} onValueChange={(value: any) => setDueDateType(value)} disabled={isReadOnly}>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="specific" id="specific" disabled={isReadOnly} />
                  <Label htmlFor="specific" className={`font-normal ${isReadOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    Specific date
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="days_after_acceptance" id="days_after_acceptance" disabled={isReadOnly} />
                  <Label htmlFor="days_after_acceptance" className={`font-normal ${isReadOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    Days after acceptance
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="days_from_close" id="days_from_close" disabled={isReadOnly} />
                  <Label htmlFor="days_from_close" className={`font-normal ${isReadOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    Days from close
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Conditional Date Input */}
            {dueDateType === "specific" ? (
              <div className="grid gap-3">
                <Label htmlFor="specificDate">Date</Label>
                <Input
                  id="specificDate"
                  type="date"
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  required
                  disabled={isReadOnly}
                />
              </div>
            ) : (
              <div className="grid gap-3">
                <Label htmlFor="relativeDays">Number of Days</Label>
                <Input
                  id="relativeDays"
                  type="number"
                  min="0"
                  value={relativeDays}
                  onChange={(e) => setRelativeDays(e.target.value)}
                  placeholder="e.g., 7"
                  required
                  disabled={isReadOnly}
                />
              </div>
            )}

            {/* Status */}
            <div className="grid gap-3">
              <Label htmlFor="status">Status *</Label>
              <Select value={status} onValueChange={(value: any) => setStatus(value)} disabled={isReadOnly}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              {isViewMode ? 'Close' : 'Cancel'}
            </Button>
            {isViewMode ? (
              <Button type="button" onClick={handleSwitchToEdit}>
                Edit Task
              </Button>
            ) : (
              <Button type="submit" disabled={loading}>
                {loading
                  ? (isEditMode ? "Updating..." : "Creating...")
                  : (isEditMode ? "Update Task" : "Create Task")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

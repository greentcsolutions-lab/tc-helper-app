// src/components/tasks/NewTaskDialog.tsx
// Dialog for creating new custom tasks

"use client";

import { useState } from "react";
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
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

type Parse = {
  id: string;
  fileName: string;
  propertyAddress: string | null;
  effectiveDate: Date | string | null;
  closingDate: Date | string | null;
};

interface NewTaskDialogProps {
  parses: Parse[];
}

export default function NewTaskDialog({ parses }: NewTaskDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [parseId, setParseId] = useState<string>("");
  const [taskType, setTaskType] = useState<"broker" | "escrow" | "lender">("broker");
  const [dueDateType, setDueDateType] = useState<"specific" | "days_after_acceptance" | "days_from_close">("specific");
  const [specificDate, setSpecificDate] = useState("");
  const [relativeDays, setRelativeDays] = useState("");
  const [status, setStatus] = useState<"not_started" | "pending" | "completed">("not_started");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate required fields
      if (!title.trim()) {
        throw new Error("Task name is required");
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

      // Create the task
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          parseId: parseId || undefined,
          taskType,
          dueDate,
          dueDateType,
          dueDateValue,
          status,
          columnId: status,
          isCustom: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create task");
      }

      // Success! Close dialog and refresh
      setOpen(false);
      resetForm();
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
    setTaskType("broker");
    setDueDateType("specific");
    setSpecificDate("");
    setRelativeDays("");
    setStatus("not_started");
    setError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a custom task to your workflow. Fill in the details below.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Task Name */}
            <div className="grid gap-2">
              <Label htmlFor="title">Task Name *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Follow up with lender"
                required
              />
            </div>

            {/* Transaction */}
            <div className="grid gap-2">
              <Label htmlFor="parse">Transaction</Label>
              <Select value={parseId} onValueChange={setParseId}>
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

            {/* Task Category */}
            <div className="grid gap-2">
              <Label htmlFor="taskType">Task Category *</Label>
              <Select value={taskType} onValueChange={(value: any) => setTaskType(value)}>
                <SelectTrigger id="taskType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="broker">Broker</SelectItem>
                  <SelectItem value="escrow">Escrow</SelectItem>
                  <SelectItem value="lender">Lender</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Due Date Type */}
            <div className="grid gap-2">
              <Label>Due Date *</Label>
              <RadioGroup value={dueDateType} onValueChange={(value: any) => setDueDateType(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific" id="specific" />
                  <Label htmlFor="specific" className="font-normal cursor-pointer">
                    Specific date
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="days_after_acceptance" id="days_after_acceptance" />
                  <Label htmlFor="days_after_acceptance" className="font-normal cursor-pointer">
                    Days after acceptance
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="days_from_close" id="days_from_close" />
                  <Label htmlFor="days_from_close" className="font-normal cursor-pointer">
                    Days from close
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Conditional Date Input */}
            {dueDateType === "specific" ? (
              <div className="grid gap-2">
                <Label htmlFor="specificDate">Date</Label>
                <Input
                  id="specificDate"
                  type="date"
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="relativeDays">Number of Days</Label>
                <Input
                  id="relativeDays"
                  type="number"
                  min="0"
                  value={relativeDays}
                  onChange={(e) => setRelativeDays(e.target.value)}
                  placeholder="e.g., 7"
                  required
                />
              </div>
            )}

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={status} onValueChange={(value: any) => setStatus(value)}>
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
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

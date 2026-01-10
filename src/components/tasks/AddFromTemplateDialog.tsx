// src/components/tasks/AddFromTemplateDialog.tsx
// Dialog for adding tasks from user-defined templates

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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";
import { UserTaskTemplate } from "@/types/task";
import { toast } from "sonner";

type Parse = {
  id: string;
  fileName: string;
  propertyAddress: string | null;
  transactionType: string | null;
  effectiveDate: Date | string | null;
  closingDate: Date | string | null;
};

interface AddFromTemplateDialogProps {
  parses: Parse[];
  onTasksAdded: () => void;
}

export default function AddFromTemplateDialog({ parses, onTasksAdded }: AddFromTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parseId, setParseId] = useState<string>("");
  const [templates, setTemplates] = useState<UserTaskTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);

  const selectedParse = parses.find(p => p.id === parseId) || null;

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings/templates");
      if (!response.ok) throw new Error("Failed to fetch templates");
      const data = await response.json();

      // Filter templates by transaction type if a parse is selected
      const filtered = selectedParse
        ? data.filter((t: UserTaskTemplate) => t.fileType === selectedParse.transactionType)
        : data;

      setTemplates(filtered);
    } catch (error) {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const toggleTask = (index: number) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTasks(newSelected);
  };

  const selectAllTasks = () => {
    if (!selectedTemplate) return;
    const allIndices = new Set(selectedTemplate.tasks.map((_, i) => i));
    setSelectedTasks(allIndices);
  };

  const deselectAllTasks = () => {
    setSelectedTasks(new Set());
  };

  const handleCreateTasks = async () => {
    if (!selectedTemplate || selectedTasks.size === 0) {
      toast.error("Please select at least one task");
      return;
    }

    if (!selectedParse) {
      toast.error("Please select a transaction first");
      return;
    }

    setCreating(true);
    try {
      const tasksToCreate = Array.from(selectedTasks).map(index => {
        const templateTask = selectedTemplate.tasks[index];

        // Calculate due date based on template task settings
        const baseDate = templateTask.dueDateType === "days_after_acceptance"
          ? selectedParse.effectiveDate
          : selectedParse.closingDate;

        if (!baseDate) {
          throw new Error(`Missing ${templateTask.dueDateType === "days_after_acceptance" ? "acceptance" : "closing"} date for transaction`);
        }

        const base = new Date(baseDate);
        const dueDate = new Date(base);
        dueDate.setDate(dueDate.getDate() + templateTask.dueDateValue);

        return {
          title: templateTask.title,
          description: templateTask.description || "",
          parseId: selectedParse.id,
          taskTypes: templateTask.taskTypes,
          dueDate,
          dueDateType: templateTask.dueDateType,
          dueDateValue: templateTask.dueDateValue,
          status: "not_started",
          columnId: "not_started",
          isCustom: true,
          templateId: selectedTemplate.id,
        };
      });

      // Create all tasks
      const promises = tasksToCreate.map(task =>
        fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task),
        })
      );

      const responses = await Promise.all(promises);
      const failed = responses.filter(r => !r.ok);

      if (failed.length > 0) {
        throw new Error(`Failed to create ${failed.length} task(s)`);
      }

      toast.success(`Created ${tasksToCreate.length} task(s) from template`);
      setOpen(false);
      resetState();
      onTasksAdded();
    } catch (error: any) {
      toast.error(error.message || "Failed to create tasks");
    } finally {
      setCreating(false);
    }
  };

  const resetState = () => {
    setParseId("");
    setSelectedTemplateId(null);
    setSelectedTasks(new Set());
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetState();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Add from Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Tasks from Template</DialogTitle>
          <DialogDescription>
            Select a template and choose which tasks to add to this transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Transaction Selection */}
          <div className="space-y-2">
            <Label htmlFor="parse">Transaction *</Label>
            <Select value={parseId} onValueChange={(value) => {
              setParseId(value);
              setSelectedTemplateId(null);
              setSelectedTasks(new Set());
            }}>
              <SelectTrigger id="parse">
                <SelectValue placeholder="Select a transaction" />
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

          {!parseId ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Select a transaction to view available templates.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No templates available for this transaction type.</p>
              <p className="text-sm mt-1">Create templates in Settings to use them here.</p>
            </div>
          ) : (
            <>
              {/* Template Selection */}
              <div className="space-y-2">
                <Label>Select Template</Label>
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedTemplateId === template.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setSelectedTemplateId(template.id);
                        setSelectedTasks(new Set()); // Reset task selection
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{template.name}</h4>
                            <Badge variant="outline">{template.fileType}</Badge>
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {template.description}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.tasks.length} {template.tasks.length === 1 ? "task" : "tasks"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Task Selection */}
              {selectedTemplate && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Select Tasks to Add</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={selectAllTasks}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={deselectAllTasks}
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                    {selectedTemplate.tasks.map((task, index) => (
                      <div
                        key={index}
                        className="flex items-start space-x-3 p-2 rounded hover:bg-muted/50"
                      >
                        <Checkbox
                          id={`task-${index}`}
                          checked={selectedTasks.has(index)}
                          onCheckedChange={() => toggleTask(index)}
                        />
                        <div className="flex-1">
                          <label
                            htmlFor={`task-${index}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {task.title}
                          </label>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {task.taskTypes.map((type, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                            <span className="text-xs text-muted-foreground">
                              •{" "}
                              {task.dueDateValue} days{" "}
                              {task.dueDateType === "days_after_acceptance"
                                ? "after acceptance"
                                : "from close"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateTasks}
            disabled={!selectedTemplate || selectedTasks.size === 0 || creating}
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              `Add ${selectedTasks.size} Task${selectedTasks.size !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// src/components/settings/CreateTemplateDialog.tsx
// Reusable dialog for creating/editing task templates

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { UserTaskTemplate, TemplateTask, FILE_TYPES, TASK_TYPES, TaskType } from "@/types/task";

interface CreateTemplateDialogProps {
  template?: UserTaskTemplate | null;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isAiTemplate?: boolean; // If true, uses AI template endpoint
}

export default function CreateTemplateDialog({
  template,
  trigger,
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  isAiTemplate = false,
}: CreateTemplateDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [fileType, setFileType] = useState(template?.fileType || FILE_TYPES.ESCROW);
  const [isDefaultForNewFiles, setIsDefaultForNewFiles] = useState(template?.isDefaultForNewFiles || false);
  const [tasks, setTasks] = useState<TemplateTask[]>(template?.tasks || []);

  // Use controlled or uncontrolled state
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalOpen;

  const handleAddTask = () => {
    setTasks([
      ...tasks,
      {
        title: "",
        description: "",
        taskTypes: [],
        dueDateType: "days_after_acceptance",
        dueDateValue: 1,
      },
    ]);
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleTaskChange = (index: number, field: keyof TemplateTask, value: any) => {
    const updatedTasks = [...tasks];
    updatedTasks[index] = { ...updatedTasks[index], [field]: value };
    setTasks(updatedTasks);
  };

  const handleTaskTypeToggle = (index: number, taskType: TaskType) => {
    const updatedTasks = [...tasks];
    const currentTypes = updatedTasks[index].taskTypes;
    const newTypes = currentTypes.includes(taskType)
      ? currentTypes.filter((t) => t !== taskType)
      : [...currentTypes, taskType];
    updatedTasks[index] = { ...updatedTasks[index], taskTypes: newTypes };
    setTasks(updatedTasks);
  };

  const resetForm = () => {
    setName(template?.name || "");
    setDescription(template?.description || "");
    setFileType(template?.fileType || FILE_TYPES.ESCROW);
    setIsDefaultForNewFiles(template?.isDefaultForNewFiles || false);
    setTasks(template?.tasks || []);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }

    if (tasks.length === 0) {
      toast.error("Add at least one task to the template");
      return;
    }

    if (tasks.some((t) => !t.title.trim())) {
      toast.error("All tasks must have a title");
      return;
    }

    if (tasks.some((t) => t.taskTypes.length === 0)) {
      toast.error("All tasks must have at least one category selected");
      return;
    }

    setIsSaving(true);
    try {
      // Use different endpoint for AI templates
      const url = isAiTemplate
        ? "/api/settings/ai-template"
        : template
        ? `/api/settings/templates/${template.id}`
        : "/api/settings/templates";
      const method = isAiTemplate ? "POST" : (template ? "PATCH" : "POST");

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          fileType,
          isDefaultForNewFiles,
          tasks,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save template");
      }

      toast.success(template ? "Template updated" : "Template created");
      setOpen(false);
      resetForm();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  const dialogContent = (
    <>
      <DialogHeader>
        <DialogTitle>{template ? "Edit Template" : "Create Template"}</DialogTitle>
        <DialogDescription>
          Templates are collections of tasks that will be created for new transactions.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
        {/* Template Details */}
        <div className="space-y-2">
          <Label htmlFor="name">Template Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Standard Escrow Tasks"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this template"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fileType">File Type *</Label>
          <Select value={fileType} onValueChange={(value) => setFileType(value as typeof FILE_TYPES.ESCROW | typeof FILE_TYPES.LISTING)}>
            <SelectTrigger id="fileType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILE_TYPES.ESCROW}>Escrow</SelectItem>
              <SelectItem value={FILE_TYPES.LISTING}>Listing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2 rounded-lg border p-4">
          <Checkbox
            id="isDefaultForNewFiles"
            checked={isDefaultForNewFiles}
            onCheckedChange={(checked) => setIsDefaultForNewFiles(checked as boolean)}
          />
          <div className="flex-1">
            <label
              htmlFor="isDefaultForNewFiles"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Auto-generate on new files
            </label>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically create tasks from this template when a new file is uploaded
            </p>
          </div>
        </div>

        {/* Tasks */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Tasks</Label>
            <Button type="button" size="sm" variant="outline" onClick={handleAddTask}>
              <Plus className="h-3 w-3 mr-1" />
              Add Task
            </Button>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-6 border rounded-lg text-muted-foreground">
              <p className="text-sm">No tasks added yet. Click "Add Task" to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-3">
                      <Input
                        value={task.title}
                        onChange={(e) => handleTaskChange(index, "title", e.target.value)}
                        placeholder="Task title *"
                      />
                      <Input
                        value={task.description || ""}
                        onChange={(e) => handleTaskChange(index, "description", e.target.value)}
                        placeholder="Task description (optional)"
                      />
                      <div className="space-y-2">
                        <Label className="text-sm">Categories *</Label>
                        <div className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`task-${index}-broker`}
                              checked={task.taskTypes.includes(TASK_TYPES.BROKER)}
                              onCheckedChange={() => handleTaskTypeToggle(index, TASK_TYPES.BROKER)}
                            />
                            <label
                              htmlFor={`task-${index}-broker`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Broker
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`task-${index}-escrow`}
                              checked={task.taskTypes.includes(TASK_TYPES.ESCROW)}
                              onCheckedChange={() => handleTaskTypeToggle(index, TASK_TYPES.ESCROW)}
                            />
                            <label
                              htmlFor={`task-${index}-escrow`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Escrow
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`task-${index}-lender`}
                              checked={task.taskTypes.includes(TASK_TYPES.LENDER)}
                              onCheckedChange={() => handleTaskTypeToggle(index, TASK_TYPES.LENDER)}
                            />
                            <label
                              htmlFor={`task-${index}-lender`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Lender
                            </label>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={task.dueDateType}
                          onValueChange={(value) => handleTaskChange(index, "dueDateType", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="days_after_acceptance">Days After Acceptance</SelectItem>
                            <SelectItem value="days_from_close">Days From Close</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="0"
                          value={task.dueDateValue}
                          onChange={(e) =>
                            handleTaskChange(index, "dueDateValue", parseInt(e.target.value) || 0)
                          }
                          placeholder="Days"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveTask(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Template"}
        </Button>
      </DialogFooter>
    </>
  );

  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {dialogContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {dialogContent}
      </DialogContent>
    </Dialog>
  );
}

// Named export for convenience
export { CreateTemplateDialog };

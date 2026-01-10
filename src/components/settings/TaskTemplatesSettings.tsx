// src/components/settings/TaskTemplatesSettings.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, FileText } from "lucide-react";
import { UserTaskTemplate, TemplateTask, FILE_TYPES, TASK_TYPES, TaskType } from "@/types/task";

export default function TaskTemplatesSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<UserTaskTemplate[]>([]);
  const [planInfo, setPlanInfo] = useState<{ planType: string; templateLimit: number; templateCount: number } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<UserTaskTemplate | null>(null);

  useEffect(() => {
    fetchTemplates();
    fetchPlanInfo();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/settings/templates");
      if (!response.ok) throw new Error("Failed to fetch templates");
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      toast.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlanInfo = async () => {
    try {
      const response = await fetch("/api/settings/plan-info");
      if (!response.ok) throw new Error("Failed to fetch plan info");
      const data = await response.json();
      setPlanInfo(data);
    } catch (error) {
      console.error("Failed to load plan info:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const response = await fetch(`/api/settings/templates/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete template");
      toast.success("Template deleted");
      fetchTemplates();
      fetchPlanInfo();
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const handleEdit = (template: UserTaskTemplate) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  const canCreateTemplate = planInfo && planInfo.templateCount < planInfo.templateLimit;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-20 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Task Templates</CardTitle>
              <CardDescription>
                Create reusable task templates for your transactions
                {planInfo && (
                  <span className="block mt-1">
                    {planInfo.templateCount} / {planInfo.templateLimit} templates used
                  </span>
                )}
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleCreateNew} disabled={!canCreateTemplate}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <TemplateEditor
                  template={editingTemplate}
                  onSave={() => {
                    setIsDialogOpen(false);
                    fetchTemplates();
                    fetchPlanInfo();
                  }}
                  onCancel={() => setIsDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No templates yet. Create your first template to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{template.name}</h3>
                        <Badge variant="outline">{template.fileType}</Badge>
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {template.description}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {template.tasks.length} {template.tasks.length === 1 ? "task" : "tasks"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(template)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!canCreateTemplate && planInfo && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="p-4">
            <p className="text-sm">
              You've reached your template limit ({planInfo.templateLimit} templates).
              {planInfo.planType === "FREE" && (
                <> Upgrade to BASIC plan for up to 10 templates.</>
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Template Editor Dialog Content
interface TemplateEditorProps {
  template: UserTaskTemplate | null;
  onSave: () => void;
  onCancel: () => void;
}

function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [fileType, setFileType] = useState(template?.fileType || FILE_TYPES.ESCROW);
  const [isDefaultForNewFiles, setIsDefaultForNewFiles] = useState(template?.isDefaultForNewFiles || false);
  const [tasks, setTasks] = useState<TemplateTask[]>(template?.tasks || []);

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
      const url = template
        ? `/api/settings/templates/${template.id}`
        : "/api/settings/templates";
      const method = template ? "PATCH" : "POST";

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
      onSave();
    } catch (error: any) {
      toast.error(error.message || "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{template ? "Edit Template" : "Create Template"}</DialogTitle>
        <DialogDescription>
          Templates are collections of tasks that will be created for new transactions.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
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
            <div className="space-y-3 max-h-96 overflow-y-auto">
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

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Template"}
        </Button>
      </div>
    </>
  );
}

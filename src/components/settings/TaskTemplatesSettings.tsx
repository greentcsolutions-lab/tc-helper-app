// src/components/settings/TaskTemplatesSettings.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, FileText } from "lucide-react";
import { UserTaskTemplate } from "@/types/task";
import CreateTemplateDialog from "./CreateTemplateDialog";

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
            <CreateTemplateDialog
              template={editingTemplate}
              open={isDialogOpen}
              onOpenChange={setIsDialogOpen}
              trigger={
                <Button onClick={handleCreateNew} disabled={!canCreateTemplate}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              }
              onSuccess={() => {
                fetchTemplates();
                fetchPlanInfo();
              }}
            />
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

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Edit2, RefreshCw } from "lucide-react";
import { CreateTemplateDialog } from "./CreateTemplateDialog";
import { UserTaskTemplate, TASK_TYPES } from "@/types/task";
import { toast } from "sonner";

export default function AIGeneratedTasksSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [aiTemplate, setAiTemplate] = useState<UserTaskTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchAITemplate();
  }, []);

  const fetchAITemplate = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/settings/ai-template");
      if (!response.ok) throw new Error("Failed to fetch AI template");
      const data = await response.json();
      setAiTemplate(data.template);
    } catch (error) {
      console.error("Error fetching AI template:", error);
      toast.error("Failed to load AI Generated Tasks");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsDialogOpen(true);
  };

  const handleReset = async () => {
    if (!confirm("Reset to default AI Generated Tasks? This will overwrite your customizations.")) {
      return;
    }

    try {
      const response = await fetch("/api/settings/ai-template/reset", {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to reset AI template");

      toast.success("AI Generated Tasks reset to defaults");
      await fetchAITemplate();
    } catch (error) {
      console.error("Error resetting AI template:", error);
      toast.error("Failed to reset AI template");
    }
  };

  const handleSuccess = () => {
    setIsDialogOpen(false);
    fetchAITemplate();
  };

  if (isLoading) {
    return (
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-purple-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI Template Card with special styling */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                AI Generated Tasks
              </CardTitle>
              <CardDescription className="text-purple-700">
                Smart default tasks powered by AI
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {aiTemplate ? (
            <>
              {/* Template Info */}
              <div className="rounded-lg border border-purple-200 bg-white/70 p-4 backdrop-blur-sm">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-purple-900">{aiTemplate.name}</h3>
                    {aiTemplate.description && (
                      <p className="mt-1 text-sm text-purple-700">{aiTemplate.description}</p>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-purple-100 text-purple-700 border-purple-200"
                  >
                    {aiTemplate.fileType}
                  </Badge>
                </div>

                {/* Task List */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-purple-900">
                    {aiTemplate.tasks.length} {aiTemplate.tasks.length === 1 ? 'Task' : 'Tasks'}
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {aiTemplate.tasks.map((task, index) => (
                      <div
                        key={index}
                        className="rounded-md border border-purple-100 bg-white p-3 text-sm"
                      >
                        <div className="font-medium text-purple-900">{task.title}</div>
                        {task.description && (
                          <div className="mt-1 text-xs text-purple-600">{task.description}</div>
                        )}
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {task.taskTypes.map((type) => (
                            <Badge
                              key={type}
                              variant="outline"
                              className="text-xs border-purple-200 text-purple-700"
                            >
                              {type}
                            </Badge>
                          ))}
                          <span className="text-xs text-purple-600">
                            {task.dueDateValue} days{' '}
                            {task.dueDateType === 'days_after_acceptance'
                              ? 'after acceptance'
                              : 'from close'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={handleEdit}
                    variant="default"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit Tasks
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset to Defaults
                  </Button>
                </div>
              </div>

              {/* Info Banner */}
              <div className="rounded-lg bg-purple-100/50 p-3 text-sm text-purple-700 border border-purple-200">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-medium">These tasks are automatically generated for new transactions</p>
                    <p className="mt-1 text-xs text-purple-600">
                      This special template doesn't count against your plan limits and includes smart
                      defaults based on timeline events.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* No template yet - show create button */
            <div className="text-center py-8">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-purple-900">
                No AI Generated Tasks Yet
              </h3>
              <p className="mb-4 text-sm text-purple-700">
                Create smart default tasks that will be automatically generated for new transactions
              </p>
              <Button
                onClick={handleEdit}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Create AI Template
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {isDialogOpen && (
        <CreateTemplateDialog
          template={aiTemplate || undefined}
          onSuccess={handleSuccess}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          isAiTemplate={true}
        />
      )}
    </div>
  );
}

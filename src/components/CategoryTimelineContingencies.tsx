// src/components/CategoryTimelineContingencies.tsx
// Version: 11.0.0 - 2026-01-17
// MAJOR: Now reads ONLY from Task model - removed all Parse model dependencies
// Task model is the ONLY source of truth for timeline data
// Parse timelineDataStructured is used ONLY for immutable calculation metadata

"use client";

import { useEffect, useState } from "react";
import CategorySection, { FieldConfig } from "./CategorySection";
import { Calendar } from "lucide-react";
import { ParseResult } from "@/types";
import { formatDisplayDate } from "@/lib/date-utils";

interface TimelineTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: string; // ISO string from API
  timelineEventKey: string | null;
  status: string;
  archived: boolean;
}

interface CategoryTimelineContingenciesProps {
  data: ParseResult;
  isEditing?: boolean;
  onDataChange?: (updatedData: ParseResult) => void;
  refetchTrigger?: number; // Increment this to trigger a refetch
}

export default function CategoryTimelineContingencies({
  data,
  isEditing = false,
  onDataChange,
  refetchTrigger = 0,
}: CategoryTimelineContingenciesProps) {
  const [timelineTasks, setTimelineTasks] = useState<TimelineTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch timeline tasks when component mounts or parseId changes
  useEffect(() => {
    async function fetchTimelineTasks() {
      if (!data.id) {
        setIsLoading(false);
        setError('No transaction ID available');
        return;
      }

      try {
        const response = await fetch(`/api/tasks/timeline/${data.id}`);
        if (response.ok) {
          const result = await response.json();
          setTimelineTasks(result.tasks || []);
          setError(null);
        } else {
          console.error('Failed to fetch timeline tasks:', response.statusText);
          setError(`Failed to load timeline tasks: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error fetching timeline tasks:', error);
        setError('Failed to load timeline tasks. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTimelineTasks();
  }, [data.id, refetchTrigger]); // Refetch when parseId or refetchTrigger changes

  // Define non-waivable events (these should never show waived checkbox)
  const NON_WAIVABLE_EVENTS = ['acceptance', 'closing', 'initialDeposit'];

  // Define big 3 contingencies that always show even when archived
  const ALWAYS_SHOW_EVENTS = ['inspectionContingency', 'appraisalContingency', 'loanContingency'];

  // Helper: Format date for display (YYYY-MM-DD → MM/DD/YYYY)
  const formatDate = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string' || value.trim() === '') return null;
    try {
      return formatDisplayDate(value);
    } catch (e) {
      return value; // Return original if parsing fails
    }
  };

  // Helper: Convert MM/DD/YYYY to MM/DD/YY (2-digit year)
  const toShortYear = (dateStr: string): string => {
    const parts = dateStr.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}`;
    }
    return dateStr;
  };

  // Helper: Get formatted task display for view mode
  const getTaskDisplay = (task: TimelineTask): string | null => {
    // If archived (waived), show "Waived" text
    if (task.archived) {
      return "Waived";
    }

    if (!task.dueDate) {
      return null;
    }

    // Extract date-only part to avoid timezone issues
    const effectiveDate = task.dueDate.split('T')[0];

    // Format the date
    const displayDate = formatDate(effectiveDate);
    if (!displayDate) return null;

    const shortDate = toShortYear(displayDate);

    // Build source description from timeline metadata (immutable template only)
    let source = 'specified';
    if (task.timelineEventKey && data.timelineDataStructured) {
      const timelineData = data.timelineDataStructured as Record<string, any>;
      const event = timelineData[task.timelineEventKey];
      if (event?.dateType === 'relative') {
        const dayType = event.dayType === 'business' ? 'business days' : 'days';
        const direction = event.direction === 'before' ? 'before' : 'after';
        const anchor = event.anchorPoint || 'acceptance';
        source = `${event.relativeDays} ${dayType} ${direction} ${anchor}`;
      }
    }

    return `${shortDate} (${source})`;
  };

  // Helper: Check if task should be displayed
  const shouldShowTask = (task: TimelineTask, isEditingMode: boolean): boolean => {
    // In edit mode, show all tasks
    if (isEditingMode) {
      return true;
    }

    // In view mode:
    // Always show the big 3 contingencies (even if archived)
    if (task.timelineEventKey && ALWAYS_SHOW_EVENTS.includes(task.timelineEventKey)) {
      return true;
    }

    // Hide archived (waived) tasks (unless they're in the always-show list above)
    if (task.archived) {
      return false;
    }

    return true;
  };

  const createField = (
    label: string,
    value: any,
    type: 'text' | 'number' | 'date' | 'boolean' | 'array' = 'text',
    onChange?: (val: any) => void,
    disabled?: boolean,
    waived?: boolean,
    onWaivedChange?: (waived: boolean) => void,
    showWaivedCheckbox?: boolean
  ): FieldConfig => ({
    label,
    value,
    type,
    onChange,
    disabled,
    waived,
    onWaivedChange,
    showWaivedCheckbox,
  });

  // === DYNAMIC TIMELINE FIELD GENERATION FROM TASKS ===
  const fields: FieldConfig[] = [];

  // Filter and sort tasks
  const visibleTasks = timelineTasks
    .filter(task => shouldShowTask(task, isEditing))
    .sort((a, b) => {
      // Sort by due date
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return dateA - dateB;
    });

  // Generate fields for each visible task
  for (const task of visibleTasks) {
    // Check if this event is waivable
    const isWaivable = !task.timelineEventKey || !NON_WAIVABLE_EVENTS.includes(task.timelineEventKey);
    const isArchived = task.archived;

    // Get display value
    let displayValue: string | null = null;
    let editValue: any = '';

    if (!isEditing) {
      // View mode: show formatted date with source or "Waived"
      displayValue = getTaskDisplay(task);
    } else {
      // Edit mode: Get the task's current due date
      if (task.dueDate) {
        // Extract date-only part (YYYY-MM-DD) for date input
        editValue = task.dueDate.split('T')[0];
      } else {
        editValue = '';
      }
    }

    // Create onChange handler for the main field
    // Updates Task model DIRECTLY via /api/tasks/timeline-update
    const handleChange = async (val: any) => {
      if (!data.id || !val || !task.timelineEventKey) return;

      // Optimistically update local task state for immediate UI feedback
      setTimelineTasks(prev =>
        prev.map(t =>
          t.id === task.id
            ? { ...t, dueDate: val } // Update the dueDate
            : t
        )
      );

      try {
        // Update task directly via API
        const response = await fetch('/api/tasks/timeline-update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parseId: data.id,
            timelineEventKey: task.timelineEventKey,
            dueDate: val,
          }),
        });

        if (!response.ok) {
          // Revert optimistic update on error
          setTimelineTasks(prev =>
            prev.map(t =>
              t.id === task.id
                ? { ...t, dueDate: task.dueDate } // Revert to original
                : t
            )
          );
          console.error('Failed to update timeline task:', await response.text());
          alert('Failed to update date. Please try again.');
        } else {
          const result = await response.json();
          // Update with server response to ensure consistency
          setTimelineTasks(prev =>
            prev.map(t =>
              t.id === task.id
                ? { ...t, dueDate: result.task.dueDate }
                : t
            )
          );
        }
      } catch (error) {
        // Revert optimistic update on error
        setTimelineTasks(prev =>
          prev.map(t =>
            t.id === task.id
              ? { ...t, dueDate: task.dueDate } // Revert to original
              : t
          )
        );
        console.error('Error updating timeline task:', error);
        alert('Failed to update date. Please try again.');
      }
    };

    // Create onChange handler for waived checkbox
    // Updates Task model DIRECTLY via /api/tasks/timeline-update
    const handleWaivedChange = async (waived: boolean) => {
      if (!data.id || !task.timelineEventKey) return;

      try {
        // Update task archived status directly via API
        const response = await fetch('/api/tasks/timeline-update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parseId: data.id,
            timelineEventKey: task.timelineEventKey,
            archived: waived,
          }),
        });

        if (!response.ok) {
          console.error('Failed to update waived status:', await response.text());
          alert('Failed to update waived status. Please try again.');
          return;
        }

        // Update local state
        setTimelineTasks(prev =>
          prev.map(t =>
            t.id === task.id
              ? { ...t, archived: waived }
              : t
          )
        );

        // Also update Parse model to keep waived flag in sync for UI consistency
        if (onDataChange && data.timelineDataStructured) {
          const timelineData = data.timelineDataStructured as Record<string, any>;
          const updatedTimeline = {
            ...timelineData,
            [task.timelineEventKey]: {
              ...timelineData[task.timelineEventKey],
              waived,
            },
          };
          onDataChange({
            ...data,
            timelineDataStructured: updatedTimeline as any,
          });
        }
      } catch (error) {
        console.error('Error updating waived status:', error);
        alert('Failed to update waived status. Please try again.');
      }
    };

    // Build field with inline waived checkbox if event is waivable
    const fieldLabel = task.title;
    const fieldValue = isEditing ? editValue : displayValue;
    const fieldDisabled = isEditing && isArchived;
    const fieldType = isEditing ? 'date' : 'text'; // Date picker in edit mode

    fields.push(
      createField(
        fieldLabel,
        fieldValue,
        fieldType,
        handleChange,
        fieldDisabled,
        isArchived,
        handleWaivedChange,
        isWaivable // Show waived checkbox for waivable events
      )
    );
  }

  // Show loading state while fetching tasks
  if (isLoading) {
    return (
      <CategorySection
        title="Timeline & Contingencies"
        icon={<Calendar className="h-6 w-6 text-blue-600" />}
        fields={[]}
        categoryName="Timeline"
        defaultOpen={true}
        isEditing={isEditing}
      />
    );
  }

  // Show error state if tasks failed to load
  if (error) {
    return (
      <CategorySection
        title="Timeline & Contingencies"
        icon={<Calendar className="h-6 w-6 text-blue-600" />}
        fields={[
          {
            label: 'Error',
            value: error,
            type: 'text',
          },
        ]}
        categoryName="Timeline"
        defaultOpen={true}
        isEditing={isEditing}
      />
    );
  }

  if (fields.length === 0) return null;

  return (
    <CategorySection
      title="Timeline & Contingencies"
      icon={<Calendar className="h-6 w-6 text-blue-600" />}
      fields={fields}
      categoryName="Timeline"
      defaultOpen={true}
      isEditing={isEditing}
    />
  );
}

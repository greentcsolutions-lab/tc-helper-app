// src/components/CategoryTimelineContingencies.tsx
// Version: 10.0.0 - 2026-01-17
// MAJOR: Removed Parse model fallback - reads ONLY from Task model
// Updates tasks directly via /api/tasks/timeline-update (no Parse intermediary)
// Task model is the ONLY source of truth for timeline dates

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
  const cont = data.contingencies;
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

  // Define big 3 contingencies that always show even when waived
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

  // Helper: Get formatted timeline event display using ONLY task data
  // Task model is the ONLY source of truth for dates
  const getTimelineEventDisplay = (eventKey: string, event: any): string | null => {
    // If waived, show "Waived" text
    if (event?.waived) {
      return "Waived";
    }

    // Get date from task (ONLY source)
    const task = timelineTasks.find(t => t.timelineEventKey === eventKey);
    if (!task?.dueDate) {
      return null;
    }

    // Extract date-only part to avoid timezone issues
    // task.dueDate comes as ISO string like "2026-01-06T00:00:00.000Z"
    // We want just "2026-01-06" to avoid timezone conversion
    const effectiveDate = task.dueDate.split('T')[0];

    // Format the date (now receives date-only string YYYY-MM-DD)
    const displayDate = formatDate(effectiveDate);
    if (!displayDate) return null;

    const shortDate = toShortYear(displayDate);

    // Build source description from timeline metadata (immutable)
    let source = '';
    if (event?.dateType === 'specified') {
      source = 'specified';
    } else if (event?.dateType === 'relative') {
      const dayType = event.dayType === 'business' ? 'business days' : 'days';
      const direction = event.direction === 'before' ? 'before' : 'after';
      const anchor = event.anchorPoint || 'acceptance';
      source = `${event.relativeDays} ${dayType} ${direction} ${anchor}`;
    } else {
      source = 'specified'; // Default
    }

    return `${shortDate} (${source})`;
  };

  // Helper: Check if event is "active" (should be displayed)
  // Only shows events that have corresponding tasks
  const isEventActive = (eventKey: string, event: any, isEditingMode: boolean): boolean => {
    // Check if we have a corresponding task
    const hasTask = timelineTasks.some(t => t.timelineEventKey === eventKey);
    const hasData = hasTask;

    // In edit mode, ALWAYS show all events so user can toggle waived checkbox
    if (isEditingMode) {
      return hasData;
    }

    // In view mode:
    // Always show the big 3 contingencies (even if waived)
    if (ALWAYS_SHOW_EVENTS.includes(eventKey) && hasData) {
      return true;
    }

    // Hide waived events (unless they're in the always-show list above)
    if (event?.waived) {
      return false;
    }

    // For other events, show if they have data
    return hasData;
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

  // === DYNAMIC TIMELINE FIELD GENERATION ===
  const fields: FieldConfig[] = [];

  if (!data.timelineDataStructured || typeof data.timelineDataStructured !== 'object') {
    // No structured data available, component won't render anything
    return null;
  }

  const timelineData = data.timelineDataStructured as Record<string, any>;

  // Create array of timeline events with their data
  interface TimelineEventEntry {
    eventKey: string;
    event: any;
    displayName: string;
    sortDate: Date | null;
  }

  const timelineEntries: TimelineEventEntry[] = Object.entries(timelineData)
    .filter(([eventKey, event]) => isEventActive(eventKey, event, isEditing))
    .map(([eventKey, event]) => {
      // Get sort date and display name from task (ONLY source)
      const task = timelineTasks.find(t => t.timelineEventKey === eventKey);
      const sortDate = task?.dueDate ? new Date(task.dueDate) : null;
      const displayName = task?.title || eventKey;

      return {
        eventKey,
        event,
        displayName,
        sortDate,
      };
    });

  // Sort chronologically by task due date
  timelineEntries.sort((a, b) => {
    // Put null dates at the end
    if (!a.sortDate && !b.sortDate) return 0;
    if (!a.sortDate) return 1;
    if (!b.sortDate) return -1;
    return a.sortDate.getTime() - b.sortDate.getTime();
  });

  // Generate fields for each timeline event
  for (const entry of timelineEntries) {
    const { eventKey, event, displayName } = entry;

    // Check if this event is waivable
    const isWaivable = !NON_WAIVABLE_EVENTS.includes(eventKey);
    const isWaived = event.waived === true;

    // Get display value
    let displayValue: string | null = null;
    let editValue: any = '';

    if (!isEditing) {
      // View mode: show formatted date with source or "Waived"
      displayValue = getTimelineEventDisplay(eventKey, event);
    } else {
      // Edit mode: Get the task's current due date from Task model (ONLY source)
      const task = timelineTasks.find(t => t.timelineEventKey === eventKey);
      if (task?.dueDate) {
        // Extract date-only part (YYYY-MM-DD) to avoid timezone conversion
        editValue = task.dueDate.split('T')[0];
      } else {
        editValue = '';
      }
    }

    // Create onChange handler for the main field
    // Updates Task model DIRECTLY via /api/tasks/timeline-update
    const handleChange = async (val: any) => {
      if (!data.id || !val) return;

      const task = timelineTasks.find(t => t.timelineEventKey === eventKey);
      if (!task) {
        console.error(`No task found for eventKey: ${eventKey}`);
        return;
      }

      // Optimistically update local task state for immediate UI feedback
      setTimelineTasks(prev =>
        prev.map(t =>
          t.timelineEventKey === eventKey
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
            timelineEventKey: eventKey,
            dueDate: val,
          }),
        });

        if (!response.ok) {
          // Revert optimistic update on error
          setTimelineTasks(prev =>
            prev.map(t =>
              t.timelineEventKey === eventKey
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
              t.timelineEventKey === eventKey
                ? { ...t, dueDate: result.task.dueDate }
                : t
            )
          );
        }
      } catch (error) {
        // Revert optimistic update on error
        setTimelineTasks(prev =>
          prev.map(t =>
            t.timelineEventKey === eventKey
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
      if (!data.id) return;

      const task = timelineTasks.find(t => t.timelineEventKey === eventKey);
      if (!task) {
        console.error(`No task found for eventKey: ${eventKey}`);
        return;
      }

      try {
        // Update task archived status directly via API
        const response = await fetch('/api/tasks/timeline-update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parseId: data.id,
            timelineEventKey: eventKey,
            archived: waived,
          }),
        });

        if (!response.ok) {
          console.error('Failed to update waived status:', await response.text());
          alert('Failed to update waived status. Please try again.');
          return;
        }

        // Update Parse model to keep waived flag in sync
        // (This maintains the UI state for the waived checkbox)
        if (onDataChange) {
          const updatedTimeline = {
            ...timelineData,
            [eventKey]: {
              ...event,
              waived,
            },
          };
          onDataChange({
            ...data,
            timelineDataStructured: updatedTimeline as any,
          });
        }

        // Optionally refresh tasks to get updated server state
        // The task will be archived/unarchived, which affects its visibility
      } catch (error) {
        console.error('Error updating waived status:', error);
        alert('Failed to update waived status. Please try again.');
      }
    };

    // Build field with inline waived checkbox if event is waivable
    const fieldLabel = displayName;
    const fieldValue = isEditing ? editValue : displayValue;
    const fieldDisabled = isEditing && isWaived;
    const fieldType = isEditing ? 'date' : 'text'; // Date picker in edit mode

    fields.push(
      createField(
        fieldLabel,
        fieldValue,
        fieldType,
        handleChange,
        fieldDisabled,
        isWaived,
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

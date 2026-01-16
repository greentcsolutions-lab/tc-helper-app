// src/components/CategoryTimelineContingencies.tsx
// Version: 9.0.0 - 2026-01-16
// MAJOR: Now reads from TASKS database instead of timelineDataStructured
// Timeline data structure is preserved as immutable template
// Tasks hold the actual current dates that sync with Google Calendar

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
}

export default function CategoryTimelineContingencies({
  data,
  isEditing = false,
  onDataChange,
}: CategoryTimelineContingenciesProps) {
  const cont = data.contingencies;
  const [timelineTasks, setTimelineTasks] = useState<TimelineTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch timeline tasks when component mounts or parseId changes
  useEffect(() => {
    async function fetchTimelineTasks() {
      if (!data.id) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/tasks/timeline/${data.id}`);
        if (response.ok) {
          const result = await response.json();
          setTimelineTasks(result.tasks || []);
        } else {
          console.error('Failed to fetch timeline tasks:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching timeline tasks:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTimelineTasks();
  }, [data.id]);

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

  // Helper: Get formatted timeline event display using task data for current date
  // but timelineDataStructured for calculation metadata
  const getTimelineEventDisplay = (eventKey: string, event: any): string | null => {
    // If waived, show "Waived" text
    if (event?.waived) {
      return "Waived";
    }

    // Find the corresponding task for this event
    const task = timelineTasks.find(t => t.timelineEventKey === eventKey);

    if (!task || !task.dueDate) {
      return null;
    }

    // Format the task due date (current date)
    const displayDate = formatDate(task.dueDate);
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
  const isEventActive = (eventKey: string, event: any, isEditingMode: boolean): boolean => {
    // Check if we have a corresponding task
    const hasTask = timelineTasks.some(t => t.timelineEventKey === eventKey);

    // In edit mode, ALWAYS show all events so user can toggle waived checkbox
    if (isEditingMode) {
      return hasTask; // Only show if task exists
    }

    // In view mode:
    // Always show the big 3 contingencies (even if waived)
    if (ALWAYS_SHOW_EVENTS.includes(eventKey) && hasTask) {
      return true;
    }

    // Hide waived events (unless they're in the always-show list above)
    if (event?.waived) {
      return false;
    }

    // For other events, show if they have a task
    return hasTask;
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
      // Find corresponding task for sort date
      const task = timelineTasks.find(t => t.timelineEventKey === eventKey);
      const sortDate = task?.dueDate ? new Date(task.dueDate) : null;

      return {
        eventKey,
        event,
        displayName: task?.title || event.displayName || eventKey,
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
      // Edit mode: Get the task's current due date
      const task = timelineTasks.find(t => t.timelineEventKey === eventKey);

      if (task?.dueDate) {
        // Convert ISO string to YYYY-MM-DD for date input
        editValue = task.dueDate.split('T')[0];
      } else {
        editValue = '';
      }
    }

    // Create onChange handler for the main field
    // Updates timelineDataStructured which will be intercepted by the API to update tasks
    const handleChange = (val: any) => {
      if (!onDataChange) return;

      // Get the task to preserve other metadata
      const task = timelineTasks.find(t => t.timelineEventKey === eventKey);

      // Update timelineDataStructured with new effectiveDate
      // The API will intercept this and update the task instead
      const updatedTimeline = {
        ...timelineData,
        [eventKey]: {
          ...event,
          effectiveDate: val, // New date from user input
          displayName: task?.title || event.displayName,
        },
      };

      onDataChange({
        ...data,
        timelineDataStructured: updatedTimeline as any,
      });
    };

    // Create onChange handler for waived checkbox
    const handleWaivedChange = (waived: boolean) => {
      if (!onDataChange) return;

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

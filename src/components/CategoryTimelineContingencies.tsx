// src/components/CategoryTimelineContingencies.tsx
// Version: 8.0.0 - 2026-01-15
// FIXED: Waived checkbox now inline with input field, always visible
// UPDATED: Waived events hidden from view mode (except big 3 contingencies which always show)
// UPDATED: Disabled input fields when waived checkbox is checked

import CategorySection, { FieldConfig } from "./CategorySection";
import { Calendar } from "lucide-react";
import { ParseResult } from "@/types";
import { formatDisplayDate } from "@/lib/date-utils";

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

  // Helper: Get formatted timeline event from structured data
  const getTimelineEventDisplay = (event: any): string | null => {
    if (!event || !event.effectiveDate) {
      return null;
    }

    // If waived, show "Waived" text
    if (event.waived) {
      return "Waived";
    }

    // Format the effective date
    const displayDate = formatDate(event.effectiveDate);
    if (!displayDate) return null;

    const shortDate = toShortYear(displayDate);

    // Build source description
    let source = '';
    if (event.dateType === 'specified') {
      source = 'specified';
    } else if (event.dateType === 'relative') {
      const dayType = event.dayType === 'business' ? 'business days' : 'days';
      const direction = event.direction === 'before' ? 'before' : 'after';
      const anchor = event.anchorPoint || 'acceptance';
      source = `${event.relativeDays} ${dayType} ${direction} ${anchor}`;
    }

    return `${shortDate} (${source})`;
  };

  // Helper: Check if event is "active" (should be displayed)
  const isEventActive = (eventKey: string, event: any, isEditingMode: boolean): boolean => {
    // In edit mode, ALWAYS show all events so user can toggle waived checkbox
    if (isEditingMode) {
      return true;
    }

    // In view mode:
    // Always show the big 3 contingencies (even if waived)
    if (ALWAYS_SHOW_EVENTS.includes(eventKey)) {
      return true;
    }

    // Hide waived events (unless they're in the always-show list above)
    if (event?.waived) {
      return false;
    }

    // For other events, show if they have an effectiveDate
    return event?.effectiveDate != null;
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
    effectiveDate: string | null;
    sortDate: Date | null;
  }

  const timelineEntries: TimelineEventEntry[] = Object.entries(timelineData)
    .filter(([eventKey, event]) => isEventActive(eventKey, event, isEditing))
    .map(([eventKey, event]) => ({
      eventKey,
      event,
      displayName: event.displayName || eventKey,
      effectiveDate: event.effectiveDate,
      sortDate: event.effectiveDate ? new Date(event.effectiveDate) : null,
    }));

  // Sort chronologically by effectiveDate
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
      displayValue = getTimelineEventDisplay(event);
    } else {
      // Edit mode: need to map to the appropriate edit field
      // For the big 3 contingencies, use the contingencies object
      // For other timeline events, we'll need different logic

      if (eventKey === 'inspectionContingency') {
        editValue = cont?.inspectionDays ?? '';
      } else if (eventKey === 'appraisalContingency') {
        editValue = cont?.appraisalDays ?? '';
      } else if (eventKey === 'loanContingency') {
        editValue = cont?.loanDays ?? '';
      } else if (eventKey === 'closing') {
        editValue = data.closingDate ?? '';
      } else if (eventKey === 'initialDeposit') {
        editValue = data.initialDepositDueDate ?? '';
      } else if (eventKey === 'sellerDisclosures') {
        editValue = data.sellerDeliveryOfDisclosuresDate ?? '';
      } else {
        // For other events, show the effectiveDate or relativeDays
        if (event.dateType === 'specified') {
          editValue = event.specifiedDate ?? '';
        } else if (event.dateType === 'relative') {
          editValue = event.relativeDays ?? '';
        }
      }
    }

    // Create onChange handler for the main field
    const handleChange = (val: any) => {
      if (!onDataChange) return;

      // Map back to the appropriate field for database update
      if (eventKey === 'inspectionContingency') {
        onDataChange({
          ...data,
          contingencies: { ...cont!, inspectionDays: val },
        });
      } else if (eventKey === 'appraisalContingency') {
        onDataChange({
          ...data,
          contingencies: { ...cont!, appraisalDays: val },
        });
      } else if (eventKey === 'loanContingency') {
        onDataChange({
          ...data,
          contingencies: { ...cont!, loanDays: val },
        });
      } else if (eventKey === 'closing') {
        onDataChange({ ...data, closingDate: val });
      } else if (eventKey === 'initialDeposit') {
        onDataChange({ ...data, initialDepositDueDate: val });
      } else if (eventKey === 'sellerDisclosures') {
        onDataChange({ ...data, sellerDeliveryOfDisclosuresDate: val });
      } else {
        // For other timeline events, we need to update timelineDataStructured
        const updatedTimeline = {
          ...timelineData,
          [eventKey]: {
            ...event,
            ...(event.dateType === 'specified'
              ? { specifiedDate: val }
              : { relativeDays: parseInt(val, 10) || 0 }),
          },
        };
        onDataChange({
          ...data,
          timelineDataStructured: updatedTimeline as any,
        });
      }
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

    fields.push(
      createField(
        fieldLabel,
        fieldValue,
        'text',
        handleChange,
        fieldDisabled,
        isWaived,
        handleWaivedChange,
        isWaivable // Show waived checkbox for waivable events
      )
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

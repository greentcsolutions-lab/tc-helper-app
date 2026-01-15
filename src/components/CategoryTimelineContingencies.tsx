// src/components/CategoryTimelineContingencies.tsx
// Version: 6.0.0 - 2026-01-15
// MAJOR REFACTOR: Dynamically displays ALL active timeline events in chronological order
// UPDATED: Moved Sale of Buyer Property to Purchase Terms
// UPDATED: Always shows Inspection/Appraisal/Loan contingencies even if waived

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
  const isEventActive = (eventKey: string, event: any): boolean => {
    // Always show the big 3 universal contingencies
    const alwaysShow = ['inspectionContingency', 'appraisalContingency', 'loanContingency'];
    if (alwaysShow.includes(eventKey)) {
      return true;
    }

    // For other events, show if they have an effectiveDate
    return event?.effectiveDate != null;
  };

  const createField = (
    label: string,
    value: any,
    type: 'text' | 'number' | 'date' | 'boolean' | 'array' = 'text',
    onChange?: (val: any) => void
  ): FieldConfig => ({
    label,
    value,
    type,
    onChange,
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
    .filter(([eventKey, event]) => isEventActive(eventKey, event))
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

    // Get display value
    let displayValue: string | null = null;
    let editValue: any = '';

    if (!isEditing) {
      // View mode: show formatted date with source
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

    // Create onChange handler
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

    fields.push(
      createField(
        displayName,
        isEditing ? editValue : displayValue,
        'text',
        handleChange
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

'use client';

// src/components/wizard/steps/TimelineDatesStep.tsx
// Step 8: Timeline Dates with flexible input (days or specific dates)

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ManualTransactionData, CA_DEFAULT_TIMELINE_DAYS } from '@/types/manual-wizard';
import {
  calculateTimelineDate,
  formatDisplayDate,
} from '@/lib/date-utils';
import { Calendar, Hash } from 'lucide-react';

interface Props {
  data: Partial<ManualTransactionData>;
  updateData: (updates: Partial<ManualTransactionData>) => void;
  userState: string;
}

interface TimelineField {
  key: keyof typeof CA_DEFAULT_TIMELINE_DAYS;
  label: string;
  description: string;
  useBusinessDays: boolean;
  required: boolean;
  isContingency?: boolean;
}

const TIMELINE_FIELDS: TimelineField[] = [
  {
    key: 'closingDays',
    label: 'Closing Date',
    description: 'Calendar days from acceptance',
    useBusinessDays: false,
    required: true,
  },
  {
    key: 'initialDepositDays',
    label: 'Initial Deposit (Earnest Money)',
    description: 'Business days from acceptance',
    useBusinessDays: true,
    required: true,
  },
  {
    key: 'sellerDeliveryDays',
    label: 'Seller Delivery of Disclosures',
    description: 'Calendar days from acceptance',
    useBusinessDays: false,
    required: true,
  },
  {
    key: 'inspectionDays',
    label: 'Inspection Contingency',
    description: 'Calendar days from acceptance',
    useBusinessDays: false,
    required: false,
    isContingency: true,
  },
  {
    key: 'appraisalDays',
    label: 'Appraisal Contingency',
    description: 'Calendar days from acceptance',
    useBusinessDays: false,
    required: false,
    isContingency: true,
  },
  {
    key: 'loanDays',
    label: 'Loan Contingency',
    description: 'Calendar days from acceptance',
    useBusinessDays: false,
    required: false,
    isContingency: true,
  },
];

export default function TimelineDatesStep({ data, updateData, userState }: Props) {
  const timeline = data.timeline || {};
  const acceptanceDate = timeline.acceptanceDate || '';

  // Track which fields are in "date mode" vs "days mode"
  const [dateMode, setDateMode] = useState<Record<string, boolean>>({});

  const handleFieldChange = (
    key: keyof typeof CA_DEFAULT_TIMELINE_DAYS,
    value: string,
    isDateMode: boolean
  ) => {
    let parsedValue: number | string | null = value;

    if (isDateMode) {
      // In date mode, store as YYYY-MM-DD
      parsedValue = value || null;
    } else {
      // In days mode, parse as number
      if (value === '' || value === null) {
        parsedValue = null;
      } else if (!isNaN(parseInt(value, 10))) {
        parsedValue = parseInt(value, 10);
      }
    }

    updateData({
      timeline: {
        ...timeline,
        [key]: parsedValue,
      },
    });
  };

  const handleWaive = (key: keyof typeof CA_DEFAULT_TIMELINE_DAYS) => {
    updateData({
      timeline: {
        ...timeline,
        [key]: 'Waived',
      },
    });
  };

  const getDisplayValue = (
    key: keyof typeof CA_DEFAULT_TIMELINE_DAYS,
    isDateMode: boolean
  ): string => {
    const value = timeline[key];

    if (value === 'Waived') return 'Waived';
    if (!value) return '';

    if (isDateMode) {
      // Show as date
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return value;
      }
      // If it's a number of days, calculate the date
      if (typeof value === 'number' && acceptanceDate) {
        const field = TIMELINE_FIELDS.find(f => f.key === key);
        return calculateTimelineDate(acceptanceDate, value, field?.useBusinessDays || false);
      }
      return '';
    } else {
      // Show as days
      if (typeof value === 'number') return value.toString();
      return '';
    }
  };

  const getCalculatedDate = (
    key: keyof typeof CA_DEFAULT_TIMELINE_DAYS,
    useBusinessDays: boolean
  ): string => {
    if (!acceptanceDate) return '';

    const value = timeline[key];
    if (value === 'Waived') return '';

    // If it's already a date string (YYYY-MM-DD), return it formatted
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return formatDisplayDate(value);
    }

    // If it's a number of days, calculate the date
    if (typeof value === 'number') {
      const calculated = calculateTimelineDate(acceptanceDate, value, useBusinessDays);
      return formatDisplayDate(calculated);
    }

    return '';
  };

  const allRequiredFilled = TIMELINE_FIELDS.filter((f) => f.required).every(
    (f) => timeline[f.key] && timeline[f.key] !== ''
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Set your transaction timeline. Toggle between days from acceptance or specific dates.
        </p>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs text-blue-800">
            <span className="font-semibold">Default Values:</span> Common
            timeline values have been pre-filled. You can modify any of these.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {TIMELINE_FIELDS.map((field) => {
          const value = timeline[field.key];
          const isWaived = value === 'Waived';
          const isInDateMode = dateMode[field.key] || false;
          const displayValue = getDisplayValue(field.key, isInDateMode);
          const calculatedDate = getCalculatedDate(field.key, field.useBusinessDays);

          return (
            <div key={field.key} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium block">
                    {field.label}{' '}
                    {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {field.description}
                    {field.useBusinessDays && (
                      <span className="ml-1 font-semibold">(Business Days)</span>
                    )}
                  </p>
                </div>

                {/* Mode Toggle */}
                <div className="flex items-center gap-1 bg-gray-100 rounded p-1">
                  <button
                    type="button"
                    onClick={() => setDateMode(prev => ({ ...prev, [field.key]: false }))}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      !isInDateMode
                        ? 'bg-white shadow-sm font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Hash className="h-3 w-3 inline mr-1" />
                    Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateMode(prev => ({ ...prev, [field.key]: true }))}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      isInDateMode
                        ? 'bg-white shadow-sm font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Date
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  {isInDateMode ? (
                    <Input
                      type="date"
                      value={displayValue}
                      onChange={(e) => handleFieldChange(field.key, e.target.value, true)}
                      disabled={isWaived}
                      className={isWaived ? 'opacity-50' : ''}
                    />
                  ) : (
                    <Input
                      type="number"
                      placeholder={isWaived ? 'Waived' : 'Number of days'}
                      value={displayValue}
                      onChange={(e) => handleFieldChange(field.key, e.target.value, false)}
                      disabled={isWaived}
                      className={isWaived ? 'opacity-50' : ''}
                    />
                  )}
                </div>

                {field.isContingency && (
                  <Button
                    type="button"
                    variant={isWaived ? 'default' : 'outline'}
                    onClick={() =>
                      isWaived
                        ? handleFieldChange(field.key, '', false)
                        : handleWaive(field.key)
                    }
                    className="shrink-0"
                  >
                    {isWaived ? 'Un-waive' : 'Waived'}
                  </Button>
                )}
              </div>

              {calculatedDate && !isWaived && (
                <div className="bg-green-50 border border-green-200 rounded p-2">
                  <p className="text-xs text-green-800">
                    <span className="font-semibold">Target Date:</span> {calculatedDate}
                  </p>
                </div>
              )}

              {isWaived && (
                <div className="bg-gray-100 border border-gray-300 rounded p-2">
                  <p className="text-xs text-gray-600">
                    This contingency has been waived
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allRequiredFilled && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800 font-medium">
            All required timeline dates have been set
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

// src/components/wizard/steps/TimelineDatesStep.tsx
// Step 8: Timeline Dates with CA defaults and flexible input

import { Input } from '@/components/ui/input';
import { ManualTransactionData, CA_DEFAULT_TIMELINE_DAYS } from '@/types/manual-wizard';
import {
  calculateTimelineDate,
  formatDisplayDate,
  parseUserDate,
} from '@/lib/date-utils';
import { Calendar, Info } from 'lucide-react';

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
}

const TIMELINE_FIELDS: TimelineField[] = [
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
  },
  {
    key: 'appraisalDays',
    label: 'Appraisal Contingency',
    description: 'Calendar days from acceptance',
    useBusinessDays: false,
    required: false,
  },
  {
    key: 'loanDays',
    label: 'Loan Contingency',
    description: 'Calendar days from acceptance',
    useBusinessDays: false,
    required: false,
  },
  {
    key: 'closingDays',
    label: 'Closing Date',
    description: 'Calendar days from acceptance',
    useBusinessDays: false,
    required: true,
  },
];

export default function TimelineDatesStep({ data, updateData, userState }: Props) {
  const timeline = data.timeline || {};
  const acceptanceDate = timeline.acceptanceDate || '';

  const handleFieldChange = (
    key: keyof typeof CA_DEFAULT_TIMELINE_DAYS,
    value: string
  ) => {
    // Allow either number input (days) or date format (MM/DD/YYYY)
    let parsedValue: number | string = value;

    // Check if it's a date format
    if (value.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const isoDate = parseUserDate(value);
      if (isoDate) {
        parsedValue = isoDate;
      }
    } else if (value.match(/^\d+$/)) {
      // It's a number of days
      parsedValue = parseInt(value, 10);
    }

    updateData({
      timeline: {
        ...timeline,
        [key]: parsedValue,
      },
    });
  };

  const getCalculatedDate = (
    key: keyof typeof CA_DEFAULT_TIMELINE_DAYS,
    useBusinessDays: boolean
  ): string => {
    if (!acceptanceDate) return '';

    const value = timeline[key];

    // If it's already a date string (YYYY-MM-DD), return it formatted
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return formatDisplayDate(value);
    }

    // If it's a number of days, calculate the date
    if (typeof value === 'number') {
      const calculated = calculateTimelineDate(
        acceptanceDate,
        value,
        useBusinessDays
      );
      return formatDisplayDate(calculated);
    }

    return '';
  };

  const allRequiredFilled = TIMELINE_FIELDS.filter((f) => f.required).every(
    (f) => timeline[f.key]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Set your transaction timeline. You can enter either the number of days
          from acceptance or a specific date (MM/DD/YYYY).
        </p>
        {userState === 'CA' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-800">
              <span className="font-semibold">California Defaults:</span> Default
              values have been pre-filled based on standard CA timelines. You can
              modify any of these values.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {TIMELINE_FIELDS.map((field) => {
          const value = timeline[field.key];
          const displayValue =
            typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)
              ? formatDisplayDate(value)
              : value?.toString() || '';

          const calculatedDate = getCalculatedDate(
            field.key,
            field.useBusinessDays
          );

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
              </div>

              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Days or MM/DD/YYYY"
                    value={displayValue}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  />
                  {calculatedDate && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Calendar className="h-4 w-4 text-green-500" />
                    </div>
                  )}
                </div>
              </div>

              {calculatedDate && (
                <div className="bg-green-50 border border-green-200 rounded p-2">
                  <p className="text-xs text-green-800">
                    <span className="font-semibold">Target Date:</span>{' '}
                    {calculatedDate}
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

      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-semibold mb-1">Date Calculation Rules:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                <strong>Initial Deposit:</strong> Calculated using business days
                (excludes weekends and holidays)
              </li>
              <li>
                <strong>Other Dates:</strong> Calculated using calendar days, but
                adjusted forward if they fall on weekends or holidays
              </li>
              <li>
                You can override any calculated date by entering a specific date
                in MM/DD/YYYY format
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

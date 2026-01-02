'use client';

// src/components/wizard/steps/AcceptanceDateStep.tsx
// Step 7: Acceptance Date (calendar + text input for MM/DD/YYYY)

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ManualTransactionData } from '@/types/manual-wizard';
import { Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { parseUserDate, formatDisplayDate } from '@/lib/date-utils';

interface Props {
  data: Partial<ManualTransactionData>;
  updateData: (updates: Partial<ManualTransactionData>) => void;
}

export default function AcceptanceDateStep({ data, updateData }: Props) {
  const [dateInput, setDateInput] = useState('');
  const [error, setError] = useState('');

  const acceptanceDate = data.timeline?.acceptanceDate || '';

  const handleDateChange = (value: string) => {
    setDateInput(value);
    setError('');

    // Try to parse MM/DD/YYYY format
    if (value.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const isoDate = parseUserDate(value);
      if (isoDate) {
        updateData({
          timeline: {
            ...data.timeline,
            acceptanceDate: isoDate,
          },
        });
      } else {
        setError('Invalid date format');
      }
    }
  };

  const handleCalendarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isoDate = e.target.value; // Format: YYYY-MM-DD
    updateData({
      timeline: {
        ...data.timeline,
        acceptanceDate: isoDate,
      },
    });

    // Update text input to show MM/DD/YYYY format
    if (isoDate) {
      setDateInput(formatDisplayDate(isoDate));
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Enter the acceptance date for this transaction. This is the date when
          the purchase agreement was fully executed by all parties.
        </p>
        <p className="text-xs text-muted-foreground italic">
          This date will be used as the reference point (Day 0) for calculating
          all timeline dates.
        </p>
      </div>

      {/* Text Input for MM/DD/YYYY */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Enter Date (MM/DD/YYYY) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="MM/DD/YYYY (e.g., 01/15/2026)"
            value={dateInput}
            onChange={(e) => handleDateChange(e.target.value)}
            className={`pl-10 ${error ? 'border-red-500' : ''}`}
          />
          {acceptanceDate && !error && (
            <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
          )}
          {error && (
            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
          )}
        </div>
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>

      {/* OR Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t border-gray-300" />
        <span className="text-sm text-muted-foreground">OR</span>
        <div className="flex-1 border-t border-gray-300" />
      </div>

      {/* Calendar Picker */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Select from Calendar
        </label>
        <Input
          type="date"
          value={acceptanceDate}
          onChange={handleCalendarChange}
          className="w-full"
        />
      </div>

      {acceptanceDate && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Acceptance Date Set
            </p>
          </div>
          <p className="text-sm text-green-700">
            <span className="font-medium">Date:</span>{' '}
            {formatDisplayDate(acceptanceDate)}
          </p>
          <p className="text-xs text-green-600 mt-2">
            This is Day 0 for your transaction timeline. All other dates will be
            calculated from this date.
          </p>
        </div>
      )}

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-xs text-blue-800">
          <span className="font-semibold">Important:</span> The acceptance date
          is when all parties (buyer and seller) have signed the purchase
          agreement, not when the offer was first submitted.
        </p>
      </div>
    </div>
  );
}

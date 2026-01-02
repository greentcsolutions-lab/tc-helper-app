'use client';

// src/components/wizard/steps/AcceptanceDateStep.tsx
// Step 7: Acceptance Date (single field with calendar icon)

import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { ManualTransactionData } from '@/types/manual-wizard';
import { Calendar, CheckCircle } from 'lucide-react';
import { parseUserDate, formatDisplayDate } from '@/lib/date-utils';

interface Props {
  data: Partial<ManualTransactionData>;
  updateData: (updates: Partial<ManualTransactionData>) => void;
}

export default function AcceptanceDateStep({ data, updateData }: Props) {
  const [dateInput, setDateInput] = useState('');
  const [error, setError] = useState('');
  const datePickerRef = useRef<HTMLInputElement>(null);

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

  const handleIconClick = () => {
    datePickerRef.current?.showPicker?.();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Acceptance Date</label>
        <p className="text-sm text-muted-foreground">
          Enter the acceptance date for this transaction. This is Day 0 for
          calculating all timeline dates.
        </p>
      </div>

      <div className="relative">
        <Input
          placeholder="MM/DD/YYYY or use calendar icon"
          value={dateInput || (acceptanceDate ? formatDisplayDate(acceptanceDate) : '')}
          onChange={(e) => handleDateChange(e.target.value)}
          className={`pr-20 ${error ? 'border-red-500' : acceptanceDate ? 'border-green-500' : ''}`}
        />

        {/* Calendar Icon Button */}
        <button
          type="button"
          onClick={handleIconClick}
          className="absolute right-10 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Hidden date picker */}
        <input
          ref={datePickerRef}
          type="date"
          value={acceptanceDate}
          onChange={handleCalendarChange}
          className="absolute right-0 top-0 opacity-0 w-0 h-0"
        />

        {acceptanceDate && !error && (
          <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

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

      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">Tip:</span> The acceptance date is when
          all parties have signed the purchase agreement, not when the offer was
          first submitted.
        </p>
      </div>
    </div>
  );
}

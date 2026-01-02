'use client';

// src/components/wizard/steps/PropertyAddressStep.tsx
// Step 1: Property Address with address lookup

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ManualTransactionData } from '@/types/manual-wizard';
import { MapPin, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  data: Partial<ManualTransactionData>;
  updateData: (updates: Partial<ManualTransactionData>) => void;
}

// US States
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export default function PropertyAddressStep({ data, updateData }: Props) {
  const [addressInput, setAddressInput] = useState(data.propertyAddress || '');
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<
    'idle' | 'valid' | 'invalid'
  >('idle');

  const handleAddressChange = (value: string) => {
    setAddressInput(value);
    setValidationStatus('idle');
  };

  const validateAddress = async () => {
    if (!addressInput.trim()) return;

    setIsValidating(true);
    setValidationStatus('idle');

    // Basic address validation - extract state from address
    // Format expected: "123 Main St, City, ST 12345"
    const stateMatch = addressInput.match(/,\s*([A-Z]{2})\s+\d{5}/);
    const extractedState = stateMatch ? stateMatch[1] : '';

    // Simulate validation delay (replace with actual API call if needed)
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (extractedState && US_STATES.includes(extractedState)) {
      setValidationStatus('valid');
      updateData({
        propertyAddress: addressInput.trim(),
        state: extractedState,
      });
    } else {
      setValidationStatus('invalid');
    }

    setIsValidating(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      validateAddress();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Property Address</label>
        <p className="text-sm text-muted-foreground">
          Enter the full property address including city, state, and ZIP code.
        </p>
        <p className="text-xs text-muted-foreground italic">
          Example: 123 Main Street, Los Angeles, CA 90001
        </p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            placeholder="123 Main Street, City, ST 12345"
            value={addressInput}
            onChange={(e) => handleAddressChange(e.target.value)}
            onKeyPress={handleKeyPress}
            className={`pr-10 ${
              validationStatus === 'valid'
                ? 'border-green-500'
                : validationStatus === 'invalid'
                  ? 'border-red-500'
                  : ''
            }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {validationStatus === 'valid' && (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            {validationStatus === 'invalid' && (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
          </div>
        </div>
        <Button
          onClick={validateAddress}
          disabled={!addressInput.trim() || isValidating}
          variant="outline"
        >
          <MapPin className="h-4 w-4 mr-2" />
          {isValidating ? 'Validating...' : 'Validate'}
        </Button>
      </div>

      {validationStatus === 'invalid' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">
            Unable to validate address. Please ensure it includes the full address
            with city, state (2-letter abbreviation), and ZIP code.
          </p>
        </div>
      )}

      {validationStatus === 'valid' && data.state && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Address Validated
            </p>
          </div>
          <div className="text-sm text-green-700">
            <p>
              <span className="font-medium">Address:</span> {data.propertyAddress}
            </p>
            <p>
              <span className="font-medium">State:</span> {data.state}
            </p>
            {data.state === 'CA' && (
              <p className="mt-2 text-xs bg-blue-50 border border-blue-200 rounded p-2">
                California property detected. Default timeline values will be
                pre-filled in later steps.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-xs text-blue-800">
          <span className="font-semibold">Note:</span> The state is important as
          it determines state-specific default values and requirements for your
          transaction timeline.
        </p>
      </div>
    </div>
  );
}

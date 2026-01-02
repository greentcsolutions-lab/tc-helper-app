'use client';

// src/components/wizard/steps/PropertyAddressStep.tsx
// Step 1: Property Address with dynamic autocomplete suggestions

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { ManualTransactionData } from '@/types/manual-wizard';
import { MapPin, CheckCircle } from 'lucide-react';

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

// Mock address suggestions - in production, replace with real API call
const mockAddressSuggestions = (query: string): string[] => {
  if (query.length < 3) return [];

  // Simple mock suggestions based on query
  const mockAddresses = [
    '1902 Wright Place, Carlsbad, CA, USA',
    '1902 Wright Street, Los Angeles, CA, USA',
    '1902 Wright Avenue, San Diego, CA, USA',
    '1902 Wright Court, Sacramento, CA, USA',
  ];

  return mockAddresses.filter(addr =>
    addr.toLowerCase().includes(query.toLowerCase())
  );
};

export default function PropertyAddressStep({ data, updateData }: Props) {
  const [addressInput, setAddressInput] = useState(data.propertyAddress || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Handle clicks outside to close suggestions
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddressChange = (value: string) => {
    setAddressInput(value);
    setSelectedIndex(-1);

    // Get suggestions
    if (value.length >= 3) {
      const newSuggestions = mockAddressSuggestions(value);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (address: string) => {
    setAddressInput(address);
    setShowSuggestions(false);

    // Extract state from address
    const stateMatch = address.match(/,\s*([A-Z]{2})[,\s]/);
    const extractedState = stateMatch ? stateMatch[1] : '';

    if (extractedState && US_STATES.includes(extractedState)) {
      updateData({
        propertyAddress: address,
        state: extractedState,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const isValid = data.propertyAddress && data.state;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Property Address</label>
        <p className="text-sm text-muted-foreground">
          Enter the property address. Suggestions will appear as you type.
        </p>
      </div>

      <div className="relative">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Start typing an address..."
            value={addressInput}
            onChange={(e) => handleAddressChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            className={`pl-10 ${isValid ? 'border-green-500' : ''}`}
          />
          {isValid && (
            <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            <div className="py-1">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  className={`w-full px-3 py-2 text-left hover:bg-gray-100 cursor-pointer flex items-start gap-2 ${
                    index === selectedIndex ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => selectSuggestion(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isValid && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Address Confirmed
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

      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">Tip:</span> The state is important as
          it determines state-specific default values for your transaction
          timeline.
        </p>
      </div>
    </div>
  );
}

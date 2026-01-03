'use client';

// src/components/wizard/steps/PropertyAddressStep.tsx
// Step 1: Property Address with dynamic autocomplete suggestions

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ManualTransactionData } from '@/types/manual-wizard';
import { MapPin, CheckCircle, Edit, Search } from 'lucide-react';

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

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function PropertyAddressStep({ data, updateData }: Props) {
  const [addressInput, setAddressInput] = useState(data.propertyAddress || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(addressInput, 300);

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

  // Fetch suggestions from Mapbox API
  useEffect(() => {
    if (isManualEntry || debouncedQuery.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setError(null);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/address/autosuggest?query=${encodeURIComponent(debouncedQuery)}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch address suggestions');
        }

        const data = await response.json();
        const addresses = data.suggestions.map((s: any) => s.address);

        setSuggestions(addresses);
        setShowSuggestions(addresses.length > 0);
      } catch (err) {
        console.error('Error fetching suggestions:', err);
        setError('Unable to fetch address suggestions');
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery, isManualEntry]);

  const handleAddressChange = (value: string) => {
    setAddressInput(value);
    setSelectedIndex(-1);

    // In manual entry mode, update parent data immediately
    if (isManualEntry) {
      updateData({ propertyAddress: value });
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

  const toggleManualEntry = () => {
    const newManualEntryState = !isManualEntry;
    setIsManualEntry(newManualEntryState);
    setShowSuggestions(false);
    setSuggestions([]);
    setError(null);

    // When switching to manual entry mode, preserve the typed address
    if (newManualEntryState && addressInput) {
      updateData({ propertyAddress: addressInput });
    }
  };

  const isValid = data.propertyAddress && data.state;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Property Address</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleManualEntry}
            className="text-xs"
          >
            {isManualEntry ? (
              <>
                <Search className="h-3 w-3 mr-1" />
                Lookup Address
              </>
            ) : (
              <>
                <Edit className="h-3 w-3 mr-1" />
                Manually Add Address
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {isManualEntry
            ? 'Enter the property address manually.'
            : 'Start typing to see address suggestions from Mapbox.'}
        </p>
      </div>

      <div className="relative">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={isManualEntry ? "Enter address manually..." : "Start typing an address..."}
            value={addressInput}
            onChange={(e) => handleAddressChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0 && !isManualEntry) {
                setShowSuggestions(true);
              }
            }}
            className={`pl-10 ${isValid ? 'border-green-500' : ''} ${error ? 'border-red-500' : ''}`}
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}
          {isValid && !isLoading && (
            <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && !isManualEntry && (
          <div
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            <div className="py-1">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b flex items-center justify-between">
                <span>Suggestions from Mapbox</span>
                {isLoading && (
                  <div className="h-3 w-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                )}
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

      {/* Manual Entry Helper */}
      {isManualEntry && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-700">
              Manual entry mode enabled. Enter the address and select the state.
            </p>
          </div>

          {/* State Selector for Manual Entry */}
          <div className="space-y-2">
            <label className="text-sm font-medium">State</label>
            <Select
              value={data.state || ''}
              onValueChange={(value) => {
                updateData({
                  propertyAddress: addressInput,
                  state: value
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state..." />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

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
          </div>
        </div>
      )}
    </div>
  );
}

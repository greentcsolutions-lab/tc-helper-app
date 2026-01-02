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

interface MapboxSuggestion {
  address: string;
  state: string;
}

// Fetch real address suggestions from Mapbox API
const getMapboxSuggestions = async (query: string): Promise<MapboxSuggestion[]> => {
  if (query.length < 3) return [];

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!mapboxToken) {
    console.error('NEXT_PUBLIC_MAPBOX_TOKEN is not set');
    return [];
  }

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
      `country=US&types=address&access_token=${mapboxToken}&limit=5`
    );

    if (!response.ok) {
      console.error('Mapbox API error:', response.statusText);
      return [];
    }

    const data = await response.json();

    return data.features.map((feature: any) => {
      // Extract state from context array
      const stateContext = feature.context?.find((c: any) =>
        c.id.startsWith('region.')
      );
      const state = stateContext?.short_code?.replace('US-', '') || '';

      return {
        address: feature.place_name,
        state: state
      };
    });
  } catch (error) {
    console.error('Error fetching Mapbox suggestions:', error);
    return [];
  }
};

export default function PropertyAddressStep({ data, updateData }: Props) {
  const [addressInput, setAddressInput] = useState(data.propertyAddress || '');
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Cleanup debounce timer on unmount
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleAddressChange = (value: string) => {
    setAddressInput(value);
    setSelectedIndex(-1);

    // Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Get suggestions with debouncing (300ms delay)
    if (value.length >= 3) {
      setIsLoading(true);
      debounceTimerRef.current = setTimeout(async () => {
        const newSuggestions = await getMapboxSuggestions(value);
        setSuggestions(newSuggestions);
        setShowSuggestions(newSuggestions.length > 0);
        setIsLoading(false);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
    }
  };

  const selectSuggestion = (suggestion: MapboxSuggestion) => {
    setAddressInput(suggestion.address);
    setShowSuggestions(false);

    if (suggestion.state && US_STATES.includes(suggestion.state)) {
      updateData({
        propertyAddress: suggestion.address,
        state: suggestion.state,
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
        {(showSuggestions && suggestions.length > 0) || isLoading ? (
          <div
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            <div className="py-1">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                {isLoading ? 'Loading...' : 'Suggestions'}
              </div>
              {isLoading ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Searching addresses...
                </div>
              ) : (
                suggestions.map((suggestion, index) => (
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
                    <span className="text-sm">{suggestion.address}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
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
          </div>
        </div>
      )}
    </div>
  );
}

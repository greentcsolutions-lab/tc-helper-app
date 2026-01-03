// src/lib/address/state-utils.ts
// Utility functions for US state handling

/**
 * US State abbreviations
 */
export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
] as const;

/**
 * Mapping of full state names to their 2-letter abbreviations
 */
export const STATE_NAME_TO_CODE: Record<string, string> = {
  'alabama': 'AL',
  'alaska': 'AK',
  'arizona': 'AZ',
  'arkansas': 'AR',
  'california': 'CA',
  'colorado': 'CO',
  'connecticut': 'CT',
  'delaware': 'DE',
  'florida': 'FL',
  'georgia': 'GA',
  'hawaii': 'HI',
  'idaho': 'ID',
  'illinois': 'IL',
  'indiana': 'IN',
  'iowa': 'IA',
  'kansas': 'KS',
  'kentucky': 'KY',
  'louisiana': 'LA',
  'maine': 'ME',
  'maryland': 'MD',
  'massachusetts': 'MA',
  'michigan': 'MI',
  'minnesota': 'MN',
  'mississippi': 'MS',
  'missouri': 'MO',
  'montana': 'MT',
  'nebraska': 'NE',
  'nevada': 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  'ohio': 'OH',
  'oklahoma': 'OK',
  'oregon': 'OR',
  'pennsylvania': 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  'tennessee': 'TN',
  'texas': 'TX',
  'utah': 'UT',
  'vermont': 'VT',
  'virginia': 'VA',
  'washington': 'WA',
  'west virginia': 'WV',
  'wisconsin': 'WI',
  'wyoming': 'WY',
};

/**
 * Extracts the US state code from a formatted address string.
 * Handles both 2-letter codes and full state names.
 *
 * @param address - Full address string (e.g., "123 Main St, City, California 12345")
 * @returns 2-letter state code or null if not found
 *
 * @example
 * extractStateCode("123 Main, Sonora, California 95370") // "CA"
 * extractStateCode("123 Main, Sonora, CA 95370") // "CA"
 */
export function extractStateCode(address: string): string | null {
  if (!address) return null;

  // Strategy 1: Try to match 2-letter state code (e.g., "CA")
  const twoLetterMatch = address.match(/,\s*([A-Z]{2})[\s,]/);
  if (twoLetterMatch && US_STATE_CODES.includes(twoLetterMatch[1] as any)) {
    return twoLetterMatch[1];
  }

  // Strategy 2: Try to match full state name (e.g., "California")
  // Split by commas and check each part
  const parts = address.split(',').map(p => p.trim().toLowerCase());

  for (const part of parts) {
    // Try exact match first
    if (STATE_NAME_TO_CODE[part]) {
      return STATE_NAME_TO_CODE[part];
    }

    // Try to find state name within the part (e.g., "California 95370")
    const words = part.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      // Try single word
      if (STATE_NAME_TO_CODE[words[i]]) {
        return STATE_NAME_TO_CODE[words[i]];
      }

      // Try two-word state names (e.g., "new york")
      if (i < words.length - 1) {
        const twoWords = `${words[i]} ${words[i + 1]}`;
        if (STATE_NAME_TO_CODE[twoWords]) {
          return STATE_NAME_TO_CODE[twoWords];
        }
      }
    }
  }

  return null;
}

/**
 * Validates if a string is a valid US state code
 */
export function isValidStateCode(code: string): boolean {
  return US_STATE_CODES.includes(code as any);
}

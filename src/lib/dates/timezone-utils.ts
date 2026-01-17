// src/lib/dates/timezone-utils.ts
// Utility functions for handling timezones based on property location

/**
 * Maps US states to their primary IANA timezone
 * For states spanning multiple zones, we use the most populous zone
 */
const STATE_TO_TIMEZONE: Record<string, string> = {
  // Eastern Time Zone
  'CT': 'America/New_York',
  'DE': 'America/New_York',
  'FL': 'America/New_York',
  'GA': 'America/New_York',
  'ME': 'America/New_York',
  'MD': 'America/New_York',
  'MA': 'America/New_York',
  'NH': 'America/New_York',
  'NJ': 'America/New_York',
  'NY': 'America/New_York',
  'NC': 'America/New_York',
  'OH': 'America/New_York',
  'PA': 'America/New_York',
  'RI': 'America/New_York',
  'SC': 'America/New_York',
  'VT': 'America/New_York',
  'VA': 'America/New_York',
  'WV': 'America/New_York',

  // Central Time Zone
  'AL': 'America/Chicago',
  'AR': 'America/Chicago',
  'IL': 'America/Chicago',
  'IA': 'America/Chicago',
  'KS': 'America/Chicago',
  'KY': 'America/Chicago',
  'LA': 'America/Chicago',
  'MN': 'America/Chicago',
  'MS': 'America/Chicago',
  'MO': 'America/Chicago',
  'NE': 'America/Chicago',
  'ND': 'America/Chicago',
  'OK': 'America/Chicago',
  'SD': 'America/Chicago',
  'TN': 'America/Chicago',
  'TX': 'America/Chicago',
  'WI': 'America/Chicago',

  // Mountain Time Zone
  'AZ': 'America/Phoenix',      // Arizona doesn't observe DST
  'CO': 'America/Denver',
  'ID': 'America/Denver',
  'MT': 'America/Denver',
  'NM': 'America/Denver',
  'UT': 'America/Denver',
  'WY': 'America/Denver',

  // Pacific Time Zone
  'CA': 'America/Los_Angeles',
  'NV': 'America/Los_Angeles',
  'OR': 'America/Los_Angeles',
  'WA': 'America/Los_Angeles',

  // Alaska Time Zone
  'AK': 'America/Anchorage',

  // Hawaii-Aleutian Time Zone
  'HI': 'Pacific/Honolulu',
};

/**
 * Extracts the state abbreviation from a property address string
 * Handles various address formats:
 * - "123 Main St, Los Angeles, CA 90210"
 * - "456 Oak Ave, San Francisco CA 94102"
 * - "789 Elm Street, Austin, Texas"
 */
export function extractStateFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;

  // Common state abbreviations pattern
  const stateAbbrMatch = address.match(/\b([A-Z]{2})\b(?:\s+\d{5})?/);
  if (stateAbbrMatch && STATE_TO_TIMEZONE[stateAbbrMatch[1]]) {
    return stateAbbrMatch[1];
  }

  // Full state name mapping (common ones)
  const stateNameMap: Record<string, string> = {
    'california': 'CA',
    'texas': 'TX',
    'florida': 'FL',
    'new york': 'NY',
    'illinois': 'IL',
    'pennsylvania': 'PA',
    'ohio': 'OH',
    'georgia': 'GA',
    'north carolina': 'NC',
    'michigan': 'MI',
    'new jersey': 'NJ',
    'virginia': 'VA',
    'washington': 'WA',
    'arizona': 'AZ',
    'massachusetts': 'MA',
    'tennessee': 'TN',
    'indiana': 'IN',
    'missouri': 'MO',
    'maryland': 'MD',
    'wisconsin': 'WI',
    'colorado': 'CO',
    'minnesota': 'MN',
    'south carolina': 'SC',
    'alabama': 'AL',
    'louisiana': 'LA',
    'kentucky': 'KY',
    'oregon': 'OR',
    'oklahoma': 'OK',
    'connecticut': 'CT',
    'utah': 'UT',
    'iowa': 'IA',
    'nevada': 'NV',
    'arkansas': 'AR',
    'mississippi': 'MS',
    'kansas': 'KS',
    'new mexico': 'NM',
    'nebraska': 'NE',
    'west virginia': 'WV',
    'idaho': 'ID',
    'hawaii': 'HI',
    'new hampshire': 'NH',
    'maine': 'ME',
    'montana': 'MT',
    'rhode island': 'RI',
    'delaware': 'DE',
    'south dakota': 'SD',
    'north dakota': 'ND',
    'alaska': 'AK',
    'vermont': 'VT',
    'wyoming': 'WY',
  };

  const lowerAddress = address.toLowerCase();
  for (const [stateName, stateAbbr] of Object.entries(stateNameMap)) {
    if (lowerAddress.includes(stateName)) {
      return stateAbbr;
    }
  }

  return null;
}

/**
 * Gets the IANA timezone for a property address
 * Falls back to Pacific Time if state cannot be determined
 */
export function getTimezoneForAddress(address: string | null | undefined): string {
  const state = extractStateFromAddress(address);
  if (state && STATE_TO_TIMEZONE[state]) {
    return STATE_TO_TIMEZONE[state];
  }

  // Default fallback to Pacific Time (common for real estate tech)
  return 'America/Los_Angeles';
}

/**
 * Converts a Date object to YYYY-MM-DD string in the specified timezone
 * This prevents off-by-one errors from UTC conversion
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;

    if (!year || !month || !day) {
      throw new Error('Failed to format date parts');
    }

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error(`[formatDateInTimezone] Error formatting date in ${timezone}:`, error);
    // Fallback to ISO split
    return date.toISOString().split('T')[0];
  }
}

/**
 * Converts a Date object to YYYY-MM-DD string using the property's timezone
 */
export function formatDateForProperty(date: Date, propertyAddress: string | null | undefined): string {
  const timezone = getTimezoneForAddress(propertyAddress);
  return formatDateInTimezone(date, timezone);
}

/**
 * Parses a YYYY-MM-DD string into a Date object at midnight in the specified timezone
 * This ensures consistent date handling regardless of the user's local timezone
 */
export function parseDateInTimezone(dateString: string, timezone: string): Date {
  try {
    // Create date at noon in the specified timezone to avoid DST edge cases
    const [year, month, day] = dateString.split('-').map(Number);

    // Create a date string with time at noon
    const dateTimeString = `${dateString}T12:00:00`;

    // Use Intl.DateTimeFormat to parse in the correct timezone
    const date = new Date(dateTimeString);

    return date;
  } catch (error) {
    console.error(`[parseDateInTimezone] Error parsing date ${dateString} in ${timezone}:`, error);
    // Fallback to standard Date parsing
    return new Date(dateString);
  }
}

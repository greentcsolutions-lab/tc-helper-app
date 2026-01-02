// TC Helper App
// src/lib/extraction/extract/universal/helpers/address-validation.ts
// Address validation using Mapbox Geocoding API

const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY;
const CONFIDENCE_THRESHOLD = 0.8; // Only auto-correct if relevance >= 80%
const MAX_RETRIES = 1;

export interface AddressValidationResult {
  verified: boolean;
  originalAddress: string;
  correctedAddress: string | null;
  confidence: number;
  needsReview: boolean;
  reviewReason: string | null;
  metadata?: {
    coordinates?: [number, number]; // [lon, lat]
    state?: string;
    zip?: string;
    county?: string;
  };
}

/**
 * Validate and correct an address using Mapbox Geocoding API
 *
 * Rules:
 * 1. Auto-correct close matches (e.g., "123 Main St" vs "123 Main Ave") if confidence >= 80%
 * 2. If no close matches, flag for review
 * 3. Handle missing ZIP/city/state by inferring from available data
 * 4. Retry once on failure, then flag for review
 * 5. Store only Mapbox-verified address (source of truth)
 */
export async function validateAddress(
  address: string | null | undefined,
  mergeLog: string[]
): Promise<AddressValidationResult> {
  // Handle null/undefined addresses
  if (!address || address.trim() === '') {
    mergeLog.push('⚠️ Address validation: No address provided');
    return {
      verified: false,
      originalAddress: '',
      correctedAddress: null,
      confidence: 0,
      needsReview: true,
      reviewReason: 'No address extracted from document',
    };
  }

  const trimmedAddress = address.trim();
  mergeLog.push(`🗺️ Validating address via Mapbox: "${trimmedAddress}"`);

  // Check if Mapbox is configured
  if (!MAPBOX_API_KEY) {
    mergeLog.push('⚠️ Address validation: MAPBOX_API_KEY not configured');
    return {
      verified: false,
      originalAddress: trimmedAddress,
      correctedAddress: null,
      confidence: 0,
      needsReview: true,
      reviewReason: 'Mapbox API not configured',
    };
  }

  // Attempt geocoding with retry
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= MAX_RETRIES) {
    try {
      const result = await geocodeAddress(trimmedAddress);

      if (!result) {
        mergeLog.push('⚠️ Address validation: No results from Mapbox');
        return {
          verified: false,
          originalAddress: trimmedAddress,
          correctedAddress: null,
          confidence: 0,
          needsReview: true,
          reviewReason: 'No matching addresses found',
        };
      }

      // Check confidence threshold
      if (result.relevance >= CONFIDENCE_THRESHOLD) {
        mergeLog.push(
          `✅ Address validated (confidence: ${(result.relevance * 100).toFixed(0)}%): "${result.place_name}"`
        );

        return {
          verified: true,
          originalAddress: trimmedAddress,
          correctedAddress: result.place_name,
          confidence: result.relevance,
          needsReview: false,
          reviewReason: null,
          metadata: {
            coordinates: result.center,
            state: extractStateFromContext(result.context),
            zip: extractZipFromContext(result.context),
            county: extractCountyFromContext(result.context),
          },
        };
      } else {
        // Low confidence - flag for review
        mergeLog.push(
          `⚠️ Address validation: Low confidence (${(result.relevance * 100).toFixed(0)}%) - flagging for review`
        );

        return {
          verified: false,
          originalAddress: trimmedAddress,
          correctedAddress: result.place_name,
          confidence: result.relevance,
          needsReview: true,
          reviewReason: `Low confidence match (${(result.relevance * 100).toFixed(0)}%)`,
          metadata: {
            coordinates: result.center,
            state: extractStateFromContext(result.context),
            zip: extractZipFromContext(result.context),
            county: extractCountyFromContext(result.context),
          },
        };
      }
    } catch (error) {
      lastError = error as Error;
      attempt++;

      if (attempt <= MAX_RETRIES) {
        mergeLog.push(`⚠️ Address validation failed (attempt ${attempt}/${MAX_RETRIES + 1}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
      }
    }
  }

  // All attempts failed
  mergeLog.push(`❌ Address validation: Failed after ${MAX_RETRIES + 1} attempts - ${lastError?.message || 'Unknown error'}`);

  return {
    verified: false,
    originalAddress: trimmedAddress,
    correctedAddress: null,
    confidence: 0,
    needsReview: true,
    reviewReason: 'Unable to verify address - Mapbox API error',
  };
}

/**
 * Call Mapbox Geocoding API
 */
async function geocodeAddress(address: string): Promise<MapboxFeature | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_API_KEY}&country=US&types=address&limit=1`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.features || data.features.length === 0) {
    return null;
  }

  return data.features[0];
}

/**
 * Extract state code from Mapbox context
 */
function extractStateFromContext(context: MapboxContext[] | undefined): string | undefined {
  if (!context) return undefined;

  const regionContext = context.find(c => c.id.startsWith('region.'));
  if (regionContext?.short_code) {
    return regionContext.short_code.replace('US-', '');
  }

  return undefined;
}

/**
 * Extract ZIP code from Mapbox context
 */
function extractZipFromContext(context: MapboxContext[] | undefined): string | undefined {
  if (!context) return undefined;

  const postcodeContext = context.find(c => c.id.startsWith('postcode.'));
  return postcodeContext?.text;
}

/**
 * Extract county from Mapbox context
 */
function extractCountyFromContext(context: MapboxContext[] | undefined): string | undefined {
  if (!context) return undefined;

  const districtContext = context.find(c => c.id.startsWith('district.'));
  return districtContext?.text;
}

// Mapbox API types
interface MapboxContext {
  id: string;
  text: string;
  short_code?: string;
}

interface MapboxFeature {
  place_name: string;
  center: [number, number]; // [lon, lat]
  relevance: number; // 0-1
  context?: MapboxContext[];
}

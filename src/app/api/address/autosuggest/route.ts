// src/app/api/address/autosuggest/route.ts
// Mapbox address autocomplete API route

import { NextRequest, NextResponse } from 'next/server';

const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache

// Simple in-memory cache to reduce Mapbox API calls
const cache = new Map<string, { data: any; timestamp: number }>();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');

    if (!query || query.length < 3) {
      return NextResponse.json(
        { error: 'Query must be at least 3 characters' },
        { status: 400 }
      );
    }

    if (!MAPBOX_API_KEY) {
      console.error('MAPBOX_API_KEY not configured');
      return NextResponse.json(
        { error: 'Mapbox API not configured' },
        { status: 500 }
      );
    }

    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[mapbox] Cache hit for query: ${query}`);
      return NextResponse.json(cached.data);
    }

    // Call Mapbox Geocoding API
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_API_KEY}&country=US&types=address&limit=5`;

    console.log(`[mapbox] Fetching suggestions for: ${query}`);

    let response;
    try {
      response = await fetch(mapboxUrl);
    } catch (fetchError) {
      // Retry once on network failure
      console.warn('[mapbox] First request failed, retrying...');
      await new Promise(resolve => setTimeout(resolve, 500));
      response = await fetch(mapboxUrl);
    }

    if (!response.ok) {
      console.error(`[mapbox] API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'Failed to fetch address suggestions' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform Mapbox results to our format
    const suggestions = data.features.map((feature: any) => ({
      address: feature.place_name,
      // Extract state from context
      state: feature.context?.find((c: any) => c.id.startsWith('region.'))?.short_code?.replace('US-', '') || '',
      // Store full Mapbox data for potential future use
      coordinates: feature.center,
      relevance: feature.relevance,
      placeType: feature.place_type,
    }));

    const result = {
      suggestions,
      count: suggestions.length,
    };

    // Store in cache
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    // Clean old cache entries periodically
    if (cache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
          cache.delete(key);
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[mapbox] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

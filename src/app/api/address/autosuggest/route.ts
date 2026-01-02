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

    // Log incoming request for debugging
    console.log('[mapbox-api] Received request with query:', query);

    if (!query || query.length < 3) {
      console.log('[mapbox-api] Query too short:', query?.length || 0);
      return NextResponse.json(
        { error: 'Query must be at least 3 characters' },
        { status: 400 }
      );
    }

    if (!MAPBOX_API_KEY) {
      console.error('[mapbox-api] MAPBOX_API_KEY not configured in environment');
      console.error('[mapbox-api] Available env keys:', Object.keys(process.env).filter(k => k.includes('MAP')));
      return NextResponse.json(
        { error: 'Mapbox API key not configured. Please set MAPBOX_API_KEY environment variable.' },
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

    console.log(`[mapbox-api] Fetching suggestions for: "${query}"`);

    let response;
    try {
      response = await fetch(mapboxUrl);
    } catch (fetchError) {
      // Retry once on network failure
      console.warn('[mapbox-api] First request failed, retrying...', fetchError);
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        response = await fetch(mapboxUrl);
      } catch (retryError) {
        console.error('[mapbox-api] Retry also failed:', retryError);
        return NextResponse.json(
          { error: 'Network error connecting to Mapbox' },
          { status: 503 }
        );
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[mapbox-api] Mapbox API error: ${response.status} ${response.statusText}`, errorText);
      return NextResponse.json(
        { error: `Mapbox API error: ${response.status} - ${errorText.substring(0, 100)}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[mapbox-api] Received ${data.features?.length || 0} results from Mapbox`);

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

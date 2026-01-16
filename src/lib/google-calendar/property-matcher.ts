// src/lib/google-calendar/property-matcher.ts
// Fuzzy matching of property addresses in calendar events

import { prisma } from '@/lib/prisma';
import { PropertyMatch } from '@/types/calendar';

/**
 * Matches a text string to property addresses in the user's active transactions
 * Uses both exact and fuzzy matching
 */
export async function matchPropertyAddress(
  userId: string,
  text: string
): Promise<PropertyMatch> {
  try {
    // Get all active parses with property addresses
    const parses = await prisma.parse.findMany({
      where: {
        userId,
        propertyAddress: { not: null },
      },
      select: {
        id: true,
        propertyAddress: true,
      },
    });

    if (parses.length === 0) {
      return { propertyAddress: '', parseId: '', confidence: 'none' };
    }

    const textLower = text.toLowerCase();

    // First try exact matching
    for (const parse of parses) {
      if (!parse.propertyAddress) continue;

      const addressLower = parse.propertyAddress.toLowerCase();
      if (textLower.includes(addressLower)) {
        return {
          propertyAddress: parse.propertyAddress,
          parseId: parse.id,
          confidence: 'exact',
          matchScore: 100,
        };
      }
    }

    // Try fuzzy matching
    let bestMatch: PropertyMatch = {
      propertyAddress: '',
      parseId: '',
      confidence: 'none',
      matchScore: 0,
    };

    for (const parse of parses) {
      if (!parse.propertyAddress) continue;

      const score = fuzzyMatchAddress(textLower, parse.propertyAddress);

      if (score > 70 && score > (bestMatch.matchScore || 0)) {
        bestMatch = {
          propertyAddress: parse.propertyAddress,
          parseId: parse.id,
          confidence: 'fuzzy',
          matchScore: score,
        };
      }
    }

    return bestMatch;
  } catch (error) {
    console.error('Error matching property address:', error);
    return { propertyAddress: '', parseId: '', confidence: 'none' };
  }
}

/**
 * Fuzzy matching algorithm for addresses
 * Returns a score from 0-100
 */
function fuzzyMatchAddress(text: string, address: string): number {
  const addressLower = address.toLowerCase();

  // Extract street number and name from address
  const addressMatch = addressLower.match(/^(\d+)\s+([a-z\s]+)/);
  if (!addressMatch) return 0;

  const streetNumber = addressMatch[1];
  const streetName = addressMatch[2].trim();

  // Check if text contains street number
  const hasStreetNumber = text.includes(streetNumber);
  if (!hasStreetNumber) return 0;

  // Check for street name match
  const streetNameWords = streetName.split(/\s+/).filter((w) => w.length > 2);
  let matchedWords = 0;

  for (const word of streetNameWords) {
    if (text.includes(word)) {
      matchedWords++;
    }
  }

  // Calculate score
  const streetNumberScore = 40; // Street number match is worth 40 points
  const streetNameScore = streetNameWords.length > 0
    ? (matchedWords / streetNameWords.length) * 60
    : 0; // Street name match is worth up to 60 points

  return streetNumberScore + streetNameScore;
}

/**
 * Extracts potential addresses from text
 * Useful for preprocessing before matching
 */
export function extractPotentialAddresses(text: string): string[] {
  const addresses: string[] = [];

  // Pattern: street number + street name
  // Examples: "123 Main St", "456 Oak Avenue"
  const pattern = /\b\d{1,5}\s+[A-Za-z][A-Za-z\s]{2,30}(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Circle|Cir|Place|Pl)?\b/gi;

  const matches = text.match(pattern);
  if (matches) {
    addresses.push(...matches);
  }

  return addresses;
}

/**
 * Normalizes an address for better matching
 */
export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bcircle\b/g, 'cir')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\bway\b/g, 'wy')
    .replace(/[,\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

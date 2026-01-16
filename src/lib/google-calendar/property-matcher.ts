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
 *
 * Handles partial matches like:
 * - "El Lobo Center" matches "21759 El Lobo Ctr"
 * - "Main Street" matches "123 Main St, Sacramento, CA"
 */
function fuzzyMatchAddress(text: string, address: string): number {
  const addressLower = address.toLowerCase();

  // Normalize both text and address for better matching
  const normalizedText = normalizeAddress(text);
  const normalizedAddress = normalizeAddress(address);

  // Extract components from address
  const addressMatch = addressLower.match(/^(\d+)?\s*([a-z\s]+?)(?:,|$)/);
  if (!addressMatch) return 0;

  const streetNumber = addressMatch[1] || '';
  const streetName = addressMatch[2].trim();

  // Split street name into significant words (> 2 chars)
  const streetNameWords = streetName
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for'].includes(w));

  if (streetNameWords.length === 0) return 0;

  let score = 0;
  let matchedWords = 0;

  // Check for street name words in text
  for (const word of streetNameWords) {
    if (normalizedText.includes(word)) {
      matchedWords++;
    }
  }

  // Calculate street name match score (0-70 points)
  const streetNameMatchRatio = matchedWords / streetNameWords.length;
  score += streetNameMatchRatio * 70;

  // Bonus points for street number match (0-30 points)
  if (streetNumber && normalizedText.includes(streetNumber)) {
    score += 30;
  }

  // Bonus for matching multiple consecutive words (indicates stronger match)
  if (streetNameWords.length >= 2 && matchedWords >= 2) {
    // Check if words appear consecutively in text
    const streetNamePhrase = streetNameWords.join(' ');
    if (normalizedText.includes(streetNamePhrase)) {
      score += 10; // Bonus for consecutive word match
    }
  }

  return Math.min(100, score);
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
 * Converts common variations to standard forms
 */
export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    // Street type abbreviations
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
    // Handle "center" variations
    .replace(/\bcenter\b/g, 'ctr')
    .replace(/\bcentre\b/g, 'ctr')
    // Handle "parkway" variations
    .replace(/\bparkway\b/g, 'pkwy')
    // Handle directional abbreviations
    .replace(/\bnorth\b/g, 'n')
    .replace(/\bsouth\b/g, 's')
    .replace(/\beast\b/g, 'e')
    .replace(/\bwest\b/g, 'w')
    .replace(/\bnortheast\b/g, 'ne')
    .replace(/\bnorthwest\b/g, 'nw')
    .replace(/\bsoutheast\b/g, 'se')
    .replace(/\bsouthwest\b/g, 'sw')
    // Remove punctuation and extra spaces
    .replace(/[,\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

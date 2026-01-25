/**
 * Route-aware rate limiting for inbound emails
 */

import { db } from '@/lib/prisma';
import { RATE_LIMITS } from '../constants';
import type { RateLimitResult } from '../types';

const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour in milliseconds

/**
 * Get rate limit for a specific email category
 */
function getRateLimitForCategory(category: string): number {
  switch (category) {
    case 'extraction':
      return RATE_LIMITS.EXTRACTION;
    case 'support':
      return RATE_LIMITS.SUPPORT;
    case 'user-generated':
      return RATE_LIMITS.USER_GENERATED;
    default:
      return RATE_LIMITS.EXTRACTION; // Default to strictest limit
  }
}

/**
 * Check if user has exceeded email rate limit for a specific category
 * @param userId - User ID to check
 * @param category - Email category (extraction, support, user-generated)
 * @returns Rate limit result with allowed status and metadata
 */
export async function checkEmailRateLimit(
  userId: string,
  category: string = 'extraction'
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const resetAt = new Date(Date.now() + RATE_LIMIT_WINDOW_MS);
  const limit = getRateLimitForCategory(category);

  try {
    // Count inbound emails from this user in the last hour for this category
    const recentEmailsCount = await db.communication.count({
      where: {
        userId,
        direction: 'inbound',
        category,
        createdAt: {
          gte: windowStart,
        },
      },
    });

    const allowed = recentEmailsCount < limit;

    return {
      allowed,
      currentCount: recentEmailsCount,
      limit,
      resetAt,
    };
  } catch (error) {
    console.error(
      '[rate-limiter] Error checking rate limit:',
      error instanceof Error ? error.message : 'Unknown'
    );
    // On error, allow the request but log the issue
    return {
      allowed: true,
      currentCount: 0,
      limit,
      resetAt,
    };
  }
}

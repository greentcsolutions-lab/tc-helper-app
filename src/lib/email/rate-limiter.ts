import { db } from '@/lib/prisma';

const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour in milliseconds
const MAX_EMAILS_PER_HOUR = 5;

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  resetAt: Date;
}

/**
 * Check if user has exceeded email rate limit (5 emails per hour)
 * @param userId - User ID to check
 * @returns Rate limit result with allowed status and metadata
 */
export async function checkEmailRateLimit(userId: string): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const resetAt = new Date(Date.now() + RATE_LIMIT_WINDOW_MS);

  try {
    // Count inbound emails from this user in the last hour
    const recentEmailsCount = await db.communication.count({
      where: {
        userId,
        direction: 'inbound',
        createdAt: {
          gte: windowStart,
        },
      },
    });

    const allowed = recentEmailsCount < MAX_EMAILS_PER_HOUR;

    return {
      allowed,
      currentCount: recentEmailsCount,
      limit: MAX_EMAILS_PER_HOUR,
      resetAt,
    };
  } catch (error) {
    console.error('[rate-limiter] Error checking rate limit:', error instanceof Error ? error.message : 'Unknown');
    // On error, allow the request but log the issue
    return {
      allowed: true,
      currentCount: 0,
      limit: MAX_EMAILS_PER_HOUR,
      resetAt,
    };
  }
}

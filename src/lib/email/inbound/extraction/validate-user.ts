/**
 * User validation for email-based PDF extraction
 */

import { db } from '@/lib/prisma';
import type { UserValidationResult } from '../../types';

/**
 * Validate inbound email sender and check user quotas
 * @param senderEmail - Email address of the sender
 * @returns Validation result with user data or rejection reason
 */
export async function validateExtractionUser(
  senderEmail: string
): Promise<UserValidationResult> {
  try {
    // Step 1: Find user by email (case-insensitive match)
    const user = await db.user.findFirst({
      where: {
        email: {
          equals: senderEmail,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        email: true,
        credits: true,
        planType: true,
        quota: true,
        parseLimit: true,
        parseCount: true,
        parseResetDate: true,
      },
    });

    if (!user) {
      return {
        valid: false,
        reason:
          'Email address not registered. Please send from the email address you used to sign up for TC Helper.',
      };
    }

    // Step 2: Check if parse count needs to be reset (monthly refresh for BASIC plan only)
    const now = new Date();
    let parseCount = user.parseCount;

    if (user.planType === 'BASIC' && user.parseResetDate && now >= user.parseResetDate) {
      // Reset parse count
      const nextReset = new Date(now);
      nextReset.setMonth(nextReset.getMonth() + 1);

      await db.user.update({
        where: { id: user.id },
        data: {
          parseCount: 0,
          parseResetDate: nextReset,
        },
      });

      parseCount = 0;
    }

    // Step 3: Check parse limit
    if (parseCount >= user.parseLimit) {
      const errorMessage =
        user.planType === 'FREE'
          ? 'Free tier parse limit reached. Please upgrade your plan to continue.'
          : 'Monthly parse limit reached. Your limit will reset at the start of your next billing cycle.';

      return {
        valid: false,
        reason: errorMessage,
        details: {
          parseCount,
          parseLimit: user.parseLimit,
          planType: user.planType,
        },
      };
    }

    // Step 4: Check credits
    if (user.credits < 1) {
      return {
        valid: false,
        reason: 'No credits remaining. Please purchase additional credits to continue.',
        details: {
          credits: user.credits,
        },
      };
    }

    // Step 5: Check concurrent transaction quota
    const activeParseCount = await db.parse.count({
      where: {
        userId: user.id,
        archived: false,
      },
    });

    if (activeParseCount >= user.quota) {
      return {
        valid: false,
        reason: `Concurrent transaction limit reached (${activeParseCount}/${user.quota}). Please archive or delete existing transactions before uploading new files.`,
        details: {
          activeParseCount,
          quota: user.quota,
        },
      };
    }

    // All validation checks passed
    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        credits: user.credits,
        parseCount, // Use potentially reset value
        parseLimit: user.parseLimit,
        planType: user.planType,
        parseResetDate: user.parseResetDate,
      },
    };
  } catch (error) {
    console.error(
      '[validate-extraction-user] Error validating email:',
      error instanceof Error ? error.message : 'Unknown'
    );
    return {
      valid: false,
      reason: 'Internal validation error. Please try again or contact support.',
    };
  }
}

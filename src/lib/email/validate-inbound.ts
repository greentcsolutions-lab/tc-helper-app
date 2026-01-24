import { db } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for inbound email webhook payload
export const inboundEmailSchema = z.object({
  from: z.string().email(),
  to: z.string().email(),
  subject: z.string().max(500).optional(),
  text: z.string().max(50000).optional(), // Limit email body size
  html: z.string().max(100000).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(), // base64 encoded
    contentType: z.string(),
    size: z.number(),
  })).optional(),
});

export type InboundEmailPayload = z.infer<typeof inboundEmailSchema>;

export interface ValidationResult {
  valid: boolean;
  user?: {
    id: string;
    email: string;
    credits: number;
    planType: string;
    quota: number;
    parseLimit: number;
    parseCount: number;
    parseResetDate: Date | null;
  };
  reason?: string;
  details?: Record<string, any>;
}

/**
 * Validate inbound email and check user quotas
 * @param senderEmail - Email address of the sender
 * @returns Validation result with user data or rejection reason
 */
export async function validateInboundEmail(senderEmail: string): Promise<ValidationResult> {
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
        reason: 'Email address not registered. Please send from the email address you used to sign up for TC Helper.',
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
      const errorMessage = user.planType === 'FREE'
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
        ...user,
        parseCount, // Use potentially reset value
      },
    };
  } catch (error) {
    console.error('[validate-inbound] Error validating email:', error instanceof Error ? error.message : 'Unknown');
    return {
      valid: false,
      reason: 'Internal validation error. Please try again or contact support.',
    };
  }
}

/**
 * Validate PDF attachment from email
 * @param attachments - Array of attachments from email
 * @returns Validation result with PDF buffer or rejection reason
 */
export async function validatePdfAttachment(
  attachments?: Array<{ filename: string; content: string; contentType: string; size: number }>
): Promise<{ valid: boolean; pdfBuffer?: Buffer; filename?: string; reason?: string }> {
  if (!attachments || attachments.length === 0) {
    return {
      valid: false,
      reason: 'No PDF attachment found. Please attach a contract PDF to your email.',
    };
  }

  if (attachments.length > 1) {
    return {
      valid: false,
      reason: 'Multiple attachments detected. We currently support only 1 PDF extraction at a time. Please send one PDF per email.',
    };
  }

  const attachment = attachments[0];

  // Check if it's a PDF
  if (!attachment.contentType.includes('pdf') && !attachment.filename.toLowerCase().endsWith('.pdf')) {
    return {
      valid: false,
      reason: 'Invalid file type. Please attach a PDF file (.pdf).',
    };
  }

  // Check file size (25MB max)
  const MAX_SIZE = 25 * 1024 * 1024; // 25MB in bytes
  if (attachment.size > MAX_SIZE) {
    return {
      valid: false,
      reason: `PDF file too large (${(attachment.size / 1024 / 1024).toFixed(1)} MB). Maximum file size is 25 MB.`,
    };
  }

  try {
    // Decode base64 content to buffer
    const pdfBuffer = Buffer.from(attachment.content, 'base64');

    // Quick PDF header validation
    const header = pdfBuffer.subarray(0, 8).toString();
    if (!header.includes('%PDF')) {
      return {
        valid: false,
        reason: 'Invalid PDF file. The file does not appear to be a valid PDF document.',
      };
    }

    return {
      valid: true,
      pdfBuffer,
      filename: attachment.filename,
    };
  } catch (error) {
    console.error('[validate-inbound] Error decoding PDF attachment:', error instanceof Error ? error.message : 'Unknown');
    return {
      valid: false,
      reason: 'Failed to process PDF attachment. Please ensure the file is not corrupted.',
    };
  }
}

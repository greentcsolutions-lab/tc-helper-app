/**
 * Send upload rejection email using Resend template
 */

import { z } from 'zod';
import { sendTemplateEmail } from '../send';
import { EMAIL_FROM, EMAIL_TEMPLATES } from '../../constants';
import type { SendEmailResult } from '../../types';

const emailSchema = z.string().email();

export interface SendRejectionEmailParams {
  email: string;
  reason: string;
  helpText?: string;
  details?: Record<string, any>;
}

/**
 * Send rejection email for failed PDF upload validation
 * Uses Resend template: upload-rejected
 */
export async function sendRejectionEmail(
  params: SendRejectionEmailParams
): Promise<SendEmailResult> {
  const { email, reason, helpText, details } = params;

  // Validate email to prevent injection
  const emailValidation = emailSchema.safeParse(email);
  if (!emailValidation.success) {
    console.error('[send-rejection-email] Invalid email format:', email);
    return {
      success: false,
      error: 'Invalid email format',
    };
  }

  // Format details for template
  const formattedDetails = details
    ? Object.entries(details)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
    : undefined;

  return sendTemplateEmail(
    EMAIL_FROM.STATUS,
    emailValidation.data,
    EMAIL_TEMPLATES.UPLOAD_REJECTED,
    {
      reason,
      help_text: helpText || 'Visit your dashboard for more information.',
      details: formattedDetails,
    }
  );
}

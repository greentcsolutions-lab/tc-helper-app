/**
 * Send extraction failed email using Resend template
 */

import { z } from 'zod';
import { sendTemplateEmail } from '../send';
import { EMAIL_FROM, EMAIL_TEMPLATES } from '../../constants';
import type { SendEmailResult } from '../../types';

const emailSchema = z.string().email();

export interface SendExtractionFailedEmailParams {
  email: string;
  fileName: string;
  errorMessage?: string;
}

/**
 * Send extraction failed email when AI extraction fails
 * Uses Resend template: extraction-failed
 */
export async function sendExtractionFailedEmail(
  params: SendExtractionFailedEmailParams
): Promise<SendEmailResult> {
  const { email, fileName, errorMessage } = params;

  // Validate email to prevent injection
  const emailValidation = emailSchema.safeParse(email);
  if (!emailValidation.success) {
    console.error('[send-extraction-failed-email] Invalid email format:', email);
    return {
      success: false,
      error: 'Invalid email format',
    };
  }

  // Sanitize fileName to prevent XSS
  const safeFileName = fileName.replace(/[<>]/g, '');

  return sendTemplateEmail(
    EMAIL_FROM.STATUS,
    emailValidation.data,
    EMAIL_TEMPLATES.EXTRACTION_FAILED,
    {
      file_name: safeFileName,
      error_message: errorMessage || 'Unknown error occurred during extraction.',
      dashboard_url: 'https://tchelper.app/dashboard',
    }
  );
}

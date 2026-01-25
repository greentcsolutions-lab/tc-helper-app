/**
 * Send welcome email using Resend template
 */

import { z } from 'zod';
import { sendTemplateEmail } from '../send';
import { EMAIL_FROM, EMAIL_TEMPLATES } from '../../constants';
import type { SendEmailResult } from '../../types';

const emailSchema = z.string().email();
const firstNameSchema = z.string().min(1).max(100).regex(/^[a-zA-Z\s\-']+$/);

export interface SendWelcomeEmailParams {
  email: string;
  firstName: string;
}

/**
 * Send welcome email when user completes onboarding
 * Uses Resend template: welcome-email
 */
export async function sendWelcomeEmail(
  params: SendWelcomeEmailParams
): Promise<SendEmailResult> {
  const { email, firstName } = params;

  // Validate inputs to prevent email injection
  const emailValidation = emailSchema.safeParse(email);
  if (!emailValidation.success) {
    console.error('[send-welcome-email] Invalid email format:', email);
    return {
      success: false,
      error: 'Invalid email format',
    };
  }

  const firstNameValidation = firstNameSchema.safeParse(firstName);
  if (!firstNameValidation.success) {
    console.error('[send-welcome-email] Invalid first name format');
    return {
      success: false,
      error: 'Invalid first name format',
    };
  }

  return sendTemplateEmail(
    EMAIL_FROM.ONBOARDING,
    emailValidation.data,
    EMAIL_TEMPLATES.WELCOME,
    {
      first_name: firstNameValidation.data,
    }
  );
}

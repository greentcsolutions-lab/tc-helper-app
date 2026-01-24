import { z } from 'zod';
import { resend } from './client';

// Validation schemas
const emailSchema = z.string().email();
const firstNameSchema = z.string().min(1).max(100).regex(/^[a-zA-Z\s\-']+$/);

interface SendWelcomeEmailParams {
  email: string;
  firstName: string;
}

export async function sendWelcomeEmail({ email, firstName }: SendWelcomeEmailParams) {
  try {
    // Validate inputs to prevent email injection
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      console.error('[send-welcome-email] Invalid email format:', email);
      return { success: false, error: 'Invalid email format' };
    }

    const firstNameValidation = firstNameSchema.safeParse(firstName);
    if (!firstNameValidation.success) {
      console.error('[send-welcome-email] Invalid first name format');
      return { success: false, error: 'Invalid first name format' };
    }

    // Send email using Resend dashboard template 'welcome-email'
    const { data, error } = await resend.emails.send({
      from: 'TC Helper <onboarding@updates.tchelper.app>',
      to: emailValidation.data,
      template: {
        id: 'welcome-email',
        variables: {
          first_name: firstNameValidation.data,
        },
      },
    } as any);

    if (error) {
      console.error('[send-welcome-email] Resend API error:', error);
      return { success: false, error };
    }

    console.log('[send-welcome-email] Email sent successfully:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('[send-welcome-email] Unexpected error:', error instanceof Error ? error.message : 'Unknown');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

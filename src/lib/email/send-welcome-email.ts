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

    // Send email using Resend template
    // Note: Update 'from' domain to match your verified domain in Resend
    const { data, error } = await resend.emails.send({
      from: 'TC Helper <onboarding@updates.tchelper.app>', // Update with your verified domain
      to: emailValidation.data,
      subject: 'Welcome to TC Helper!',
      // For Resend dashboard templates, use the template ID or name
      // If using React Email components, replace with react: WelcomeEmail
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body>
            <p>Welcome ${firstNameValidation.data}!</p>
            <p>Thank you for joining TC Helper. We're excited to help you manage your real estate transactions.</p>
          </body>
        </html>
      `,
      // Uncomment and update when using Resend dashboard template:
      // template: 'welcome-email',
      // variables: {
      //   first_name: firstNameValidation.data,
      // },
    });

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

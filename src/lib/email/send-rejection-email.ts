import { z } from 'zod';
import { resend } from './client';

// Validation schemas
const emailSchema = z.string().email();

interface SendRejectionEmailParams {
  email: string;
  reason: string;
  details?: Record<string, any>;
}

export async function sendRejectionEmail({ email, reason, details }: SendRejectionEmailParams) {
  try {
    // Validate email to prevent injection
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      console.error('[send-rejection-email] Invalid email format:', email);
      return { success: false, error: 'Invalid email format' };
    }

    // Send email using inline HTML (can be migrated to Resend template later)
    const { data, error } = await resend.emails.send({
      from: 'TC Helper Status <status@mail.tchelper.app>',
      to: emailValidation.data,
      subject: 'TC Helper - Upload Request Blocked',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background-color: #dc2626;
                color: white;
                padding: 20px;
                border-radius: 8px 8px 0 0;
              }
              .content {
                background-color: #f9fafb;
                padding: 30px;
                border-radius: 0 0 8px 8px;
              }
              .reason {
                background-color: #fef2f2;
                border-left: 4px solid #dc2626;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
              }
              a {
                color: #2563eb;
                text-decoration: none;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">Upload Request Blocked</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received your email to <strong>upload@mail.tchelper.app</strong>, but unfortunately we couldn't process your request.</p>

              <div class="reason">
                <strong>Reason:</strong><br>
                ${reason}
              </div>

              ${details ? `
                <p style="font-size: 14px; color: #6b7280;">
                  <strong>Additional Details:</strong><br>
                  ${Object.entries(details).map(([key, value]) => `${key}: ${value}`).join('<br>')}
                </p>
              ` : ''}

              <p><strong>What you can do:</strong></p>
              <ul>
                <li>Ensure you're sending from the email address you used to sign up for TC Helper</li>
                <li>Check your plan limits and quotas in your <a href="https://tchelper.app/dashboard/billing">billing settings</a></li>
                <li>Make sure you're attaching a single PDF file (max 25 MB, 100 pages)</li>
                <li>If you need help, visit our <a href="https://tchelper.app/dashboard">dashboard</a> or contact support</li>
              </ul>

              <div class="footer">
                <p>This is an automated message from TC Helper. Please do not reply to this email.</p>
                <p>Need help? Visit <a href="https://tchelper.app">tchelper.app</a></p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('[send-rejection-email] Resend API error:', error);
      return { success: false, error };
    }

    console.log('[send-rejection-email] Email sent successfully:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('[send-rejection-email] Unexpected error:', error instanceof Error ? error.message : 'Unknown');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

import { z } from 'zod';
import { resend } from './client';

// Validation schemas
const emailSchema = z.string().email();

interface SendExtractionFailedEmailParams {
  email: string;
  fileName: string;
  errorMessage?: string;
}

export async function sendExtractionFailedEmail({ email, fileName, errorMessage }: SendExtractionFailedEmailParams) {
  try {
    // Validate email to prevent injection
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      console.error('[send-extraction-failed-email] Invalid email format:', email);
      return { success: false, error: 'Invalid email format' };
    }

    // Sanitize fileName to prevent XSS
    const safeFileName = fileName.replace(/[<>]/g, '');

    // Send email using inline HTML
    const { data, error } = await resend.emails.send({
      from: 'TC Helper Status <status@mail.tchelper.app>',
      to: emailValidation.data,
      subject: 'TC Helper - Extraction Failed',
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
              .error-box {
                background-color: #fef2f2;
                border-left: 4px solid #dc2626;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .cta-button {
                display: inline-block;
                background-color: #2563eb;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                margin-top: 20px;
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
              <h1 style="margin: 0; font-size: 24px;">⚠️ Extraction Failed</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received your email with the PDF file <strong>${safeFileName}</strong>, but unfortunately the extraction process failed.</p>

              ${errorMessage ? `
                <div class="error-box">
                  <strong>Error Details:</strong><br>
                  ${errorMessage}
                </div>
              ` : ''}

              <p><strong>What you can do:</strong></p>
              <ul>
                <li>Try uploading the PDF manually through our <a href="https://tchelper.app/upload">web interface</a></li>
                <li>Ensure the PDF is a valid real estate contract (we currently support escrow contracts)</li>
                <li>Check that the PDF is not password-protected or corrupted</li>
                <li>If the issue persists, contact our support team</li>
              </ul>

              <a href="https://tchelper.app/upload" class="cta-button">Try Manual Upload</a>

              <div class="footer">
                <p>This is an automated message from TC Helper. Please do not reply to this email.</p>
                <p>Need help? Visit <a href="https://tchelper.app/dashboard">your dashboard</a></p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('[send-extraction-failed-email] Resend API error:', error);
      return { success: false, error };
    }

    console.log('[send-extraction-failed-email] Email sent successfully:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('[send-extraction-failed-email] Unexpected error:', error instanceof Error ? error.message : 'Unknown');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

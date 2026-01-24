import { z } from 'zod';
import { resend } from './client';

// Validation schemas
const emailSchema = z.string().email();

interface ExtractedData {
  propertyAddress?: string | null;
  transactionType?: string | null;
  buyerNames?: string[];
  sellerNames?: string[];
  purchasePrice?: number | null;
  earnestMoneyAmount?: number | null;
  closingDate?: string | null;
  effectiveDate?: string | null;
  loanType?: string | null;
  isAllCash?: boolean | null;
  escrowHolder?: string | null;
  // Add other fields as needed
  [key: string]: any;
}

interface SendExtractionSuccessEmailParams {
  email: string;
  fileName: string;
  parseId: string;
  extractedData: ExtractedData;
}

/**
 * Format currency values
 */
function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date strings
 */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return dateStr; // Return as-is if parsing fails
  }
}

/**
 * Format array values
 */
function formatArray(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return 'N/A';
  return arr.join(', ');
}

/**
 * Generate HTML table row
 */
function tableRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">${label}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${value}</td>
    </tr>
  `;
}

export async function sendExtractionSuccessEmail({
  email,
  fileName,
  parseId,
  extractedData,
}: SendExtractionSuccessEmailParams) {
  try {
    // Validate email to prevent injection
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      console.error('[send-extraction-success-email] Invalid email format:', email);
      return { success: false, error: 'Invalid email format' };
    }

    // Sanitize fileName
    const safeFileName = fileName.replace(/[<>]/g, '');

    // Dashboard URLs
    const dashboardUrl = 'https://tchelper.app/dashboard';
    const transactionUrl = `https://tchelper.app/transactions?id=${parseId}`;

    // Build extracted data table
    const dataRows = [
      tableRow('Property Address', extractedData.propertyAddress || 'N/A'),
      tableRow('Transaction Type', extractedData.transactionType || 'N/A'),
      tableRow('Buyer(s)', formatArray(extractedData.buyerNames)),
      tableRow('Seller(s)', formatArray(extractedData.sellerNames)),
      tableRow('Purchase Price', formatCurrency(extractedData.purchasePrice)),
      tableRow('Earnest Money', formatCurrency(extractedData.earnestMoneyAmount)),
      tableRow('Closing Date', formatDate(extractedData.closingDate)),
      tableRow('Effective Date', formatDate(extractedData.effectiveDate)),
      tableRow('Financing', extractedData.isAllCash ? 'All Cash' : extractedData.loanType || 'N/A'),
      tableRow('Escrow Holder', extractedData.escrowHolder || 'N/A'),
    ].join('');

    // Send email using inline HTML
    const { data, error } = await resend.emails.send({
      from: 'TC Helper Status <status@mail.tchelper.app>',
      to: emailValidation.data,
      subject: `TC Helper - Extraction Complete: ${extractedData.propertyAddress || safeFileName}`,
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
                max-width: 700px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f9fafb;
              }
              .header {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                padding: 30px;
                border-radius: 8px 8px 0 0;
                text-align: center;
              }
              .content {
                background-color: white;
                padding: 30px;
                border-radius: 0 0 8px 8px;
              }
              .success-icon {
                font-size: 48px;
                margin-bottom: 10px;
              }
              .table-container {
                margin: 30px 0;
                overflow-x: auto;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                background-color: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                overflow: hidden;
              }
              .cta-buttons {
                display: flex;
                gap: 15px;
                margin: 30px 0;
                flex-wrap: wrap;
              }
              .cta-button {
                display: inline-block;
                padding: 14px 28px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                text-align: center;
                flex: 1;
                min-width: 200px;
              }
              .cta-primary {
                background-color: #2563eb;
                color: white;
              }
              .cta-secondary {
                background-color: #f3f4f6;
                color: #374151;
                border: 1px solid #d1d5db;
              }
              .info-box {
                background-color: #eff6ff;
                border-left: 4px solid #2563eb;
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
                text-align: center;
              }
              a {
                color: #2563eb;
                text-decoration: none;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="success-icon">✓</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Extraction Complete!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your contract has been processed successfully</p>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Great news! We've successfully extracted the data from your PDF file <strong>${safeFileName}</strong>.</p>

              <div class="info-box">
                <strong>📄 What's Next?</strong><br>
                Your transaction is now available in your dashboard. You can view all extracted details, manage tasks, and track important dates.
              </div>

              <h2 style="color: #111827; margin-top: 30px;">Extracted Information</h2>
              <div class="table-container">
                <table>
                  <tbody>
                    ${dataRows}
                  </tbody>
                </table>
              </div>

              <div class="cta-buttons">
                <a href="${transactionUrl}" class="cta-button cta-primary">
                  View Transaction Details
                </a>
                <a href="${dashboardUrl}" class="cta-button cta-secondary">
                  Go to Dashboard
                </a>
              </div>

              <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                <strong>Pro Tip:</strong> You can manage tasks, set reminders, and track your transaction timeline from the dashboard. All important dates have been automatically extracted and organized for you.
              </p>

              <div class="footer">
                <p>This is an automated message from TC Helper. Please do not reply to this email.</p>
                <p>Need help? Visit <a href="https://tchelper.app/dashboard">your dashboard</a> or check our support docs.</p>
                <p style="margin-top: 15px; font-size: 12px;">
                  © ${new Date().getFullYear()} TC Helper. All rights reserved.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('[send-extraction-success-email] Resend API error:', error);
      return { success: false, error };
    }

    console.log('[send-extraction-success-email] Email sent successfully:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('[send-extraction-success-email] Unexpected error:', error instanceof Error ? error.message : 'Unknown');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

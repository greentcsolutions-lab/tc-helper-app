/**
 * Send extraction success email using Resend template
 */

import { z } from 'zod';
import { sendTemplateEmail } from '../send';
import { EMAIL_FROM, EMAIL_TEMPLATES } from '../../constants';
import type { SendEmailResult } from '../../types';

const emailSchema = z.string().email();

export interface ExtractedData {
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
  [key: string]: any;
}

export interface SendExtractionSuccessEmailParams {
  email: string;
  fileName: string;
  parseId: string;
  extractedData: ExtractedData;
}

/**
 * Format currency values for template
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
 * Format date strings for template
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
 * Format array values for template
 */
function formatArray(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return 'N/A';
  return arr.join(', ');
}

/**
 * Send extraction success email with extracted contract data
 * Uses Resend template: extraction-success
 */
export async function sendExtractionSuccessEmail(
  params: SendExtractionSuccessEmailParams
): Promise<SendEmailResult> {
  const { email, fileName, parseId, extractedData } = params;

  // Validate email to prevent injection
  const emailValidation = emailSchema.safeParse(email);
  if (!emailValidation.success) {
    console.error('[send-extraction-success-email] Invalid email format:', email);
    return {
      success: false,
      error: 'Invalid email format',
    };
  }

  // Sanitize fileName
  const safeFileName = fileName.replace(/[<>]/g, '');

  // Format financing
  const financing = extractedData.isAllCash
    ? 'All Cash'
    : extractedData.loanType || 'N/A';

  // Send email using template
  return sendTemplateEmail(
    EMAIL_FROM.STATUS,
    emailValidation.data,
    EMAIL_TEMPLATES.EXTRACTION_SUCCESS,
    {
      file_name: safeFileName,
      property_address: extractedData.propertyAddress || 'N/A',
      transaction_type: extractedData.transactionType || 'N/A',
      buyer_names: formatArray(extractedData.buyerNames),
      seller_names: formatArray(extractedData.sellerNames),
      purchase_price: formatCurrency(extractedData.purchasePrice),
      earnest_money: formatCurrency(extractedData.earnestMoneyAmount),
      closing_date: formatDate(extractedData.closingDate),
      effective_date: formatDate(extractedData.effectiveDate),
      financing,
      escrow_holder: extractedData.escrowHolder || 'N/A',
      transaction_url: `https://tchelper.app/transactions?id=${parseId}`,
      dashboard_url: 'https://tchelper.app/dashboard',
    }
  );
}

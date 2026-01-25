/**
 * PDF attachment validation for email-based extraction
 */

import { PDF_LIMITS } from '../../constants';
import type { EmailAttachment, PdfValidationResult } from '../../types';

/**
 * Validate PDF attachment from email
 * @param attachments - Array of attachments from email
 * @returns Validation result with PDF buffer or rejection reason
 */
export async function validatePdfAttachment(
  attachments?: EmailAttachment[]
): Promise<PdfValidationResult> {
  if (!attachments || attachments.length === 0) {
    return {
      valid: false,
      reason: 'No PDF attachment found. Please attach a contract PDF to your email.',
    };
  }

  if (attachments.length > 1) {
    return {
      valid: false,
      reason:
        'Multiple attachments detected. We currently support only 1 PDF extraction at a time. Please send one PDF per email.',
    };
  }

  const attachment = attachments[0];

  // Check if it's a PDF
  if (
    !attachment.contentType.includes('pdf') &&
    !attachment.filename.toLowerCase().endsWith('.pdf')
  ) {
    return {
      valid: false,
      reason: 'Invalid file type. Please attach a PDF file (.pdf).',
    };
  }

  // Check file size (25MB max)
  if (attachment.size > PDF_LIMITS.MAX_SIZE_BYTES) {
    return {
      valid: false,
      reason: `PDF file too large (${(attachment.size / 1024 / 1024).toFixed(1)} MB). Maximum file size is ${PDF_LIMITS.MAX_SIZE_BYTES / 1024 / 1024} MB.`,
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
    console.error(
      '[validate-pdf] Error decoding PDF attachment:',
      error instanceof Error ? error.message : 'Unknown'
    );
    return {
      valid: false,
      reason: 'Failed to process PDF attachment. Please ensure the file is not corrupted.',
    };
  }
}

/**
 * Email-based PDF extraction handler
 * Processes emails sent to upload@mail.tchelper.app
 */

import { db } from '@/lib/prisma';
import { put } from '@vercel/blob';
import { getDocumentProxy } from 'unpdf';
import { validateExtractionUser } from './validate-user';
import { validatePdfAttachment } from './validate-pdf';
import { extractContractNotes } from './parse-email-notes';
import { checkEmailRateLimit } from '../rate-limiter';
import { sendRejectionEmail } from '../../outbound/system/rejection';
import { sendExtractionFailedEmail } from '../../outbound/system/extraction-failed';
import { sendExtractionSuccessEmail } from '../../outbound/system/extraction-success';
import { extractWithFastestAI } from '@/lib/extraction/shared/ai-race';
import { mapExtractionToParseResult } from '@/lib/parse/map-to-parse-result';
import { PDF_LIMITS } from '../../constants';
import type { InboundEmailPayload, EmailHandlerResult } from '../../types';

/**
 * Count pages in a PDF using unpdf
 */
async function countPdfPages(buffer: Buffer): Promise<number> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
    return pdf.numPages;
  } catch (error) {
    console.error('[extraction-handler] PDF page count error:', error);
    throw new Error('Failed to parse PDF structure');
  }
}

/**
 * Handle email-based PDF extraction
 * This is the main extraction pipeline for emails sent to upload@mail.tchelper.app
 */
export async function handleExtractionEmail(
  payload: InboundEmailPayload
): Promise<EmailHandlerResult> {
  const { from, to, subject, text, html, attachments } = payload;

  console.log(`[extraction-handler] Processing email from: ${from}`);

  // Step 1: Validate user and check quotas
  const userValidation = await validateExtractionUser(from);

  if (!userValidation.valid || !userValidation.user) {
    console.log(`[extraction-handler] User validation failed: ${userValidation.reason}`);

    // Send rejection email
    await sendRejectionEmail({
      email: from,
      reason: userValidation.reason || 'Unknown validation error',
      details: userValidation.details,
    });

    return {
      success: false,
      message: 'Email rejected, notification sent',
    };
  }

  const user = userValidation.user;
  console.log(`[extraction-handler] User validated: ${user.id} (${user.email})`);

  // Step 2: Check rate limit
  const rateLimit = await checkEmailRateLimit(user.id, 'extraction');

  if (!rateLimit.allowed) {
    console.log(
      `[extraction-handler] Rate limit exceeded: ${rateLimit.currentCount}/${rateLimit.limit}`
    );

    // Send rejection email
    await sendRejectionEmail({
      email: from,
      reason: `You've reached the maximum of ${rateLimit.limit} emails per hour. Please try again after ${rateLimit.resetAt.toLocaleTimeString()}.`,
      details: {
        currentCount: rateLimit.currentCount,
        limit: rateLimit.limit,
        resetAt: rateLimit.resetAt.toISOString(),
      },
    });

    return {
      success: false,
      message: 'Rate limit exceeded, notification sent',
    };
  }

  console.log(`[extraction-handler] Rate limit OK: ${rateLimit.currentCount}/${rateLimit.limit}`);

  // Step 3: Validate PDF attachment
  const pdfValidation = await validatePdfAttachment(attachments);

  if (!pdfValidation.valid || !pdfValidation.pdfBuffer || !pdfValidation.filename) {
    console.log(`[extraction-handler] PDF validation failed: ${pdfValidation.reason}`);

    // Send rejection email
    await sendRejectionEmail({
      email: from,
      reason: pdfValidation.reason || 'Invalid PDF attachment',
    });

    return {
      success: false,
      message: 'PDF validation failed, notification sent',
    };
  }

  const pdfBuffer = pdfValidation.pdfBuffer;
  const fileName = pdfValidation.filename;
  console.log(`[extraction-handler] PDF validated: ${fileName} (${pdfBuffer.length} bytes)`);

  // Step 4: Count PDF pages
  let pageCount = 0;
  try {
    pageCount = await countPdfPages(pdfBuffer);
    console.log(`[extraction-handler] PDF page count: ${pageCount}`);

    if (pageCount === 0 || pageCount < PDF_LIMITS.MIN_PAGES) {
      await sendRejectionEmail({
        email: from,
        reason:
          'Could not detect any pages in the PDF. The file may be corrupted or in a non-standard format.',
      });
      return {
        success: false,
        message: 'Invalid PDF, notification sent',
      };
    }

    if (pageCount > PDF_LIMITS.MAX_PAGES) {
      await sendRejectionEmail({
        email: from,
        reason: `PDF exceeds maximum page limit (${pageCount} pages). Maximum allowed is ${PDF_LIMITS.MAX_PAGES} pages.`,
        details: { pageCount, maxPages: PDF_LIMITS.MAX_PAGES },
      });
      return {
        success: false,
        message: 'PDF too large, notification sent',
      };
    }
  } catch (error) {
    console.error('[extraction-handler] Page count failed:', error);
    await sendRejectionEmail({
      email: from,
      reason: 'Failed to read PDF. The file may be corrupted or password-protected.',
    });
    return {
      success: false,
      message: 'PDF read error, notification sent',
    };
  }

  // Step 5: Extract contract notes from email body
  const contractNotes = extractContractNotes(text, html);
  console.log(`[extraction-handler] Contract notes extracted: ${contractNotes.length} characters`);

  // Step 6: Upload PDF to Vercel Blob
  let pdfPublicUrl: string;
  try {
    const { url } = await put(`uploads/email-${Date.now()}-${fileName}`, pdfBuffer, {
      access: 'public',
      addRandomSuffix: true,
    });
    pdfPublicUrl = url;
    console.log(`[extraction-handler] PDF uploaded to blob: ${pdfPublicUrl}`);
  } catch (error) {
    console.error('[extraction-handler] Blob upload failed:', error);
    await sendExtractionFailedEmail({
      email: from,
      fileName,
      errorMessage: 'Failed to upload PDF to storage. Please try again.',
    });
    return {
      success: false,
      message: 'Upload failed',
      error: error instanceof Error ? error.message : 'Unknown',
    };
  }

  // Step 7: Create Parse and Communication records in a transaction
  try {
    const result = await db.$transaction(async (tx) => {
      // Check if parse count needs reset
      const now = new Date();
      let parseCount = user.parseCount;

      if (user.planType === 'BASIC' && user.parseResetDate && now >= user.parseResetDate) {
        const nextReset = new Date(now);
        nextReset.setMonth(nextReset.getMonth() + 1);

        await tx.user.update({
          where: { id: user.id },
          data: {
            parseCount: 0,
            parseResetDate: nextReset,
          },
        });

        parseCount = 0;
      }

      // Deduct 1 credit and increment parseCount
      await tx.user.update({
        where: { id: user.id },
        data: {
          credits: { decrement: 1 },
          parseCount: { increment: 1 },
        },
      });

      // Create Parse record
      const parse = await tx.parse.create({
        data: {
          userId: user.id,
          fileName,
          state: 'Unknown',
          status: 'UPLOADED',
          pdfBuffer,
          pdfPublicUrl,
          pageCount,
          rawJson: {},
          formatted: {},
          criticalPageNumbers: [],
        },
      });

      // Create Communication record
      const communication = await tx.communication.create({
        data: {
          userId: user.id,
          direction: 'inbound',
          type: 'email',
          category: 'extraction',
          from,
          to,
          subject: subject || '(no subject)',
          bodyText: text,
          bodyHtml: html,
          attachments: attachments ? JSON.parse(JSON.stringify(attachments)) : null,
          status: 'processing',
          parseId: parse.id,
          metadata: {
            contractNotes,
            fileName,
            pageCount,
          },
        },
      });

      return { parse, communication };
    });

    const { parse, communication } = result;

    console.log(
      `[extraction-handler] Created parse ${parse.id} and communication ${communication.id}`
    );

    // Step 8: Trigger AI extraction
    console.log('[extraction-handler] Starting AI extraction...');

    try {
      // Run AI extraction
      const extractionResult = await extractWithFastestAI(pdfPublicUrl, pageCount);

      if (!extractionResult) {
        throw new Error('No AI providers available for extraction');
      }

      console.log(`[extraction-handler] Extraction complete via ${extractionResult.modelUsed}`);

      // Map extraction results to Parse fields
      const mappedFields = mapExtractionToParseResult({
        universal: extractionResult.finalTerms,
        route: extractionResult.modelUsed,
        details: {
          criticalPages: extractionResult.criticalPages,
          allExtractions: extractionResult.allExtractions,
        },
        timelineEvents: [],
      });

      const finalStatus = extractionResult.needsReview ? 'NEEDS_REVIEW' : 'COMPLETED';

      // Safety check for complex JSON fields
      const extractionDetailsJson = mappedFields.extractionDetails
        ? JSON.parse(JSON.stringify(mappedFields.extractionDetails))
        : undefined;

      // Update Parse record with extracted data
      await db.$transaction(async (tx) => {
        await tx.parse.update({
          where: { id: parse.id },
          data: {
            status: finalStatus,
            ...mappedFields,
            earnestMoneyDeposit: mappedFields.earnestMoneyDeposit ?? undefined,
            financing: mappedFields.financing ?? undefined,
            contingencies: mappedFields.contingencies ?? undefined,
            closingCosts: mappedFields.closingCosts ?? undefined,
            brokers: mappedFields.brokers ?? undefined,
            extractionDetails: extractionDetailsJson,
            timelineEvents: mappedFields.timelineEvents ?? undefined,
            finalizedAt: new Date(),
            personalPropertyIncluded: mappedFields.personalPropertyIncluded ?? undefined,
          },
        });

        // Update Communication status to completed
        await tx.communication.update({
          where: { id: communication.id },
          data: {
            status: 'completed',
          },
        });
      });

      console.log('[extraction-handler] Parse record updated with extraction data');

      // Send success email with extracted data
      await sendExtractionSuccessEmail({
        email: from,
        fileName,
        parseId: parse.id,
        extractedData: {
          propertyAddress: mappedFields.propertyAddress,
          transactionType: mappedFields.transactionType,
          buyerNames: mappedFields.buyerNames,
          sellerNames: mappedFields.sellerNames,
          purchasePrice: mappedFields.purchasePrice,
          earnestMoneyAmount: mappedFields.earnestMoneyAmount,
          closingDate: mappedFields.closingDate,
          effectiveDate: mappedFields.effectiveDate,
          loanType: mappedFields.loanType,
          isAllCash: mappedFields.isAllCash,
          escrowHolder: mappedFields.escrowHolder,
        },
      });

      console.log('[extraction-handler] Success email sent');

      return {
        success: true,
        message: 'Email processed and extraction completed successfully',
        parseId: parse.id,
        communicationId: communication.id,
      };
    } catch (extractionError) {
      console.error('[extraction-handler] Extraction failed:', extractionError);

      // Update Communication status to failed
      await db.communication.update({
        where: { id: communication.id },
        data: {
          status: 'failed',
          errorMessage:
            extractionError instanceof Error
              ? extractionError.message
              : 'Unknown extraction error',
        },
      });

      // Send failure email
      await sendExtractionFailedEmail({
        email: from,
        fileName,
        errorMessage:
          extractionError instanceof Error
            ? extractionError.message
            : 'Unknown extraction error',
      });

      console.log('[extraction-handler] Failure email sent');

      return {
        success: false,
        message: 'Email processed but extraction failed, notification sent',
        parseId: parse.id,
        communicationId: communication.id,
      };
    }
  } catch (error) {
    console.error('[extraction-handler] Database transaction failed:', error);
    await sendExtractionFailedEmail({
      email: from,
      fileName,
      errorMessage: 'Failed to create transaction record. Please try again.',
    });
    return {
      success: false,
      message: 'Database error',
      error: error instanceof Error ? error.message : 'Unknown',
    };
  }
}

// src/app/api/email/inbound/route.ts
// Webhook endpoint for receiving inbound emails from Resend
// Handles email-based PDF uploads with validation, rate limiting, and extraction

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/lib/prisma';
import { put } from '@vercel/blob';
import { getDocumentProxy } from 'unpdf';
import { inboundEmailSchema, validateInboundEmail, validatePdfAttachment } from '@/lib/email/validate-inbound';
import { checkEmailRateLimit } from '@/lib/email/rate-limiter';
import { extractContractNotes } from '@/lib/email/parse-email-notes';
import { sendRejectionEmail } from '@/lib/email/send-rejection-email';
import { sendExtractionFailedEmail } from '@/lib/email/send-extraction-failed-email';
import { sendExtractionSuccessEmail } from '@/lib/email/send-extraction-success-email';
import { extractWithFastestAI } from '@/lib/extraction/shared/ai-race';
import { mapExtractionToParseResult } from '@/lib/parse/map-to-parse-result';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Verify Resend webhook signature
 * @param payload - Raw request body as string
 * @param signature - Signature from request headers
 * @param secret - Webhook secret from environment
 * @returns true if signature is valid
 */
function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) {
    console.error('[email-inbound] Missing signature or secret');
    return false;
  }

  try {
    const hmac = createHmac('sha256', secret);
    const digest = `sha256=${hmac.update(payload).digest('hex')}`;
    return digest === signature;
  } catch (error) {
    console.error('[email-inbound] Signature verification error:', error instanceof Error ? error.message : 'Unknown');
    return false;
  }
}

/**
 * Count pages in a PDF using unpdf
 */
async function countPdfPages(buffer: Buffer): Promise<number> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
    return pdf.numPages;
  } catch (error) {
    console.error('[email-inbound] PDF page count error:', error);
    throw new Error('Failed to parse PDF structure');
  }
}

/**
 * Process inbound email webhook from Resend
 */
export async function POST(req: NextRequest) {
  console.log('[email-inbound] === NEW INBOUND EMAIL ===');

  // Step 1: Verify webhook signature
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[email-inbound] RESEND_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('resend-signature');

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    console.error('[email-inbound] Invalid webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  console.log('[email-inbound] Signature verified ✓');

  // Step 2: Parse and validate webhook payload
  let emailPayload: any;
  try {
    emailPayload = JSON.parse(rawBody);
  } catch (error) {
    console.error('[email-inbound] Failed to parse JSON payload');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = inboundEmailSchema.safeParse(emailPayload);
  if (!validation.success) {
    console.error('[email-inbound] Invalid email payload:', validation.error.format());
    return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
  }

  const { from, to, subject, text, html, attachments } = validation.data;
  console.log(`[email-inbound] Email from: ${from}, to: ${to}, subject: ${subject || '(no subject)'}`);

  // Verify email was sent to upload@mail.tchelper.app
  if (to !== 'upload@mail.tchelper.app') {
    console.error('[email-inbound] Email sent to wrong address:', to);
    return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 });
  }

  // Step 3: Validate user and check quotas
  const userValidation = await validateInboundEmail(from);

  if (!userValidation.valid || !userValidation.user) {
    console.log(`[email-inbound] User validation failed: ${userValidation.reason}`);

    // Send rejection email
    await sendRejectionEmail({
      email: from,
      reason: userValidation.reason || 'Unknown validation error',
      details: userValidation.details,
    });

    // Return 200 to prevent Resend retries (we handled it)
    return NextResponse.json({ message: 'Email rejected, notification sent' }, { status: 200 });
  }

  const user = userValidation.user;
  console.log(`[email-inbound] User validated: ${user.id} (${user.email})`);

  // Step 4: Check rate limit
  const rateLimit = await checkEmailRateLimit(user.id);

  if (!rateLimit.allowed) {
    console.log(`[email-inbound] Rate limit exceeded: ${rateLimit.currentCount}/${rateLimit.limit}`);

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

    return NextResponse.json({ message: 'Rate limit exceeded, notification sent' }, { status: 200 });
  }

  console.log(`[email-inbound] Rate limit OK: ${rateLimit.currentCount}/${rateLimit.limit}`);

  // Step 5: Validate PDF attachment
  const pdfValidation = await validatePdfAttachment(attachments);

  if (!pdfValidation.valid || !pdfValidation.pdfBuffer || !pdfValidation.filename) {
    console.log(`[email-inbound] PDF validation failed: ${pdfValidation.reason}`);

    // Send rejection email
    await sendRejectionEmail({
      email: from,
      reason: pdfValidation.reason || 'Invalid PDF attachment',
    });

    return NextResponse.json({ message: 'PDF validation failed, notification sent' }, { status: 200 });
  }

  const pdfBuffer = pdfValidation.pdfBuffer;
  const fileName = pdfValidation.filename;
  console.log(`[email-inbound] PDF validated: ${fileName} (${pdfBuffer.length} bytes)`);

  // Step 6: Count PDF pages
  let pageCount = 0;
  try {
    pageCount = await countPdfPages(pdfBuffer);
    console.log(`[email-inbound] PDF page count: ${pageCount}`);

    if (pageCount === 0) {
      await sendRejectionEmail({
        email: from,
        reason: 'Could not detect any pages in the PDF. The file may be corrupted or in a non-standard format.',
      });
      return NextResponse.json({ message: 'Invalid PDF, notification sent' }, { status: 200 });
    }

    if (pageCount > 100) {
      await sendRejectionEmail({
        email: from,
        reason: `PDF exceeds maximum page limit (${pageCount} pages). Maximum allowed is 100 pages.`,
        details: { pageCount, maxPages: 100 },
      });
      return NextResponse.json({ message: 'PDF too large, notification sent' }, { status: 200 });
    }
  } catch (error) {
    console.error('[email-inbound] Page count failed:', error);
    await sendRejectionEmail({
      email: from,
      reason: 'Failed to read PDF. The file may be corrupted or password-protected.',
    });
    return NextResponse.json({ message: 'PDF read error, notification sent' }, { status: 200 });
  }

  // Step 7: Extract contract notes from email body
  const contractNotes = extractContractNotes(text, html);
  console.log(`[email-inbound] Contract notes extracted: ${contractNotes.length} characters`);

  // Step 8: Upload PDF to Vercel Blob
  let pdfPublicUrl: string;
  try {
    const { url } = await put(`uploads/email-${Date.now()}-${fileName}`, pdfBuffer, {
      access: 'public',
      addRandomSuffix: true,
    });
    pdfPublicUrl = url;
    console.log(`[email-inbound] PDF uploaded to blob: ${pdfPublicUrl}`);
  } catch (error) {
    console.error('[email-inbound] Blob upload failed:', error);
    await sendExtractionFailedEmail({
      email: from,
      fileName,
      errorMessage: 'Failed to upload PDF to storage. Please try again.',
    });
    return NextResponse.json({ message: 'Upload failed' }, { status: 500 });
  }

  // Step 9: Create Parse and Communication records in a transaction
  try {
    const result = await db.$transaction(async (tx) => {
      // Check if parse count needs reset
      const now = new Date();
      let parseCount = user.parseCount;
      let needsReset = false;

      if (user.planType === 'BASIC' && user.parseResetDate && now >= user.parseResetDate) {
        needsReset = true;
        parseCount = 0;
        const nextReset = new Date(now);
        nextReset.setMonth(nextReset.getMonth() + 1);

        await tx.user.update({
          where: { id: user.id },
          data: {
            parseCount: 0,
            parseResetDate: nextReset,
          },
        });
      }

      // Deduct 1 credit
      await tx.user.update({
        where: { id: user.id },
        data: {
          credits: { decrement: 1 },
        },
      });

      // Increment parseCount
      await tx.user.update({
        where: { id: user.id },
        data: {
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

    console.log(`[email-inbound] Created parse ${parse.id} and communication ${communication.id}`);

    // Step 10: Trigger extraction
    console.log('[email-inbound] Starting AI extraction...');

    try {
      // Run AI extraction
      const extractionResult = await extractWithFastestAI(pdfPublicUrl, pageCount);

      if (!extractionResult) {
        throw new Error('No AI providers available for extraction');
      }

      console.log(`[email-inbound] Extraction complete via ${extractionResult.modelUsed}`);

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

      console.log('[email-inbound] Parse record updated with extraction data');

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

      console.log('[email-inbound] Success email sent');

      return NextResponse.json({
        message: 'Email processed and extraction completed successfully',
        parseId: parse.id,
        communicationId: communication.id,
        status: finalStatus,
      }, { status: 200 });

    } catch (extractionError) {
      console.error('[email-inbound] Extraction failed:', extractionError);

      // Update Communication status to failed
      await db.communication.update({
        where: { id: communication.id },
        data: {
          status: 'failed',
          errorMessage: extractionError instanceof Error ? extractionError.message : 'Unknown extraction error',
        },
      });

      // Send failure email
      await sendExtractionFailedEmail({
        email: from,
        fileName,
        errorMessage: extractionError instanceof Error ? extractionError.message : 'Unknown extraction error',
      });

      console.log('[email-inbound] Failure email sent');

      // Return 200 because we handled the failure gracefully
      return NextResponse.json({
        message: 'Email processed but extraction failed, notification sent',
        parseId: parse.id,
        communicationId: communication.id,
      }, { status: 200 });
    }

  } catch (error) {
    console.error('[email-inbound] Database transaction failed:', error);
    await sendExtractionFailedEmail({
      email: from,
      fileName,
      errorMessage: 'Failed to create transaction record. Please try again.',
    });
    return NextResponse.json({ message: 'Database error' }, { status: 500 });
  }
}

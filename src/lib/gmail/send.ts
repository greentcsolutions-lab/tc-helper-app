// src/lib/gmail/send.ts
// Gmail email sending utilities

import { getGmailClient, TC_HELPER_LABEL_NAME } from './client';
import { prisma } from '@/lib/prisma';

export interface SendEmailOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    data: Buffer;
  }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}

/**
 * Send an email via Gmail
 */
export async function sendEmail(
  userId: string,
  options: SendEmailOptions,
  metadata?: {
    parseId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<SendEmailResult> {
  const gmail = await getGmailClient(userId);
  if (!gmail) {
    return { success: false, error: 'Gmail not connected' };
  }

  // Get user's Gmail settings for signature
  const settings = await prisma.gmailSettings.findUnique({
    where: { userId },
    select: {
      primaryEmailAddress: true,
      tcHelperLabelId: true,
      useCustomSignature: true,
      customSignature: true,
    },
  });

  if (!settings?.primaryEmailAddress) {
    return { success: false, error: 'Gmail address not found' };
  }

  try {
    // Build email content
    let body = options.bodyHtml || options.bodyText || '';

    // Append custom signature if enabled
    if (settings.useCustomSignature && settings.customSignature) {
      if (options.bodyHtml) {
        body = `${options.bodyHtml}<br><br>${settings.customSignature}`;
      } else if (options.bodyText) {
        // Convert signature to plain text if sending plain text
        const plainSignature = settings.customSignature
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        body = `${options.bodyText}\n\n${plainSignature}`;
      }
    }

    // Build MIME message
    const mimeMessage = buildMimeMessage({
      from: settings.primaryEmailAddress,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      bodyText: options.bodyText,
      bodyHtml: body,
      threadId: options.threadId,
      inReplyTo: options.inReplyTo,
      references: options.references,
      attachments: options.attachments,
    });

    // Send email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: mimeMessage,
        threadId: options.threadId,
      },
    });

    const messageId = response.data.id;
    const threadId = response.data.threadId;

    // Apply TC Helper label to the sent message
    if (messageId && settings.tcHelperLabelId) {
      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
            addLabelIds: [settings.tcHelperLabelId],
          },
        });
      } catch (labelError) {
        console.error('[Gmail] Error applying label:', labelError);
        // Non-fatal, continue
      }
    }

    // Record sent email for audit trail
    await prisma.sentEmail.create({
      data: {
        userId,
        gmailMessageId: messageId,
        gmailThreadId: threadId,
        to: options.to,
        cc: options.cc || [],
        bcc: options.bcc || [],
        subject: options.subject,
        bodyText: options.bodyText,
        bodyHtml: options.bodyHtml,
        attachmentsMeta: options.attachments?.map((a) => ({
          name: a.filename,
          size: a.data.length,
          mimeType: a.mimeType,
        })),
        parseId: metadata?.parseId,
        sentVia: 'gmail',
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    return {
      success: true,
      messageId: messageId || undefined,
      threadId: threadId || undefined,
    };
  } catch (error) {
    console.error('[Gmail] Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build a MIME message for Gmail API
 */
function buildMimeMessage(options: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    data: Buffer;
  }>;
}): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const mixedBoundary = `mixed_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const hasAttachments = options.attachments && options.attachments.length > 0;
  const hasHtml = !!options.bodyHtml;
  const hasText = !!options.bodyText;

  let headers = [
    `From: ${options.from}`,
    `To: ${options.to.join(', ')}`,
  ];

  if (options.cc && options.cc.length > 0) {
    headers.push(`Cc: ${options.cc.join(', ')}`);
  }

  if (options.bcc && options.bcc.length > 0) {
    headers.push(`Bcc: ${options.bcc.join(', ')}`);
  }

  headers.push(`Subject: =?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=`);

  if (options.inReplyTo) {
    headers.push(`In-Reply-To: ${options.inReplyTo}`);
  }

  if (options.references) {
    headers.push(`References: ${options.references}`);
  }

  headers.push('MIME-Version: 1.0');

  let messageParts: string[] = [];

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);

    // Start mixed content
    messageParts.push('');
    messageParts.push(`--${mixedBoundary}`);

    if (hasHtml && hasText) {
      // Alternative content
      messageParts.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      messageParts.push('');
      messageParts.push(`--${boundary}`);
      messageParts.push('Content-Type: text/plain; charset="UTF-8"');
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push('');
      messageParts.push(Buffer.from(options.bodyText!).toString('base64'));
      messageParts.push(`--${boundary}`);
      messageParts.push('Content-Type: text/html; charset="UTF-8"');
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push('');
      messageParts.push(Buffer.from(options.bodyHtml!).toString('base64'));
      messageParts.push(`--${boundary}--`);
    } else if (hasHtml) {
      messageParts.push('Content-Type: text/html; charset="UTF-8"');
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push('');
      messageParts.push(Buffer.from(options.bodyHtml!).toString('base64'));
    } else if (hasText) {
      messageParts.push('Content-Type: text/plain; charset="UTF-8"');
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push('');
      messageParts.push(Buffer.from(options.bodyText!).toString('base64'));
    }

    // Add attachments
    for (const attachment of options.attachments!) {
      messageParts.push(`--${mixedBoundary}`);
      messageParts.push(
        `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`
      );
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push(
        `Content-Disposition: attachment; filename="${attachment.filename}"`
      );
      messageParts.push('');
      messageParts.push(attachment.data.toString('base64'));
    }

    messageParts.push(`--${mixedBoundary}--`);
  } else if (hasHtml && hasText) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    messageParts.push('');
    messageParts.push(`--${boundary}`);
    messageParts.push('Content-Type: text/plain; charset="UTF-8"');
    messageParts.push('Content-Transfer-Encoding: base64');
    messageParts.push('');
    messageParts.push(Buffer.from(options.bodyText!).toString('base64'));
    messageParts.push(`--${boundary}`);
    messageParts.push('Content-Type: text/html; charset="UTF-8"');
    messageParts.push('Content-Transfer-Encoding: base64');
    messageParts.push('');
    messageParts.push(Buffer.from(options.bodyHtml!).toString('base64'));
    messageParts.push(`--${boundary}--`);
  } else if (hasHtml) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    headers.push('Content-Transfer-Encoding: base64');
    messageParts.push('');
    messageParts.push(Buffer.from(options.bodyHtml!).toString('base64'));
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    headers.push('Content-Transfer-Encoding: base64');
    messageParts.push('');
    messageParts.push(Buffer.from(options.bodyText || '').toString('base64'));
  }

  const message = headers.join('\r\n') + '\r\n' + messageParts.join('\r\n');

  // Encode to base64url
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Reply to an existing email thread
 */
export async function replyToThread(
  userId: string,
  threadId: string,
  options: Omit<SendEmailOptions, 'threadId'>,
  metadata?: {
    parseId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<SendEmailResult> {
  return sendEmail(
    userId,
    {
      ...options,
      threadId,
    },
    metadata
  );
}

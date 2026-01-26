// src/lib/gmail/messages.ts
// Gmail message fetching and threading utilities

import { gmail_v1 } from 'googleapis';
import { getGmailClient, TC_HELPER_LABEL_NAME } from './client';

export interface EmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  date: string;
  timestamp: number;
  isRead: boolean;
  hasAttachments: boolean;
  attachments: EmailAttachment[];
  bodyText: string;
  bodyHtml: string;
  isSentByUser: boolean;
  isTcHelper: boolean;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface EmailThread {
  id: string;
  subject: string;
  snippet: string;
  participants: string[];
  lastMessageDate: string;
  lastMessageTimestamp: number;
  messageCount: number;
  isRead: boolean;
  hasAttachments: boolean;
  isTcHelper: boolean;
  messages: EmailMessage[];
}

export interface FetchEmailsOptions {
  startDate: Date;
  endDate: Date;
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
  includeSpam?: boolean;
}

/**
 * Fetches emails from Gmail within a date range
 */
export async function fetchEmails(
  userId: string,
  options: FetchEmailsOptions
): Promise<{ messages: EmailMessage[]; nextPageToken?: string }> {
  const gmail = await getGmailClient(userId);
  if (!gmail) {
    throw new Error('Gmail not connected');
  }

  // Build query string for date range
  const afterDate = Math.floor(options.startDate.getTime() / 1000);
  const beforeDate = Math.floor(options.endDate.getTime() / 1000);
  let query = `after:${afterDate} before:${beforeDate}`;

  if (!options.includeSpam) {
    query += ' -in:spam -in:trash';
  }

  // Fetch message list
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: options.maxResults || 100,
    pageToken: options.pageToken,
    labelIds: options.labelIds,
  });

  const messageIds = listResponse.data.messages || [];
  const messages: EmailMessage[] = [];

  // Fetch full message details in batches
  for (const msgRef of messageIds) {
    if (!msgRef.id) continue;

    try {
      const message = await fetchMessageDetails(gmail, msgRef.id);
      if (message) {
        messages.push(message);
      }
    } catch (error) {
      console.error(`[Gmail] Error fetching message ${msgRef.id}:`, error);
    }
  }

  return {
    messages,
    nextPageToken: listResponse.data.nextPageToken || undefined,
  };
}

/**
 * Fetches full message details including body and attachments
 */
async function fetchMessageDetails(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<EmailMessage | null> {
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const message = response.data;
  if (!message || !message.payload) return null;

  const headers = message.payload.headers || [];
  const getHeader = (name: string): string => {
    const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
    return header?.value || '';
  };

  const subject = getHeader('Subject');
  const from = getHeader('From');
  const to = parseAddressList(getHeader('To'));
  const cc = parseAddressList(getHeader('Cc'));
  const date = getHeader('Date');
  const timestamp = message.internalDate ? parseInt(message.internalDate, 10) : Date.now();

  const labelIds = message.labelIds || [];
  const isRead = !labelIds.includes('UNREAD');
  const isSentByUser = labelIds.includes('SENT');
  const isTcHelper = labelIds.some(
    (id) => id === TC_HELPER_LABEL_NAME || id.includes('TC Helper')
  );

  // Extract body
  const { bodyText, bodyHtml } = extractBody(message.payload);

  // Extract attachments
  const attachments = extractAttachments(message.payload, messageId);

  return {
    id: message.id || messageId,
    threadId: message.threadId || '',
    labelIds,
    snippet: message.snippet || '',
    subject,
    from,
    to,
    cc,
    date,
    timestamp,
    isRead,
    hasAttachments: attachments.length > 0,
    attachments,
    bodyText,
    bodyHtml,
    isSentByUser,
    isTcHelper,
  };
}

/**
 * Parse address list from header value
 */
function parseAddressList(value: string): string[] {
  if (!value) return [];
  return value.split(',').map((addr) => addr.trim()).filter(Boolean);
}

/**
 * Extract body text and HTML from message payload
 */
function extractBody(payload: gmail_v1.Schema$MessagePart): {
  bodyText: string;
  bodyHtml: string;
} {
  let bodyText = '';
  let bodyHtml = '';

  function processPayload(part: gmail_v1.Schema$MessagePart) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText = decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml = decodeBase64Url(part.body.data);
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        processPayload(subPart);
      }
    }
  }

  processPayload(payload);

  // Fallback: if only one format is available
  if (!bodyText && bodyHtml) {
    bodyText = stripHtml(bodyHtml);
  }

  return { bodyText, bodyHtml };
}

/**
 * Extract attachment metadata from message payload
 */
function extractAttachments(
  payload: gmail_v1.Schema$MessagePart,
  messageId: string
): EmailAttachment[] {
  const attachments: EmailAttachment[] = [];

  function processPayload(part: gmail_v1.Schema$MessagePart) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
      });
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        processPayload(subPart);
      }
    }
  }

  processPayload(payload);
  return attachments;
}

/**
 * Decode base64url encoded string
 */
function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Strip HTML tags from string
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch threads (conversations) within a date range
 */
export async function fetchThreads(
  userId: string,
  options: FetchEmailsOptions
): Promise<{ threads: EmailThread[]; nextPageToken?: string }> {
  const gmail = await getGmailClient(userId);
  if (!gmail) {
    throw new Error('Gmail not connected');
  }

  // Build query string
  const afterDate = Math.floor(options.startDate.getTime() / 1000);
  const beforeDate = Math.floor(options.endDate.getTime() / 1000);
  let query = `after:${afterDate} before:${beforeDate}`;

  if (!options.includeSpam) {
    query += ' -in:spam -in:trash';
  }

  // Fetch thread list
  const listResponse = await gmail.users.threads.list({
    userId: 'me',
    q: query,
    maxResults: options.maxResults || 50,
    pageToken: options.pageToken,
    labelIds: options.labelIds,
  });

  const threadRefs = listResponse.data.threads || [];
  const threads: EmailThread[] = [];

  // Fetch full thread details
  for (const threadRef of threadRefs) {
    if (!threadRef.id) continue;

    try {
      const thread = await fetchThreadDetails(gmail, threadRef.id);
      if (thread) {
        threads.push(thread);
      }
    } catch (error) {
      console.error(`[Gmail] Error fetching thread ${threadRef.id}:`, error);
    }
  }

  return {
    threads,
    nextPageToken: listResponse.data.nextPageToken || undefined,
  };
}

/**
 * Fetch full thread details including all messages
 */
async function fetchThreadDetails(
  gmail: gmail_v1.Gmail,
  threadId: string
): Promise<EmailThread | null> {
  const response = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });

  const thread = response.data;
  if (!thread || !thread.messages || thread.messages.length === 0) {
    return null;
  }

  const messages: EmailMessage[] = [];
  const participantsSet = new Set<string>();
  let hasAttachments = false;
  let isTcHelper = false;
  let isRead = true;

  for (const msg of thread.messages) {
    if (!msg.payload) continue;

    const headers = msg.payload.headers || [];
    const getHeader = (name: string): string => {
      const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const subject = getHeader('Subject');
    const from = getHeader('From');
    const to = parseAddressList(getHeader('To'));
    const cc = parseAddressList(getHeader('Cc'));
    const date = getHeader('Date');
    const timestamp = msg.internalDate ? parseInt(msg.internalDate, 10) : Date.now();

    const labelIds = msg.labelIds || [];
    const msgIsRead = !labelIds.includes('UNREAD');
    const isSentByUser = labelIds.includes('SENT');
    const msgIsTcHelper = labelIds.some(
      (id) => id === TC_HELPER_LABEL_NAME || id.includes('TC Helper')
    );

    if (!msgIsRead) isRead = false;
    if (msgIsTcHelper) isTcHelper = true;

    // Track participants
    participantsSet.add(from);
    to.forEach((addr) => participantsSet.add(addr));

    const { bodyText, bodyHtml } = extractBody(msg.payload);
    const attachments = extractAttachments(msg.payload, msg.id || '');

    if (attachments.length > 0) hasAttachments = true;

    messages.push({
      id: msg.id || '',
      threadId: msg.threadId || threadId,
      labelIds,
      snippet: msg.snippet || '',
      subject,
      from,
      to,
      cc,
      date,
      timestamp,
      isRead: msgIsRead,
      hasAttachments: attachments.length > 0,
      attachments,
      bodyText,
      bodyHtml,
      isSentByUser,
      isTcHelper: msgIsTcHelper,
    });
  }

  // Sort messages by timestamp
  messages.sort((a, b) => a.timestamp - b.timestamp);

  const lastMessage = messages[messages.length - 1];
  const firstMessage = messages[0];

  return {
    id: threadId,
    subject: firstMessage?.subject || '(no subject)',
    snippet: lastMessage?.snippet || '',
    participants: Array.from(participantsSet),
    lastMessageDate: lastMessage?.date || '',
    lastMessageTimestamp: lastMessage?.timestamp || 0,
    messageCount: messages.length,
    isRead,
    hasAttachments,
    isTcHelper,
    messages,
  };
}

/**
 * Download attachment data
 */
export async function downloadAttachment(
  userId: string,
  messageId: string,
  attachmentId: string
): Promise<{ data: Buffer; mimeType: string; filename: string } | null> {
  const gmail = await getGmailClient(userId);
  if (!gmail) {
    throw new Error('Gmail not connected');
  }

  try {
    // Get message to find attachment metadata
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    let filename = 'attachment';
    let mimeType = 'application/octet-stream';

    // Find attachment metadata
    function findAttachment(part: gmail_v1.Schema$MessagePart) {
      if (part.body?.attachmentId === attachmentId && part.filename) {
        filename = part.filename;
        mimeType = part.mimeType || mimeType;
        return true;
      }
      if (part.parts) {
        for (const subPart of part.parts) {
          if (findAttachment(subPart)) return true;
        }
      }
      return false;
    }

    if (message.data.payload) {
      findAttachment(message.data.payload);
    }

    // Download attachment
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    if (!attachment.data.data) {
      return null;
    }

    const data = Buffer.from(attachment.data.data, 'base64');

    return { data, mimeType, filename };
  } catch (error) {
    console.error('[Gmail] Error downloading attachment:', error);
    return null;
  }
}

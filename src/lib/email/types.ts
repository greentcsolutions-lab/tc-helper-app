/**
 * Shared types and interfaces for the email system
 */

import { z } from 'zod';
import { EMAIL_LIMITS } from './constants';

/**
 * Email attachment structure from Resend webhook
 */
export interface EmailAttachment {
  filename: string;
  content: string; // Base64-encoded
  contentType: string;
  size: number;
}

/**
 * Inbound email payload from Resend webhook
 */
export const inboundEmailSchema = z.object({
  from: z.string().email(),
  to: z.string().email(),
  subject: z.string().max(EMAIL_LIMITS.MAX_SUBJECT_LENGTH).optional(),
  text: z.string().max(EMAIL_LIMITS.MAX_TEXT_BODY_LENGTH).optional(),
  html: z.string().max(EMAIL_LIMITS.MAX_HTML_BODY_LENGTH).optional(),
  attachments: z.array(
    z.object({
      filename: z.string(),
      content: z.string(), // Base64
      contentType: z.string(),
      size: z.number(),
    })
  ).optional(),
});

export type InboundEmailPayload = z.infer<typeof inboundEmailSchema>;

/**
 * Email validation result
 */
export interface ValidationResult<T = any> {
  valid: boolean;
  reason?: string;
  details?: Record<string, any>;
  data?: T;
}

/**
 * User validation result with user data
 */
export interface UserValidationResult extends ValidationResult {
  user?: {
    id: string;
    email: string;
    credits: number;
    parseCount: number;
    parseLimit: number;
    planType: string;
    parseResetDate: Date | null;
  };
}

/**
 * PDF validation result with buffer
 */
export interface PdfValidationResult extends ValidationResult {
  pdfBuffer?: Buffer;
  filename?: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  resetAt: Date;
}

/**
 * Email handler result
 */
export interface EmailHandlerResult {
  success: boolean;
  message: string;
  parseId?: string;
  communicationId?: string;
  error?: string | object;
}

/**
 * Resend template parameters
 */
export interface ResendTemplateParams {
  id: string;
  variables: Record<string, any>;
}

/**
 * Send email parameters
 */
export interface SendEmailParams {
  from: string;
  to: string | string[];
  subject?: string;
  template?: ResendTemplateParams;
  html?: string; // Only used for user-generated emails if template not provided
  replyTo?: string;
}

/**
 * Email send result
 */
export interface SendEmailResult {
  success: boolean;
  data?: {
    id: string;
  };
  error?: string | object;
}

/**
 * Inbound email route type
 */
export type InboundRouteType = 'extraction' | 'support' | 'unknown';

/**
 * Inbound email handler function signature
 */
export type InboundEmailHandler = (
  payload: InboundEmailPayload
) => Promise<EmailHandlerResult>;

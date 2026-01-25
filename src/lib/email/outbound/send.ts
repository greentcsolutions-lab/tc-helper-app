/**
 * Unified email sender using Resend
 * All outbound emails (system and user-generated) go through this module
 */

import { z } from 'zod';
import { resend } from '../client';
import type { SendEmailParams, SendEmailResult } from '../types';

// Email validation schema
const emailSchema = z.string().email();
const emailArraySchema = z.array(z.string().email()).min(1);

/**
 * Send an email using Resend
 * Supports both template-based emails and custom HTML
 *
 * @param params - Email parameters
 * @returns Send result with success status and Resend email ID
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { from, to, subject, template, html, replyTo } = params;

  try {
    // Validate email addresses
    const toValidation = Array.isArray(to)
      ? emailArraySchema.safeParse(to)
      : emailSchema.safeParse(to);

    if (!toValidation.success) {
      console.error('[send-email] Invalid recipient email(s):', to);
      return {
        success: false,
        error: 'Invalid recipient email address(es)',
      };
    }

    const fromValidation = emailSchema.safeParse(
      // Extract email from "Name <email>" format
      from.includes('<') ? from.match(/<(.+)>/)?.[1] || from : from
    );

    if (!fromValidation.success) {
      console.error('[send-email] Invalid sender email:', from);
      return {
        success: false,
        error: 'Invalid sender email address',
      };
    }

    // Build email payload
    const emailPayload: any = {
      from,
      to: toValidation.data,
      replyTo,
    };

    // Template-based email (preferred for system emails)
    if (template) {
      emailPayload.template = {
        id: template.id,
        variables: template.variables,
      };
    }
    // Custom HTML email (for user-generated or legacy)
    else if (html && subject) {
      emailPayload.subject = subject;
      emailPayload.html = html;
    }
    // Missing required content
    else {
      console.error('[send-email] Missing template or html+subject');
      return {
        success: false,
        error: 'Either template or (html + subject) is required',
      };
    }

    // Send via Resend
    const { data, error } = await resend.emails.send(emailPayload);

    if (error) {
      console.error('[send-email] Resend API error:', error);
      return {
        success: false,
        error,
      };
    }

    console.log('[send-email] Email sent successfully:', data?.id);
    return {
      success: true,
      data: {
        id: data!.id,
      },
    };
  } catch (error) {
    console.error(
      '[send-email] Unexpected error:',
      error instanceof Error ? error.message : 'Unknown'
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send an email using a Resend template
 * Convenience wrapper for template-based emails
 *
 * @param from - Sender address
 * @param to - Recipient address(es)
 * @param templateId - Resend template ID
 * @param variables - Template variables
 * @returns Send result
 */
export async function sendTemplateEmail(
  from: string,
  to: string | string[],
  templateId: string,
  variables: Record<string, any>
): Promise<SendEmailResult> {
  return sendEmail({
    from,
    to,
    template: {
      id: templateId,
      variables,
    },
  });
}

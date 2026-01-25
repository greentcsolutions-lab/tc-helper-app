/**
 * Email system constants and configuration
 */

/**
 * Sender addresses for system emails
 */
export const EMAIL_FROM = {
  ONBOARDING: 'TC Helper <onboarding@updates.tchelper.app>',
  STATUS: 'TC Helper Status <status@mail.tchelper.app>',
  SUPPORT: 'TC Helper Support <support@mail.tchelper.app>',
  NOREPLY: 'TC Helper <noreply@mail.tchelper.app>',
} as const;

/**
 * Recipient addresses for inbound routing
 */
export const EMAIL_TO = {
  UPLOAD: 'upload@mail.tchelper.app',
  SUPPORT: 'support@mail.tchelper.app',
} as const;

/**
 * Resend template IDs (must match templates in Resend dashboard)
 */
export const EMAIL_TEMPLATES = {
  WELCOME: 'welcome-email',
  EXTRACTION_SUCCESS: 'extraction-success',
  EXTRACTION_FAILED: 'extraction-failed',
  UPLOAD_REJECTED: 'upload-rejected',
  SUPPORT_RECEIVED: 'support-received',
} as const;

/**
 * Rate limits by email category (emails per hour per user)
 */
export const RATE_LIMITS = {
  EXTRACTION: 5,
  SUPPORT: 10,
  USER_GENERATED: 20,
} as const;

/**
 * PDF validation limits
 */
export const PDF_LIMITS = {
  MAX_SIZE_BYTES: 25 * 1024 * 1024, // 25MB
  MAX_PAGES: 100,
  MIN_PAGES: 1,
} as const;

/**
 * Email payload size limits
 */
export const EMAIL_LIMITS = {
  MAX_SUBJECT_LENGTH: 500,
  MAX_TEXT_BODY_LENGTH: 50000,
  MAX_HTML_BODY_LENGTH: 100000,
} as const;

/**
 * Email categories for Communication model
 */
export const EMAIL_CATEGORIES = {
  EXTRACTION: 'extraction',
  SUPPORT: 'support',
  USER_GENERATED: 'user-generated',
  SYSTEM: 'system',
} as const;

/**
 * Email directions for Communication model
 */
export const EMAIL_DIRECTIONS = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

/**
 * Email processing statuses
 */
export const EMAIL_STATUSES = {
  PENDING: 'pending',
  VALIDATED: 'validated',
  REJECTED: 'rejected',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

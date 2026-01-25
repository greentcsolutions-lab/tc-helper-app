/**
 * System-generated outbound emails
 * All use Resend templates
 */

export { sendWelcomeEmail } from './welcome';
export { sendRejectionEmail } from './rejection';
export { sendExtractionFailedEmail } from './extraction-failed';
export { sendExtractionSuccessEmail } from './extraction-success';

export type { SendWelcomeEmailParams } from './welcome';
export type { SendRejectionEmailParams } from './rejection';
export type { SendExtractionFailedEmailParams } from './extraction-failed';
export type { SendExtractionSuccessEmailParams, ExtractedData } from './extraction-success';

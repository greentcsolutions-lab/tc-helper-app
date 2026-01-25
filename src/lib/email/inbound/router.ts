/**
 * Inbound email router
 * Routes emails to the appropriate handler based on recipient address
 */

import { EMAIL_TO } from '../constants';
import type { InboundEmailPayload, InboundRouteType, EmailHandlerResult } from '../types';
import { handleExtractionEmail } from './extraction/handler';

/**
 * Determine route type from recipient address
 */
export function getRouteType(recipientEmail: string): InboundRouteType {
  switch (recipientEmail) {
    case EMAIL_TO.UPLOAD:
      return 'extraction';
    case EMAIL_TO.SUPPORT:
      return 'support';
    default:
      return 'unknown';
  }
}

/**
 * Route inbound email to the appropriate handler
 * @param payload - Validated inbound email payload
 * @returns Handler result
 */
export async function routeInboundEmail(
  payload: InboundEmailPayload
): Promise<EmailHandlerResult> {
  const routeType = getRouteType(payload.to);

  console.log(`[email-router] Routing email to: ${payload.to} (type: ${routeType})`);

  switch (routeType) {
    case 'extraction':
      return handleExtractionEmail(payload);

    case 'support':
      // TODO: Implement support handler in Phase 3
      console.warn('[email-router] Support route not yet implemented');
      return {
        success: false,
        message: 'Support emails are not yet supported. Please use the dashboard to contact support.',
      };

    case 'unknown':
    default:
      console.error(`[email-router] Unknown recipient: ${payload.to}`);
      return {
        success: false,
        message: `Unknown recipient address: ${payload.to}`,
      };
  }
}

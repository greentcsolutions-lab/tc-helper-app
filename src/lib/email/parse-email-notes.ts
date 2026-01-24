/**
 * Strip common email signatures from email body
 * @param body - Raw email body text
 * @returns Cleaned email body without signature
 */
export function stripEmailSignature(body: string): string {
  if (!body) return '';

  // Common signature markers (case-insensitive)
  const signatureMarkers = [
    /\n--\s*\n/i,                          // Standard email signature delimiter
    /\n_{3,}/i,                            // Underscores as delimiter
    /\nSent from /i,                       // "Sent from my iPhone/Android/etc"
    /\nGet Outlook for /i,                 // Outlook mobile signature
    /\nBest regards,?\s*\n/i,              // Common closing
    /\nBest,?\s*\n/i,                      // Common closing
    /\nRegards,?\s*\n/i,                   // Common closing
    /\nThanks,?\s*\n/i,                    // Common closing
    /\nThank you,?\s*\n/i,                 // Common closing
    /\nSincerely,?\s*\n/i,                 // Common closing
    /\nCheers,?\s*\n/i,                    // Common closing
    /\n-{2,}\s*Original Message\s*-{2,}/i, // Forwarded/replied message
    /\nOn .* wrote:/i,                     // Reply thread marker
  ];

  let cleanedBody = body;

  // Find the earliest signature marker
  let earliestIndex = cleanedBody.length;

  for (const marker of signatureMarkers) {
    const match = cleanedBody.match(marker);
    if (match?.index !== undefined && match.index < earliestIndex) {
      earliestIndex = match.index;
    }
  }

  // Cut off everything after the earliest marker
  if (earliestIndex < cleanedBody.length) {
    cleanedBody = cleanedBody.substring(0, earliestIndex);
  }

  return cleanedBody.trim();
}

/**
 * Extract contract notes from email body (to be sent to AI)
 * Removes signatures, excessive whitespace, and formats for AI processing
 * @param bodyText - Plain text email body
 * @param bodyHtml - HTML email body (optional)
 * @returns Cleaned notes ready for AI parsing
 */
export function extractContractNotes(bodyText?: string, bodyHtml?: string): string {
  // Prefer plain text over HTML for simplicity
  const rawBody = bodyText || bodyHtml || '';

  if (!rawBody || rawBody.trim().length === 0) {
    return '';
  }

  // Strip signature
  const withoutSignature = stripEmailSignature(rawBody);

  // Remove excessive whitespace and normalize line breaks
  const normalized = withoutSignature
    .replace(/\r\n/g, '\n')           // Normalize line endings
    .replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines
    .replace(/[ \t]+/g, ' ')          // Normalize spaces/tabs
    .trim();

  // Additional sanitization: remove HTML tags if HTML was used
  if (bodyHtml && !bodyText) {
    return normalized
      .replace(/<[^>]*>/g, '')        // Strip HTML tags
      .replace(/&nbsp;/g, ' ')        // Replace HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  return normalized;
}

/**
 * Format notes for AI prompt
 * @param notes - Cleaned email notes
 * @returns Formatted prompt fragment for AI
 */
export function formatNotesForAI(notes: string): string {
  if (!notes || notes.trim().length === 0) {
    return 'No additional notes provided in the email.';
  }

  return `
The user included the following notes in their email:

"""
${notes}
"""

Please extract any relevant contract information from these notes (e.g., special terms, contingencies, dates, amounts, etc.) and incorporate them into the extraction.
`.trim();
}

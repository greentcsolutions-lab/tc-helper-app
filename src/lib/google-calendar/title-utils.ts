// src/lib/google-calendar/title-utils.ts
// Utilities for handling task title prefixes in Google Calendar sync

/**
 * Checks if a title has a prefix pattern (e.g., "[Property Address]", "[Task]")
 * Prefix pattern: starts with [ and contains ]
 */
export function hasPrefix(title: string): boolean {
  return /^\[.*?\]/.test(title);
}

/**
 * Adds a prefix to a title if it doesn't already have one
 * Used when syncing App → Google Calendar for display purposes
 *
 * @param title - The task title
 * @param prefix - The prefix to add (without brackets)
 * @returns Title with prefix
 */
export function addPrefix(title: string, prefix: string): string {
  if (hasPrefix(title)) {
    return title;
  }
  return `[${prefix}] ${title}`;
}

/**
 * Strips the prefix from a title if it has one
 * Used when syncing Google Calendar → App to store clean user input
 *
 * @param title - The title that may contain a prefix
 * @returns Title without prefix
 *
 * @example
 * stripPrefix("[123 Main St] Sign contract") // "Sign contract"
 * stripPrefix("[Task] Review docs") // "Review docs"
 * stripPrefix("No prefix here") // "No prefix here"
 */
export function stripPrefix(title: string): string {
  if (!hasPrefix(title)) {
    return title;
  }

  // Remove the prefix pattern [xxx] and any whitespace after it
  return title.replace(/^\[.*?\]\s*/, '').trim();
}

/**
 * Gets the prefix from a title if it has one
 *
 * @param title - The title that may contain a prefix
 * @returns The prefix content (without brackets) or null if no prefix
 *
 * @example
 * getPrefix("[123 Main St] Sign contract") // "123 Main St"
 * getPrefix("No prefix") // null
 */
export function getPrefix(title: string): string | null {
  const match = title.match(/^\[(.*?)\]/);
  return match ? match[1] : null;
}

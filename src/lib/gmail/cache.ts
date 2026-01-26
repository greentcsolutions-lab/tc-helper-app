// src/lib/gmail/cache.ts
// Encrypted localStorage cache for Gmail emails

import type { EmailThread } from './messages';

const CACHE_KEY_PREFIX = 'tc_gmail_cache_';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Simple XOR-based obfuscation for localStorage
 * Note: This is NOT cryptographically secure encryption,
 * but provides basic obfuscation for cached email data.
 * For production, consider using Web Crypto API or a proper encryption library.
 */
function obfuscate(data: string, key: string): string {
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(
      data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return btoa(result);
}

function deobfuscate(data: string, key: string): string {
  try {
    const decoded = atob(data);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
        decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return result;
  } catch {
    return '';
  }
}

/**
 * Get a unique cache key for a user's data
 */
function getCacheKey(userId: string, dataType: string): string {
  return `${CACHE_KEY_PREFIX}${userId}_${dataType}`;
}

/**
 * Get the obfuscation key (derived from userId)
 */
function getObfuscationKey(userId: string): string {
  // In production, this should be a more secure key derivation
  return `tc_helper_${userId}_cache_key`;
}

/**
 * Store threads in cache
 */
export function cacheThreads(
  userId: string,
  threads: EmailThread[],
  dateRange: { start: string; end: string }
): void {
  if (typeof window === 'undefined') return;

  const key = getCacheKey(userId, `threads_${dateRange.start}_${dateRange.end}`);
  const obfKey = getObfuscationKey(userId);

  const entry: CacheEntry<EmailThread[]> = {
    data: threads,
    timestamp: Date.now(),
    expiresAt: Date.now() + CACHE_TTL,
  };

  try {
    const serialized = JSON.stringify(entry);
    const obfuscated = obfuscate(serialized, obfKey);
    localStorage.setItem(key, obfuscated);
  } catch (error) {
    console.error('[Gmail Cache] Error storing threads:', error);
    // If storage is full, clear old caches
    clearExpiredCaches(userId);
  }
}

/**
 * Retrieve threads from cache
 */
export function getCachedThreads(
  userId: string,
  dateRange: { start: string; end: string }
): EmailThread[] | null {
  if (typeof window === 'undefined') return null;

  const key = getCacheKey(userId, `threads_${dateRange.start}_${dateRange.end}`);
  const obfKey = getObfuscationKey(userId);

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const deobfuscated = deobfuscate(stored, obfKey);
    if (!deobfuscated) return null;

    const entry: CacheEntry<EmailThread[]> = JSON.parse(deobfuscated);

    // Check if cache is expired
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error('[Gmail Cache] Error retrieving threads:', error);
    return null;
  }
}

/**
 * Check if cache is valid (not expired)
 */
export function isCacheValid(
  userId: string,
  dateRange: { start: string; end: string }
): boolean {
  if (typeof window === 'undefined') return false;

  const key = getCacheKey(userId, `threads_${dateRange.start}_${dateRange.end}`);
  const obfKey = getObfuscationKey(userId);

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return false;

    const deobfuscated = deobfuscate(stored, obfKey);
    if (!deobfuscated) return false;

    const entry: CacheEntry<unknown> = JSON.parse(deobfuscated);
    return Date.now() < entry.expiresAt;
  } catch {
    return false;
  }
}

/**
 * Get cache metadata (timestamp, expiration)
 */
export function getCacheMetadata(
  userId: string,
  dateRange: { start: string; end: string }
): { timestamp: number; expiresAt: number; isExpired: boolean } | null {
  if (typeof window === 'undefined') return null;

  const key = getCacheKey(userId, `threads_${dateRange.start}_${dateRange.end}`);
  const obfKey = getObfuscationKey(userId);

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const deobfuscated = deobfuscate(stored, obfKey);
    if (!deobfuscated) return null;

    const entry: CacheEntry<unknown> = JSON.parse(deobfuscated);
    return {
      timestamp: entry.timestamp,
      expiresAt: entry.expiresAt,
      isExpired: Date.now() > entry.expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Clear all caches for a user
 */
export function clearUserCache(userId: string): void {
  if (typeof window === 'undefined') return;

  const prefix = `${CACHE_KEY_PREFIX}${userId}_`;
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Clear expired caches for a user
 */
export function clearExpiredCaches(userId: string): void {
  if (typeof window === 'undefined') return;

  const prefix = `${CACHE_KEY_PREFIX}${userId}_`;
  const obfKey = getObfuscationKey(userId);
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const deobfuscated = deobfuscate(stored, obfKey);
          if (deobfuscated) {
            const entry: CacheEntry<unknown> = JSON.parse(deobfuscated);
            if (Date.now() > entry.expiresAt) {
              keysToRemove.push(key);
            }
          }
        }
      } catch {
        // If we can't parse it, it's probably corrupted
        keysToRemove.push(key);
      }
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Store drafts in cache
 */
export interface DraftEmail {
  id: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyText: string;
  bodyHtml: string;
  parseId?: string;
  threadId?: string;
  createdAt: number;
  updatedAt: number;
}

export function cacheDraft(userId: string, draft: DraftEmail): void {
  if (typeof window === 'undefined') return;

  const drafts = getCachedDrafts(userId);
  const existingIndex = drafts.findIndex((d) => d.id === draft.id);

  if (existingIndex >= 0) {
    drafts[existingIndex] = { ...draft, updatedAt: Date.now() };
  } else {
    drafts.push({ ...draft, createdAt: Date.now(), updatedAt: Date.now() });
  }

  const key = getCacheKey(userId, 'drafts');
  const obfKey = getObfuscationKey(userId);

  try {
    const serialized = JSON.stringify(drafts);
    const obfuscated = obfuscate(serialized, obfKey);
    localStorage.setItem(key, obfuscated);
  } catch (error) {
    console.error('[Gmail Cache] Error storing draft:', error);
  }
}

export function getCachedDrafts(userId: string): DraftEmail[] {
  if (typeof window === 'undefined') return [];

  const key = getCacheKey(userId, 'drafts');
  const obfKey = getObfuscationKey(userId);

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];

    const deobfuscated = deobfuscate(stored, obfKey);
    if (!deobfuscated) return [];

    return JSON.parse(deobfuscated) as DraftEmail[];
  } catch {
    return [];
  }
}

export function deleteDraft(userId: string, draftId: string): void {
  if (typeof window === 'undefined') return;

  const drafts = getCachedDrafts(userId);
  const filtered = drafts.filter((d) => d.id !== draftId);

  const key = getCacheKey(userId, 'drafts');
  const obfKey = getObfuscationKey(userId);

  try {
    const serialized = JSON.stringify(filtered);
    const obfuscated = obfuscate(serialized, obfKey);
    localStorage.setItem(key, obfuscated);
  } catch (error) {
    console.error('[Gmail Cache] Error deleting draft:', error);
  }
}

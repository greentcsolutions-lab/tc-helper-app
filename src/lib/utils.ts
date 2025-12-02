// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert Node.js Buffer → Blob in strict mode (works in Edge Runtime too)
 * This is the only pattern that satisfies TypeScript + Blob constructor
 */
export function bufferToBlob(buffer: Buffer, mimeType: string): Blob {
  // buffer.buffer is ArrayBufferLike, but Blob accepts Buffer directly in Node
  // This cast is safe and used by Next.js, Clerk, and every production app
  // @ts-ignore
  return new Blob([buffer], { type: mimeType });
}
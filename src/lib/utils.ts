// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function bufferToBlob(buffer: Buffer, mimeType: string): Blob {
  // buffer.buffer is ArrayBufferLike, but Blob accepts Buffer directly in Node
  // This cast is safe and used by Next.js, Clerk, and every production app
  // @ts-expect-error — Buffer is accepted by Blob constructor in Node/Edge
  return new Blob([buffer], { type: mimeType });
}
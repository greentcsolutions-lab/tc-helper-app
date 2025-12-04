// src/lib/progress.ts
// In-memory progress tracker — survives across requests, dies on cold start (fine for <60s jobs)
export const uploadProgress = new Map<
  string,
  { message: string; timestamp: number }[]
>();

// Auto-cleanup old entries
setInterval(() => {
  const cutoff = Date.now() - 120_000; // 2 minutes
  for (const [key, updates] of uploadProgress.entries()) {
    if (updates.length > 0 && updates[updates.length - 1].timestamp < cutoff) {
      uploadProgress.delete(key);
    }
  }
}, 30_000);
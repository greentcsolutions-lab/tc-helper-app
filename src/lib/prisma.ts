// src/lib/prisma.ts
// Updated 2026-01-08 – Optimized for Vercel Pro serverless + Prisma Accelerate
// Singleton pattern: Reuses PrismaClient across hot invocations → prevents connection leaks
// Extends with Accelerate for global pooling + caching (your dashboard shows it's already enabled)
// No multiple clients per function → stable on cold starts, fits <90s p95

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

// Reuse existing client if hot, otherwise create new and extend with Accelerate
export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn'] // Helpful locally on your Chromebook
        : ['error'], // Production: only errors to keep logs lean
  }).$extends(withAccelerate());

// Store in globalThis for dev hot-reload (Next.js/Turbopack clears module cache)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
// src/lib/prisma.ts
// Final 2026-01-08 version – Works with Prisma Accelerate (already enabled in your dashboard)
// Singleton + Accelerate extension → global pooling/caching, no connection exhaustion on Vercel Pro
// Fixes P1001 "Can't reach db.prisma.io" by routing through Accelerate (prisma:// URL)
// Keeps dev logging for your Chromebook setup

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error'] // Full logs locally
        : ['error'], // Production: minimal to avoid log noise
  }).$extends(withAccelerate());

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
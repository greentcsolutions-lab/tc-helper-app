// src/lib/prisma.ts
// 2026-01-08 – Serverless-safe singleton for Vercel Pro
// Works with direct or Accelerate (prisma:// URL auto-detects pooling/caching)
// Add @prisma/extension-accelerate via pnpm if you want explicit caching

import { PrismaClient } from '@prisma/client';
// Uncomment if you pnpm add @prisma/extension-accelerate
// import { withAccelerate } from '@prisma/extension-accelerate';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });
  // .$extends(withAccelerate()); // Uncomment after installing extension for explicit caching

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Singleton – prevents connection explosion in dev/Turbopack
export const db = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = db;

  db.$connect().catch(() => {}); // reconnnects if schema changed
}

/**
 * Strongly-typed, correctly-cased helpers
 * Use these everywhere – they match what Prisma actually generates
 */
export const prisma = {
  user: db.user,        // ← correct (generated name)
  userUsage: db.userUsage, // ← correct
  parse: db.parse,      // ← correct
} as const;
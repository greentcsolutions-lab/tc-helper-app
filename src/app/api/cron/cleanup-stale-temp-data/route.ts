// src/app/api/cron/cleanup-stale-temp-data/route.ts
// Version: 1.0.2 - 2025-12-29
// FIXED: Removed invalid 'not' operator for JSON fields
// Safety net: Cleans up any temporary data that wasn't cleared by the cleanup route

import { db } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET() {
  console.log('[cron:cleanup] Starting stale temp data cleanup...');

  // Delete temporary fields from records older than 2 hours
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const result = await db.parse.updateMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [
        { pdfBuffer: { not: null } },
        { lowResZipKey: { not: null } },
        { highResZipKey: { not: null } },
      ]
    },
    data: {
      pdfBuffer: null,
      classificationCache: Prisma.JsonNull,
      lowResZipUrl: null,
      lowResZipKey: null,
      highResZipUrl: null,
      highResZipKey: null,
      renderZipUrl: null,
      renderZipKey: null,
    }
  });

  console.log(`[cron:cleanup] Cleaned ${result.count} records`);

  return Response.json({ 
    success: true, 
    cleanedCount: result.count,
    cutoffTime: cutoff.toISOString()
  });
}
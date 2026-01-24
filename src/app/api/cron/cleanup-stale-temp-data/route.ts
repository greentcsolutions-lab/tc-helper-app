// src/app/api/cron/cleanup-stale-temp-data/route.ts
// Version: 2.0.0 - 2025-12-29
// ENHANCED: Now deletes failed extractions + cleans temp data
// Safety net: Cleans up any temporary data that wasn't cleared by the cleanup route

import { db } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { del } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  console.log('[cron:cleanup] Starting stale temp data cleanup...\n');

  const results = {
    failedDeleted: 0,
    tempDataCleared: 0,
    blobsDeleted: 0,
  };

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: DELETE FAILED EXTRACTIONS (older than 24 hours)
    // ═══════════════════════════════════════════════════════════════════════
    const failedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    console.log('[cron:cleanup] 🗑️ Deleting failed extractions...');

    // Find failed records with Blob keys (so we can delete those too)
    const failedWithBlobs = await db.parse.findMany({
      where: {
        createdAt: { lt: failedCutoff },
        status: {
          in: ['RENDER_FAILED', 'CLASSIFICATION_FAILED', 'EXTRACTION_FAILED']
        },
        OR: [
          { pdfPublicUrl: { not: null } },
          { lowResZipKey: { not: null } },
          { highResZipKey: { not: null } },
        ]
      },
      select: {
        id: true,
        pdfPublicUrl: true,
        lowResZipKey: true,
        highResZipKey: true,
      }
    });

    // Delete Blob files for failed records
    const blobDeletions = failedWithBlobs.flatMap(parse => {
      const tasks = [];
      if (parse.pdfPublicUrl) {
        // Extract key from public URL
        try {
          const url = new URL(parse.pdfPublicUrl);
          const key = url.pathname.slice(1); // remove leading slash
          tasks.push(
            del(key)
              .then(() => console.log(`[cron:cleanup]   ✓ Deleted PDF blob for ${parse.id}`))
              .catch(err => console.warn(`[cron:cleanup]   ⚠️ Failed to delete PDF blob:`, err))
          );
        } catch (err) {
          console.warn(`[cron:cleanup]   ⚠️ Failed to parse pdfPublicUrl for ${parse.id}:`, err);
        }
      }
      if (parse.lowResZipKey) {
        tasks.push(
          del(parse.lowResZipKey)
            .then(() => console.log(`[cron:cleanup]   ✓ Deleted low-res blob for ${parse.id}`))
            .catch(err => console.warn(`[cron:cleanup]   ⚠️ Failed to delete low-res blob:`, err))
        );
      }
      if (parse.highResZipKey) {
        tasks.push(
          del(parse.highResZipKey)
            .then(() => console.log(`[cron:cleanup]   ✓ Deleted high-res blob for ${parse.id}`))
            .catch(err => console.warn(`[cron:cleanup]   ⚠️ Failed to delete high-res blob:`, err))
        );
      }
      return tasks;
    });

    await Promise.allSettled(blobDeletions);
    results.blobsDeleted = blobDeletions.length;

    // Delete the failed records from DB
    const failedResult = await db.parse.deleteMany({
      where: {
        createdAt: { lt: failedCutoff },
        status: {
          in: ['RENDER_FAILED', 'CLASSIFICATION_FAILED', 'EXTRACTION_FAILED']
        }
      }
    });

    results.failedDeleted = failedResult.count;
    console.log(`[cron:cleanup] ✓ Deleted ${failedResult.count} failed extraction(s)\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: CLEAN TEMP DATA FROM OLD SUCCESSFUL RECORDS (older than 2 hours)
    // ═══════════════════════════════════════════════════════════════════════
    const tempDataCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);

    console.log('[cron:cleanup] 🧹 Cleaning temp data from old records...');

    // First, find and delete blob files for old records
    const oldRecordsWithBlobs = await db.parse.findMany({
      where: {
        createdAt: { lt: tempDataCutoff },
        OR: [
          { pdfPublicUrl: { not: null } },
          { lowResZipKey: { not: null } },
          { highResZipKey: { not: null } },
        ]
      },
      select: {
        id: true,
        pdfPublicUrl: true,
        lowResZipKey: true,
        highResZipKey: true,
      }
    });

    // Delete blobs from old records
    const oldBlobDeletions = oldRecordsWithBlobs.flatMap(parse => {
      const tasks = [];
      if (parse.pdfPublicUrl) {
        try {
          const url = new URL(parse.pdfPublicUrl);
          const key = url.pathname.slice(1);
          tasks.push(
            del(key)
              .then(() => console.log(`[cron:cleanup]   ✓ Deleted old PDF blob for ${parse.id}`))
              .catch(err => console.warn(`[cron:cleanup]   ⚠️ Failed to delete old PDF blob:`, err))
          );
        } catch (err) {
          console.warn(`[cron:cleanup]   ⚠️ Failed to parse pdfPublicUrl for ${parse.id}:`, err);
        }
      }
      if (parse.lowResZipKey) {
        tasks.push(
          del(parse.lowResZipKey)
            .then(() => console.log(`[cron:cleanup]   ✓ Deleted old low-res blob for ${parse.id}`))
            .catch(err => console.warn(`[cron:cleanup]   ⚠️ Failed to delete old low-res blob:`, err))
        );
      }
      if (parse.highResZipKey) {
        tasks.push(
          del(parse.highResZipKey)
            .then(() => console.log(`[cron:cleanup]   ✓ Deleted old high-res blob for ${parse.id}`))
            .catch(err => console.warn(`[cron:cleanup]   ⚠️ Failed to delete old high-res blob:`, err))
        );
      }
      return tasks;
    });

    await Promise.allSettled(oldBlobDeletions);
    results.blobsDeleted += oldBlobDeletions.length;

    // Now clear the database fields
    const tempDataResult = await db.parse.updateMany({
      where: {
        createdAt: { lt: tempDataCutoff },
        OR: [
          { pdfBuffer: { not: null } },
          { pdfPublicUrl: { not: null } },
          { lowResZipKey: { not: null } },
          { highResZipKey: { not: null } },
        ]
      },
      data: {
        pdfBuffer: null,
        pdfPublicUrl: null,
        classificationCache: Prisma.JsonNull,
        lowResZipUrl: null,
        lowResZipKey: null,
        highResZipUrl: null,
        highResZipKey: null,
        renderZipUrl: null,
        renderZipKey: null,
      }
    });

    results.tempDataCleared = tempDataResult.count;
    console.log(`[cron:cleanup] ✓ Cleaned temp data from ${tempDataResult.count} record(s)\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: SUMMARY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[cron:cleanup] ✅ Cleanup complete!');
    console.log(`[cron:cleanup]   Failed extractions deleted: ${results.failedDeleted}`);
    console.log(`[cron:cleanup]   Blob files deleted: ${results.blobsDeleted}`);
    console.log(`[cron:cleanup]   Records with temp data cleared: ${results.tempDataCleared}`);

    return Response.json({ 
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });

  } catch (error: any) {
    console.error('[cron:cleanup] ❌ Cleanup failed:', error);
    return Response.json(
      { 
        success: false, 
        error: error.message,
        ...results,
      },
      { status: 500 }
    );
  }
}
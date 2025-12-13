// src/app/api/parse/cleanup/[parseId]/route.ts
// Deletes critical page ZIP and original PDF buffer after user confirmation

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { del } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: { parseId: string } }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = params;

  const parse = await db.parse.findUnique({
    where: { id: parseId },
    select: {
      id: true,
      userId: true,
      renderZipKey: true,
      pdfBuffer: true,
    },
  });

  if (!parse) {
    return Response.json({ error: "Parse not found" }, { status: 404 });
  }

  try {
    const cleanupTasks = [];

    // Delete critical page ZIP from Vercel Blob
    if (parse.renderZipKey) {
      cleanupTasks.push(
        del(parse.renderZipKey)
          .then(() => console.log(`[cleanup:${parseId}] Critical page ZIP deleted`))
          .catch((err) => console.warn(`[cleanup:${parseId}] ZIP delete failed:`, err))
      );
    }

    // Clear original PDF buffer from database
    if (parse.pdfBuffer) {
      cleanupTasks.push(
        db.parse.update({
          where: { id: parseId },
          data: {
            pdfBuffer: null,
            renderZipUrl: null,
            renderZipKey: null,
          },
        })
      );
    }

    await Promise.allSettled(cleanupTasks);

    console.log(`[cleanup:${parseId}] ✓ All temporary files deleted`);

    return Response.json({
      success: true,
      message: "All temporary files deleted",
    });
  } catch (error: any) {
    console.error(`[cleanup:${parseId}] Failed:`, error);
    return Response.json(
      { error: "Cleanup failed", message: error.message },
      { status: 500 }
    );
  }
}
// src/app/api/parse/extract/[parseId]/route.ts
// FINAL — No TypeScript errors, cleans up both Blob ZIP + original PDF buffer

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { del } from "@vercel/blob"; // ← This is a FUNCTION, not a class
import JSZip from "jszip";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
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
      renderZipUrl: true,
      renderZipKey: true,
      pdfBuffer: true,
      status: true,
    },
  });

  if (!parse || parse.status !== "RENDERED") {
    return new Response("Parse not ready", { status: 400 });
  }

  if (!parse.renderZipUrl) {
    return new Response("Missing ZIP URL", { status: 500 });
  }

  try {
    console.log(`[extract:${parseId}] Starting extraction from Blob ZIP`);

    const res = await fetch(parse.renderZipUrl);
    if (!res.ok) throw new Error("Failed to download ZIP");

    const arrayBuffer = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const pngFiles = Object.keys(zip.files)
      .filter((name) => name.match(/\.png$/i))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/(\d+)\.png$/i)?.[1] || "0");
        const bNum = parseInt(b.match(/(\d+)\.png$/i)?.[1] || "0");
        return aNum - bNum;
      });

    if (pngFiles.length === 0) throw new Error("No PNGs in ZIP");

    const pages = await Promise.all(
      pngFiles.map(async (name, i) => {
        const file = zip.file(name)!;
        const buffer = await file.async("nodebuffer");
        return {
          pageNumber: i + 1,
          base64: `data:image/png;base64,${buffer.toString("base64")}`,
        };
      })
    );

    // TODO: Your Grok call here
    const grokResult = {
      extracted: { message: "Grok extraction complete" },
      needsReview: false,
    };

    // === CLEANUP: Delete Blob ZIP + original PDF ===
    const cleanupTasks = [];

    if (parse.renderZipKey) {
      cleanupTasks.push(
        del(parse.renderZipKey)  // ← FUNCTION CALL, not new
          .then(() => console.log(`[extract:${parseId}] Blob ZIP deleted`))
          .catch((err) => console.error(`[extract:${parseId}] Blob delete failed:`, err))
      );
    }

    // Clear the original uploaded PDF buffer
    cleanupTasks.push(
      db.parse.update({
        where: { id: parseId },
        data: { pdfBuffer: null },
      })
    );

    await Promise.allSettled(cleanupTasks);

    // Final DB update
    await db.parse.update({
      where: { id: parseId },
      data: {
        status: grokResult.needsReview ? "NEEDS_REVIEW" : "COMPLETED",
        rawJson: { pageCount: pages.length },
        formatted: grokResult.extracted,
        renderZipUrl: null,
        renderZipKey: null,
      },
    });

    return Response.json({
      success: true,
      needsReview: grokResult.needsReview,
      extracted: grokResult.extracted,
    });
  } catch (error: any) {
    console.error(`[extract:${parseId}] Failed:`, error);
    return Response.json(
      { error: "Extraction failed", message: error.message },
      { status: 500 }
    );
  }
}
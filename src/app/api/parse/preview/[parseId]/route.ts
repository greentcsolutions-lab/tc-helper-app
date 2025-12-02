// src/app/api/parse/preview/[parseId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@lib/prisma";
import { renderPdfToPngBase64Array } from "@/lib/extractor/renderer";

export async function GET(
  req: Request,
  { params }: { params: { parseId: string } }
) {
  const parse = await db.parse.findUnique({
    where: { id: params.parseId },
    select: { pdfBuffer: true, fileName: true },
  });

  if (!parse?.pdfBuffer) {
    return new NextResponse("Parse not found", { status: 404 });
  }

  const pages = await renderPdfToPngBase64Array(parse.pdfBuffer);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(JSON.stringify({
        fileName: parse.fileName,
        pageCount: pages.length,
      }) + "\n"));

      for (const page of pages) {
        controller.enqueue(encoder.encode(JSON.stringify(page) + "\n"));
      }

      controller.enqueue(encoder.encode("[DONE]"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

export const runtime = "edge";
export const maxDuration = 60;
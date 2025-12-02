// src/app/api/parse/finalize/[parseId]/route.ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

// Fixed for Next.js 15 — params is now a Promise
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { parseId } = await params;

  const parse = await db.parse.findUnique({
    where: { id: parseId, userId },
    select: {
      formatted: true,
      status: true,
      rawJson: true,
      createdAt: true,
      finalizedAt: true,
    },
  });

  if (!parse) {
    return new Response("Parse not found", { status: 404 });
  }

  return Response.json({
    success: true,
    data: parse,
  });
}
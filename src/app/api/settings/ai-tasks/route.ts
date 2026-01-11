// src/app/api/settings/ai-tasks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/settings/ai-tasks - Get AI tasks enabled status
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: { aiTasksEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ enabled: user.aiTasksEnabled ?? true });
  } catch (error) {
    console.error("Error fetching AI tasks status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/settings/ai-tasks - Toggle AI tasks on/off
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: { aiTasksEnabled: enabled },
    });

    return NextResponse.json({ enabled });
  } catch (error) {
    console.error("Error updating AI tasks setting:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

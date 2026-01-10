// src/app/api/settings/templates/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { PLAN_CONFIGS } from "@/lib/whop";

export const dynamic = "force-dynamic";

// GET /api/settings/templates - Fetch user templates
export async function GET() {
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

    const templates = await db.userTaskTemplate.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/settings/templates - Create new template
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        planType: true,
        templateCount: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check template limit
    const planConfig = PLAN_CONFIGS[user.planType as 'FREE' | 'BASIC'];
    if (user.templateCount >= planConfig.templateLimit) {
      return NextResponse.json(
        { error: `Template limit reached (${planConfig.templateLimit} templates)` },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, description, fileType, tasks } = body;

    // Validate input
    if (!name || !fileType || !tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: "Invalid template data" },
        { status: 400 }
      );
    }

    // Create template and increment count
    const [template] = await db.$transaction([
      db.userTaskTemplate.create({
        data: {
          userId: user.id,
          name,
          description: description || null,
          fileType,
          tasks,
        },
      }),
      db.user.update({
        where: { id: user.id },
        data: { templateCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

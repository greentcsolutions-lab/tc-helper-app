// src/app/api/settings/templates/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { PLAN_CONFIGS } from "@/lib/whop";
import { ensureAITasksTemplate } from "@/lib/tasks/ai-tasks-template";

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

    // Ensure AI Tasks template exists for this user
    await ensureAITasksTemplate(user.id);

    const templates = await db.userTaskTemplate.findMany({
      where: { userId: user.id },
      orderBy: [
        { isSystemTemplate: "desc" }, // System templates first
        { createdAt: "desc" },
      ],
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

    const body = await req.json();
    const { name, description, fileType, isDefaultForNewFiles, tasks, isSystemTemplate } = body;

    // Prevent manual creation of system templates
    if (isSystemTemplate) {
      return NextResponse.json(
        { error: "Cannot create system templates manually" },
        { status: 403 }
      );
    }

    // Check template limit (excluding system templates)
    const userTemplateCount = await db.userTaskTemplate.count({
      where: {
        userId: user.id,
        isSystemTemplate: false,
      },
    });

    const planConfig = PLAN_CONFIGS[user.planType as 'FREE' | 'BASIC'];
    if (userTemplateCount >= planConfig.templateLimit) {
      return NextResponse.json(
        { error: `Template limit reached (${planConfig.templateLimit} templates)` },
        { status: 403 }
      );
    }

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
          isDefaultForNewFiles: isDefaultForNewFiles || false,
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

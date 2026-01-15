// src/app/api/settings/ai-template/route.ts
// API endpoint for managing AI-generated task template

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { TASK_TYPES } from "@/types/task";

export const dynamic = "force-dynamic";

/**
 * Get the AI-generated task template for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = user.id;

    // Find the AI template for this user
    const template = await db.userTaskTemplate.findFirst({
      where: {
        userId,
        isAiGenerated: true,
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error fetching AI template:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI template" },
      { status: 500 }
    );
  }
}

/**
 * Create or update the AI-generated task template
 */
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = user.id;
    const body = await request.json();
    const { name, description, fileType, isDefaultForNewFiles, tasks } = body;

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: "At least one task is required" },
        { status: 400 }
      );
    }

    // Check if user already has an AI template
    const existingTemplate = await db.userTaskTemplate.findFirst({
      where: {
        userId,
        isAiGenerated: true,
      },
    });

    let template;
    if (existingTemplate) {
      // Update existing template
      template = await db.userTaskTemplate.update({
        where: { id: existingTemplate.id },
        data: {
          name,
          description: description || null,
          fileType: fileType || "escrow",
          isDefaultForNewFiles: isDefaultForNewFiles || false,
          tasks,
        },
      });
    } else {
      // Create new template
      template = await db.userTaskTemplate.create({
        data: {
          userId,
          name,
          description: description || null,
          fileType: fileType || "escrow",
          isDefaultForNewFiles: isDefaultForNewFiles || false,
          isAiGenerated: true,
          tasks,
        },
      });
    }

    return NextResponse.json({ template }, { status: existingTemplate ? 200 : 201 });
  } catch (error) {
    console.error("Error saving AI template:", error);
    return NextResponse.json(
      { error: "Failed to save AI template" },
      { status: 500 }
    );
  }
}

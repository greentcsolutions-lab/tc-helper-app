// src/app/api/settings/templates/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PATCH /api/settings/templates/[id] - Update template
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();
    const { name, description, fileType, isDefaultForNewFiles, tasks } = body;

    // Verify ownership
    const template = await db.userTaskTemplate.findFirst({
      where: { id, userId: user.id },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Validate input
    if (!name || !fileType || !tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: "Invalid template data" },
        { status: 400 }
      );
    }

    const updatedTemplate = await db.userTaskTemplate.update({
      where: { id },
      data: {
        name,
        description: description || null,
        fileType,
        isDefaultForNewFiles: isDefaultForNewFiles ?? false,
        tasks,
      },
    });

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/settings/templates/[id] - Delete template
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Verify ownership
    const template = await db.userTaskTemplate.findFirst({
      where: { id, userId: user.id },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Prevent deletion of system templates
    if (template.isSystemTemplate) {
      return NextResponse.json(
        { error: "Cannot delete system templates" },
        { status: 403 }
      );
    }

    // Delete template and decrement count
    await db.$transaction([
      db.userTaskTemplate.delete({
        where: { id },
      }),
      db.user.update({
        where: { id: user.id },
        data: { templateCount: { decrement: 1 } },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

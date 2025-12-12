// src/app/api/save-user-state/route.ts to save data to the DB
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // Clerk v6 → auth() is async
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { state, onboarded = true } = body;

    if (!state) {
      return NextResponse.json({ error: "State is required" }, { status: 400 });
    }

    // Upsert = create user row on first sign-in, update on onboarding
    const updatedUser = await db.user.upsert({
      where: { clerkId: userId },
      update: {
        state,
        onboarded,
      },
      create: {
        clerkId: userId,
        email: "", // Clerk will fill this later if you want
        state,
        onboarded,
        credits: 1, // your free parse
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        state: updatedUser.state,
        onboarded: updatedUser.onboarded,
        credits: updatedUser.credits,
      },
    });
  } catch (error: any) {
    console.error("Save user state error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save user state" },
      { status: 500 }
    );
  }
}

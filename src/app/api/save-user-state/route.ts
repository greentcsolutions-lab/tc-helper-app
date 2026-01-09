// src/app/api/save-user-state/route.ts
// Version: 2.0.0 - Fixed to save Clerk email to database
import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    // Clerk v6 → auth() is async
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, state, role, problems, referralSource, onboarded = true } = body;

    if (!state) {
      return NextResponse.json({ error: "State is required" }, { status: 400 });
    }

    // ✅ FIX: Fetch email from Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress || null;

    console.log(`[save-user-state] User ${userId} | Email: ${email || 'none'} | State: ${state}`);

    // Upsert = create user row on first sign-in, update on onboarding
    const updatedUser = await db.user.upsert({
      where: { clerkId: userId },
      update: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        state,
        ...(role !== undefined && { role }),
        ...(problems !== undefined && { problems }),
        ...(referralSource !== undefined && { referralSource }),
        onboarded,
        email, // ✅ Save email on every update too (in case it changes)
      },
      create: {
        clerkId: userId,
        email, // ✅ Save email from Clerk
        name: name || null,
        phone: phone || null,
        state,
        role: role || null,
        problems: problems || [],
        referralSource: referralSource || null,
        onboarded,
        credits: 1, // your free parse
      },
    });

    console.log(`[save-user-state] ✓ User ${updatedUser.id} saved with email ${updatedUser.email}`);

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
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

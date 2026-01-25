// src/app/api/settings/plan-info/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { PLAN_CONFIGS } from "@/lib/whop";

export const dynamic = "force-dynamic";

// GET /api/settings/plan-info - Fetch user plan information
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: {
        planType: true,
        templateCount: true,
        customTaskCount: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const planConfig = PLAN_CONFIGS[user.planType as 'FREE' | 'BASIC' | 'STANDARD'];

    return NextResponse.json({
      planType: user.planType,
      templateLimit: planConfig.templateLimit,
      templateCount: user.templateCount,
      customTaskLimit: planConfig.customTaskLimit,
      customTaskCount: user.customTaskCount,
    });
  } catch (error) {
    console.error("Error fetching plan info:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

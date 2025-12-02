// src/app/api/user/credits/route.ts
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { credits: true },
  });

  if (!user) return NextResponse.json({ credits: 0 });

  return NextResponse.json({ credits: user.credits });
}
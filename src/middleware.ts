// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
  "/privacy",
  "/onboarding(.*)",   // ← onboarding is public
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = auth();

  // 1. Logged-in users visiting home → go to dashboard
  if (userId && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 2. Protect all non-public routes
  if (!isPublicRoute(req)) {
    auth().protect(); // throws if not signed in

    // 3. If signed in BUT no record in your DB → force onboarding
    const user = await db.user.findUnique({
      where: { clerkId: userId! },
      select: { id: true },
    });

    if (!user && req.nextUrl.pathname !== "/onboarding") {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)", "/", "/(api|trpc)(.*)"],
};

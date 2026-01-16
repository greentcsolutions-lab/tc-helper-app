// src/middleware.ts
// Updated 2026-01-16 – Lightweight middleware with no DB calls
// Protects routes, redirects unauth to sign-in
// Onboarding checks moved to individual pages for performance

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
  "/privacy",
  "/plans",            // public pricing page
  "/onboarding(.*)",   // onboarding is public
  "/public",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = auth(); // Only use userId – reliable even on cold starts

  // 1. Logged-in users visiting home → go to dashboard
  if (userId && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 2. Protect all non-public routes
  if (!isPublicRoute(req)) {
    if (!userId) {
      // Not signed in – redirect to sign-in
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    // Note: Onboarding check removed from middleware for performance
    // Individual pages will handle onboarding redirect as needed
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and **ALL static files** (images, fonts, etc.) unless in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
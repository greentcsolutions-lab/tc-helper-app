// src/middleware.ts — FINAL FIXED VERSION (Dec 2025, Clerk + Vercel safe)
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/parse(.*)",      // upload, extract, preview, etc.
  "/api/webhooks(.*)",
  "/parses(.*)",          // your dev/testing route
  "/debug-preview(.*)",   // if you still use this
]);

export default clerkMiddleware((auth, req) => {
  const { userId, redirectToSignIn } = auth();

  // ——— AUTO-REDIRECT LOGGED-IN USERS FROM MARKETING / AUTH PAGES ———
  if (
    userId &&
    (req.nextUrl.pathname === "/" || req.nextUrl.pathname.startsWith("/sign-"))
  ) {
    return Response.redirect(new URL("/dashboard", req.url));
  }

  // ——— PROTECT ALL NON-PUBLIC ROUTES ———
  if (!isPublicRoute(req)) {
    // This is the ONLY safe way in 2025 — no await, no .protect(), no manual header touching
    return redirectToSignIn();
  }

  // Public route → allow through
  return;
}, {
  // Optional but recommended: explicitly list allowed origins for custom domains
  authorizedParties: [
    "https://tchelper.app",
    "https://www.tchelper.app",           // if you have www redirect
    "https://tchelper-qmdukq3mv-greentcsolutions-labs-projects.vercel.app",
    "http://localhost:3000",
  ],
});

export const config = {
  matcher: [
    /*
      Run middleware on:
      - All routes except static files, _next, and images
      - Explicitly include api & parses routes
    */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    "/",
    "/(api|parses|debug-preview)(.*)",
  ],
};
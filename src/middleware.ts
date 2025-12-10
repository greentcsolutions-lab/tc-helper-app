// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",                     // ← these are the only routes that need to be public
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",         
  "/_next(.*)",
  "/favicon.ico",
  "/privacy",
]);

export default clerkMiddleware((auth, req) => {
  // ←←← ONLY CHANGE: redirect logged-in users from home page → dashboard
  if (auth().userId && req.nextUrl.pathname === "/") {
    const dashboardUrl = new URL("/dashboard", req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Keep your existing protection logic exactly as-is
  if (!isPublicRoute(req)) {
    auth().protect(); // will redirect to hosted portal if not signed in
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
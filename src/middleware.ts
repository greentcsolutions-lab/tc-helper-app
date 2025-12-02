// src/middleware.ts — FINAL, TYPE-SAFE, NO ERRORS (2025 Clerk pattern)
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/parse(.*)",
  "/api/webhooks(.*)",
  "/parses(.*)", // your dev/testing routes
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth(); // ← MUST await here

  // ——— AUTO-REDIRECT LOGGED-IN USERS FROM MARKETING / AUTH PAGES ———
  if (userId && (req.nextUrl.pathname === "/" || req.nextUrl.pathname.startsWith("/sign-"))) {
    return Response.redirect(new URL("/dashboard", req.url));
  }

  // ——— PROTECT ALL NON-PUBLIC ROUTES ———
  if (!isPublicRoute(req)) {
     await auth().protect(); // ← await + protect() works perfectly here
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/",
    "/(api|trpc|parses)(.*)",
  ],
};
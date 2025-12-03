// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",                     // ← these are the only routes that need to be public
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",         // your upload/extract routes
  "/_next(.*)",
  "/favicon.ico",
]);

export default clerkMiddleware((auth, req) => {
  // This is the ONLY thing you need — everything else can be deleted
  if (!isPublicRoute(req)) {
    auth().protect(); // will redirect to hosted portal if not signed in
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
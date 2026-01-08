// src/app/layout.tsx
// Updated 2026-01-08 – RootLayout now safely handles Clerk user object race condition
// Fetches currentUser() once at root level (server component)
// Passes safe data down via context – all child pages/layouts can use it without crashing
// Eliminates need to call auth() or currentUser() in individual pages

import "./globals.css";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import TopLoader from "@/components/ui/TopLoader";

import ModernSidebar from "@/components/layout/ModernSidebar";
import ModernHeader from "@/components/layout/ModernHeader";

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { AuthContextProvider } from "@/contexts/AuthContext"; // We'll create this next

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "TC Helper App",
  description: "Real Estate Transaction Coordination — Powered by AI",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clerkUser = await currentUser(); // Safe – returns null if not signed in

  let credits = 0;
  let dbUserId: string | null = null;

  if (clerkUser) {
    const dbUser = await db.user.findUnique({
      where: { clerkId: clerkUser.id },
      select: { id: true, credits: true },
    });

    credits = dbUser?.credits ?? 0;
    dbUserId = dbUser?.id ?? null;
  }

  // Safe data to pass down – no full user object that can be undefined
  const authContextValue = {
    userId: clerkUser?.id ?? null,
    clerkUser: clerkUser, // Full user object available if loaded (null otherwise)
    credits,
    dbUserId,
  };

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.className} antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <TopLoader />

            <AuthContextProvider value={authContextValue}>
              {clerkUser ? (
                // Authenticated layout
                <div className="relative min-h-screen">
                  <ModernSidebar />
                  <div className="lg:pl-64 transition-all duration-300">
                    <ModernHeader credits={credits} />
                    <main className="min-h-[calc(100vh-4rem)]">
                      {children}
                    </main>
                  </div>
                </div>
              ) : (
                // Public layout
                <div className="min-h-screen">
                  <ModernHeader />
                  <main>{children}</main>
                </div>
              )}
            </AuthContextProvider>

            <Toaster
              position="top-right"
              richColors
              toastOptions={{
                style: {
                  background: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                },
              }}
            />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
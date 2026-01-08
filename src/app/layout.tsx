// src/app/layout.tsx
// Updated 2026-01-08 – Safe Clerk user handling in RootLayout
// Avoids accessing auth().user (can be undefined on cold starts)
// Uses currentUser() only for credits fetch (safe in server component)
// Public vs authenticated layout logic unchanged

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
  const user = await currentUser(); // Safe – returns null if not signed in
  let credits = 0;

  if (user) {
    const dbUser = await db.user.findUnique({
      where: { clerkId: user.id },
      select: { credits: true },
    });
    credits = dbUser?.credits ?? 0;
  }

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.className} antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <TopLoader />

            {user ? (
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
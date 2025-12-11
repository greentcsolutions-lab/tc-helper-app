// src/app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";
import ThemeToggle from "@/components/layout/ThemeToggle";
import CreditsBadge from "@/components/ui/CreditsBadge";

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "TC Pro",
  description: "Real Estate Transaction Coordination — Powered by AI",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
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
        <body className={`${inter.className} antialiased bg-gradient-to-b from-white via-gray-50/30 to-white`}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <div className="flex min-h-screen">
              {/* Sidebar — appears on all dashboard routes */}
              <AppSidebar />

              {/* Main content column */}
              <div className="flex-1 flex flex-col">
                {/* Global top bar — credits + theme toggle */}
                <div className="border-b border-white/20 bg-white/70 backdrop-blur-xl">
                  <div className="flex items-center justify-end gap-6 px-6 py-4">
                    {user && <CreditsBadge credits={credits} />}
                    <ThemeToggle />
                  </div>
                </div>

                {/* Main header with logo + auth */}
                <AppHeader />

                {/* Page content */}
                <main className="flex-1 px-6 py-10 lg:px-12 lg:py-14">
                  {children}
                </main>
              </div>
            </div>

            <Toaster
              position="top-center"
              richColors
              toastOptions={{
                style: {
                  background: "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                },
              }}
            />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
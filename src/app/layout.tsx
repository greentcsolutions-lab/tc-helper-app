// src/app/layout.tsx
// Keep your current version – remove the AuthContextProvider part entirely
// (delete the import and the <AuthContextProvider> wrapper)

import "./globals.css";
import { Inter } from "next/font/google";
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/nextjs"; // Add SignedIn/SignedOut if you want
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import TopLoader from "@/components/ui/TopLoader";

import ModernSidebar from "@/components/layout/ModernSidebar";
import ModernHeader from "@/components/layout/ModernHeader";
import ProgressiveOnboardingModal from "@/components/ProgressiveOnboardingModal";

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
        <body className={`${inter.className} antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <TopLoader />
            <ProgressiveOnboardingModal />

            {user ? (
              <div className="relative min-h-screen">
                <ModernSidebar />
                <div className="lg:pl-64 transition-all duration-300">
                  <ModernHeader credits={credits} />
                  <main className="min-h-[calc(100vh-4rem)]">{children}</main>
                </div>
              </div>
            ) : (
              <div className="min-h-screen">
                <ModernHeader />
                <main>{children}</main>
              </div>
            )}

            <Toaster position="top-right" richColors toastOptions={{ style: { background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" } }} />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
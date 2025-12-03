// src/app/layout.tsx — Add signOutForceRedirectUrl to ClerkProvider
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ui/ThemeToggle";

// Self-hosted Inter — zero network calls, works everywhere
const inter = localFont({
  src: [
    {
      path: "../../public/fonts/InterVariable.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../public/fonts/InterVariable-Italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "TC Helper – AI California RPA Extractor",
  description: "Instantly turn any California real estate packet into perfectly structured RPA data using Grok 4 Vision.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"  // ← NEW: Global post-logout redirect (replaces deprecated prop)
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={cn(
            inter.variable,
            "min-h-screen bg-background font-sans antialiased"
          )}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors closeButton />
            <ThemeToggle />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
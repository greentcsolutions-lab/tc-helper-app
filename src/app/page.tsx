// src/app/page.tsx — Hosted Clerk Portal (no local auth pages)
"use client";

import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import UploadZone from "@/components/upload-zone";
import { Toaster } from "@/components/ui/sonner";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">TC Helper</h1>

          <div className="flex items-center gap-4">
            <SignedOut>
              <SignInButton mode="redirect">
                <button className="px-4 py-2 text-sm font-medium text-foreground hover:underline">
                  Sign In
                </button>
              </SignInButton>

              <SignUpButton mode="redirect">
                <button className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium">
                  Get Started Free
                </button>
              </SignUpButton>
            </SignedOut>

            <SignedIn>
              <UploadZone />
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 container mx-auto px-4 py-24 text-center max-w-5xl">
        <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          The Fastest Real Estate Contract Extractor on Earth
        </h2>
        <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
          Powered by Grok 4 Vision. Turn any scanned or digital California packet into perfectly structured RPA data in seconds.
        </p>

        <SignedOut>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <SignUpButton mode="redirect">
              <button className="px-8 py-4 text-lg font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 shadow-lg">
                Start Free → 1 Credit Included
              </button>
            </SignUpButton>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="mt-12">
            <p className="text-lg text-muted-foreground mb-6">
              Welcome back! Drop your next California packet below.
            </p>
            <UploadZone />
          </div>
        </SignedIn>
      </main>

      {/* Toaster for upload feedback */}
      <Toaster richColors closeButton />
    </div>
  );
}
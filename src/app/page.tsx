// src/app/page.tsx
import AppHeader from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Sparkles } from "lucide-react";
import { SignUpButton, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <AppHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
            The Fastest Real Estate Contract Extractor on Earth
          </h1>
          <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            Powered by Grok 4. Turn any scanned or digital California packet into perfectly formatted data in seconds.
          </p>

          <SignedOut>
            <SignUpButton mode="redirect">
              <Button size="lg" className="h-12 px-8 text-lg font-medium">
                Start Free — 1 Credit Included
              </Button>
            </SignUpButton>
          </SignedOut>
        </section>

        {/* Features */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Why TCs Love TC Pro
            </h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                "99.9%+ accuracy on all RPA fields",
                "Handles handwriting, counters, addenda",
                "Detects missing seller counters",
                "Human review in <15 seconds when needed",
                "Secure — docs deleted in minutes",
                "Built by TCs, for TCs",
              ].map((feature) => (
                <Card key={feature} className="p-8 text-center bg-white/70 backdrop-blur">
                  <CheckCircle2 className="h-12 w-12 text-cyan-500 mx-auto mb-4" />
                  <p className="text-lg font-medium">{feature}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t py-12 mt-24">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>© 2025 TC Pro. All rights reserved.</p>
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground mt-2 inline-block">
              Privacy Policy & California Rights
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
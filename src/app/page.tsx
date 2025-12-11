// src/app/page.tsx
import AppHeader from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { SignUpButton, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <AppHeader />

      <main className="min-h-screen bg-gradient-to-b from-white via-gray-50/50 to-white">
        {/* Hero */}
        <section className="pt-32 pb-24 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
              <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                The Fastest Real Estate
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Contract Extractor on Earth
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
              Powered by Grok 4. Turn any scanned or digital California packet into perfectly formatted data in seconds.
            </p>

            <SignedOut>
              <SignUpButton mode="redirect">
                <Button size="lg" className="h-14 px-10 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow">
                  Start Free — 1 Credit Included
                </Button>
              </SignUpButton>
            </SignedOut>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 px-4 bg-white/70">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
              Why TCs Love TC Pro
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                "99.9%+ accuracy on all RPA fields",
                "Handles handwriting, counters, addenda",
                "Detects missing seller counters",
                "Human review in <15 seconds when needed",
                "Secure — docs deleted in minutes",
                "Built by TCs, for TCs",
              ].map((feature, i) => (
                <Card
                  key={i}
                  className="p-10 text-center border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </div>
                  <p className="text-lg font-medium text-foreground">{feature}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-16 border-t bg-white/50">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>© 2025 TC Pro. All rights reserved.</p>
            <Link
              href="/privacy"
              className="mt-3 inline-block underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Privacy Policy & California Rights
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
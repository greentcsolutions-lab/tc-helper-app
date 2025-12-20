// src/app/page.tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Sparkles, Zap, Shield, Clock, Users, Award } from "lucide-react";
import { SignUpButton, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      {/* Hero */}
      <section className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Sparkles className="h-4 w-4" />
            Powered by Grok AI
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              Real Estate Contracts,
            </span>
            <br />
            <span className="text-foreground">Extracted in Seconds</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            California RPA extraction powered by next-gen AI vision. 95% accuracy, <u>zero</u> manual typing.
          </p>

          <SignedOut>
            <SignUpButton mode="modal">
              <Button size="lg" className="h-14 px-10 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all">
                <Sparkles className="mr-2 h-5 w-5" />
                Start Free — 1 Credit Included
              </Button>
            </SignUpButton>
            <p className="text-sm text-muted-foreground mt-4">No credit card required</p>
          </SignedOut>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why Transaction Coordinators Choose Us
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Extract complete RPA data in under 60 seconds",
              },
              {
                icon: Shield,
                title: "Bank-Level Security",
                description: "Docs auto-deleted within minutes. Zero retention.",
              },
              {
                icon: CheckCircle2,
                title: "95% Accuracy",
                description: "Handles handwriting, counters, and complex addenda",
              },
              {
                icon: Clock,
                title: "Save 20+ Minutes",
                description: "Per transaction. Focus on clients, not data entry.",
              },
              {
                icon: Users,
                title: "Built by TCs",
                description: "We know exactly what fields you need",
              },
              {
                icon: Award,
                title: "California Certified",
                description: "Optimized for CAR forms and CA real estate",
              },
            ].map((feature, i) => (
              <Card
                key={i}
                className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0 bg-card/50 backdrop-blur"
              >
                <div className="w-12 h-12 mb-4 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-primary/10 via-purple-500/10 to-cyan-500/10 rounded-3xl p-12 border">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to 10x Your Workflow?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join the movement of TCs already saving 20+ hours per month
          </p>
          <SignedOut>
            <SignUpButton mode="modal">
              <Button size="lg" className="h-14 px-10 text-lg shadow-xl">
                Get Started Free
              </Button>
            </SignUpButton>
          </SignedOut>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            © 2025 TC Helper App. Built with ❤️ in Missouri.
          </p>
          <Link
            href="/privacy"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
          >
            Privacy Policy & California Rights (CCPA/CPRA)
          </Link>
        </div>
      </footer>
    </main>
  );
}

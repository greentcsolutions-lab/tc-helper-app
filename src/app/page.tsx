// src/app/page.tsx

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Zap,
  Shield,
  Clock,
  Award,
  Heart,
  Upload,
  Brain,
  CheckSquare,
  Rocket,
  Calendar,
  LayoutTemplate,
  ArrowRight,
  Users,
  MessageSquare,
  Check
} from "lucide-react";
import { SignUpButton, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      {/* Hero */}
      <section className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Sparkles className="h-4 w-4" />
            AI-Powered Extraction
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              Stop Typing Your Contracts.
            </span>
            <br />
            <span className="text-foreground">Start Managing Them.</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Upload any real estate contract. Our AI extracts every date, contact, and contingency in 60 seconds. You just execute.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <SignedOut>
              <SignUpButton mode="modal">
                <Button size="lg" className="h-14 px-10 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Extract Your First Contract Free
                </Button>
              </SignUpButton>
            </SignedOut>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg" asChild>
              <a href="#how-it-works">
                See the Extraction
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>

          {/* Side-by-Side Comparison */}
          <div className="relative max-w-5xl mx-auto mt-12 rounded-2xl overflow-hidden border shadow-2xl bg-card">
            <div className="grid md:grid-cols-2 gap-0">
              <div className="p-4 bg-muted/50 border-r">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-4 text-left">The Messy PDF</p>
                <div className="relative w-full">
                  <Image 
                    src="/Messy Contract Extraction.png" 
                    alt="Messy Real Estate Contract Extraction" 
                    width={1920}
                    height={1080}
                    priority
                    className="rounded-lg opacity-80 grayscale-[30%] w-full h-auto"
                  />
                </div>
              </div>
              <div className="p-4 bg-background relative flex flex-col justify-center">
                <div className="absolute inset-0 bg-blue-500/5 animate-pulse pointer-events-none" />
                <p className="text-xs font-bold text-blue-600 uppercase mb-4 flex items-center gap-1 text-left">
                  <Brain className="h-3 w-3" /> TCHelper AI Output
                </p>
                <div className="space-y-4">
                  <div className="h-8 bg-muted rounded animate-pulse w-3/4" />
                  <div className="h-8 bg-muted rounded animate-pulse w-full" />
                  <div className="h-32 border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center text-blue-500 text-sm font-medium italic bg-blue-50/30">
                    Extracting Dates, Parties, and Contingencies...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Drowning in Data Entry?
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Stop squinting at blurry PDFs and manual counting dates. Missing a contingency shouldn't be the cost of doing business.
            <span className="block mt-4 font-medium text-foreground">
              TCHelper automates the boring stuff so you can handle more files with less stress.
            </span>
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Your New 60-Second Workflow
            </h2>
            <p className="text-xl text-muted-foreground">
              From PDF to a perfect timeline in four simple steps
            </p>
          </div>

          <div className="mb-20 max-w-5xl mx-auto rounded-xl border shadow-2xl overflow-hidden bg-white">
            <Image 
              src="/TC Helper Transactions Page.png" 
              alt="TC Helper Dashboard" 
              width={1920}
              height={1080}
              className="w-full h-auto"
            />
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "01",
                icon: Upload,
                title: "Drop Your PDF",
                description: "Drag in any contract or complex addenda. Even the handwritten ones.",
                color: "from-cyan-500 to-cyan-600"
              },
              {
                step: "02",
                icon: Brain,
                title: "AI Scans & Extracts",
                description: "Our engine identifies EMD, Inspection dates, and 20+ other data points.",
                color: "from-blue-500 to-blue-600"
              },
              {
                step: "03",
                icon: Calendar,
                title: "Timeline Built",
                description: "A color-coded, sortable timeline is generated based on contract dates.",
                color: "from-purple-500 to-purple-600"
              },
              {
                step: "04",
                icon: Rocket,
                title: "Review & Ship",
                description: "Add custom tasks, verify the data, and start your transaction with confidence.",
                color: "from-pink-500 to-pink-600"
              }
            ].map((item, i) => (
              <div key={i} className="relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-muted-foreground/20 to-transparent" />
                )}
                <Card className="p-6 text-center relative z-10 hover:shadow-lg transition-all duration-300 border-0 bg-card/50 backdrop-blur">
                  <div className="text-5xl font-bold text-muted-foreground/10 mb-2">{item.step}</div>
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                    <item.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Feature Showcase */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need for Workflow Clarity
            </h2>
            <p className="text-xl text-muted-foreground">
              AI extraction is just the beginning
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* AI Extraction */}
            <Card className="p-8 border-0 bg-card/50 backdrop-blur hover:shadow-xl transition-all duration-300">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
                  <Brain className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">AI Extraction</h3>
                  <p className="text-muted-foreground">The hook that starts it all</p>
                </div>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-cyan-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Handles PDFs up to 100 pages — perfect for real-world contracts</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-cyan-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">95% accuracy on handwriting, counters, and complex addenda</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-cyan-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Extracts 20+ data points automatically in 30 seconds</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-cyan-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Save 20+ minutes per transaction on data entry</span>
                </li>
              </ul>
            </Card>

            {/* Smart Task Management */}
            <Card className="p-8 border-0 bg-card/50 backdrop-blur hover:shadow-xl transition-all duration-300">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                  <CheckSquare className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Smart Task Management</h3>
                  <p className="text-muted-foreground">The power of customization</p>
                </div>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">AI generates your entire workflow from contract dates</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Drag-and-drop kanban + sortable table views</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Create custom tasks and reusable templates</span>
                </li>
              </ul>
            </Card>

            {/* Visual Timeline */}
            <Card className="p-8 border-0 bg-card/50 backdrop-blur hover:shadow-xl transition-all duration-300">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shrink-0">
                  <Calendar className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Visual Timeline</h3>
                  <p className="text-muted-foreground">The clarity you deserve</p>
                </div>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">See your entire pipeline at a glance</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Color-coded deadlines, deposits, and contingencies</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Spot overdue items instantly with smart alerts</span>
                </li>
              </ul>
            </Card>

            {/* Workflow Templates */}
            <Card className="p-8 border-0 bg-card/50 backdrop-blur hover:shadow-xl transition-all duration-300">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shrink-0">
                  <LayoutTemplate className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Workflow Templates</h3>
                  <p className="text-muted-foreground">The efficiency multiplier</p>
                </div>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Build once, reuse forever for your workflow</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Auto-apply task sets to new transactions</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Customize for different transaction types</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Why Choose TC Helper */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose TC Helper
            </h2>
            <p className="text-xl text-muted-foreground">
              Built different from the ground up
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Brain,
                title: "AI-First",
                description: "While others bolt on AI, we built from the ground up for automation"
              },
              {
                icon: CheckSquare,
                title: "Customizable",
                description: "Your workflow, your way — not rigid checklists"
              },
              {
                icon: Users,
                title: "Built by the Pros",
                description: "Designed by coordinators for coordinators + their agents"
              },
              {
                icon: Shield,
                title: "Bank-Level Security",
                description: "Your data is protected with enterprise-grade encryption"
              }
            ].map((item, i) => (
              <Card key={i} className="p-6 text-center hover:shadow-lg transition-all duration-300 border-0 bg-card/50 backdrop-blur">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-muted-foreground">
              Start free, scale when you're ready
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Plan */}
            <Card className="p-8 border-2 hover:shadow-xl transition-all duration-300">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Free</h3>
                <div className="text-4xl font-bold mb-2">$0</div>
                <p className="text-muted-foreground">Try it now, no credit card required</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span>1 AI parse (lifetime, no reset)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span>1 concurrent transaction</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span>10 custom tasks</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span>1 task template</span>
                </li>
              </ul>
              <SignedOut>
                <SignUpButton mode="modal">
                  <Button variant="outline" className="w-full h-12 text-base">
                    Start Free
                  </Button>
                </SignUpButton>
              </SignedOut>
            </Card>

            {/* Basic Plan */}
            <Card className="p-8 border-2 border-primary hover:shadow-xl transition-all duration-300 relative">
              <Badge className="absolute -top-3 right-8 bg-gradient-to-r from-cyan-600 to-blue-600">
                Most Popular
              </Badge>
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Basic</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold">$15</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-muted-foreground">or $150/year (save $30)</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span><strong>5 AI parses per month</strong> (resets monthly)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span>5 concurrent transactions</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span>100 custom tasks</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span>10 task templates</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span>Priority support</span>
                </li>
              </ul>
              <SignedOut>
                <SignUpButton mode="modal">
                  <Button className="w-full h-12 text-base">
                    Get Started
                  </Button>
                </SignUpButton>
              </SignedOut>
            </Card>
          </div>

          <p className="text-center text-muted-foreground mt-8">
            <Link href="/plans" className="underline underline-offset-4 hover:text-foreground transition-colors">
              View full pricing details
            </Link>
          </p>
        </div>
      </section>

      {/* Coming Soon Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 text-base px-4 py-2">
              Coming Soon
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              What's Next
            </h2>
            <p className="text-xl text-muted-foreground">
              We're just getting started
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: "Teams & Collaboration",
                description: "Invite team members, assign tasks, and work together seamlessly",
                status: "Infrastructure ready"
              },
              {
                icon: Calendar,
                title: "Google Calendar Sync",
                description: "Bidirectional sync with your Google Calendar for unified scheduling",
                status: "Built, launching soon"
              },
              {
                icon: MessageSquare,
                title: "Communication Hub",
                description: "Keep all transaction communications in one organized place",
                status: "In development"
              }
            ].map((item, i) => (
              <Card key={i} className="p-6 hover:shadow-lg transition-all duration-300 border-0 bg-card/50 backdrop-blur">
                <div className="w-12 h-12 mb-4 rounded-xl bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/10 flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm mb-3">{item.description}</p>
                <Badge variant="secondary" className="text-xs">
                  {item.status}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                95%
              </div>
              <p className="text-muted-foreground">Extraction Accuracy</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                20+ Min
              </div>
              <p className="text-muted-foreground">Saved Per Transaction</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                10+ Years
              </div>
              <p className="text-muted-foreground">Real Estate Expertise</p>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap justify-center items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Bank-Level Security</span>
            </div>
            <div className="hidden sm:block">•</div>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              <span>Designed by Coordinators for Coordinators + Their Agents</span>
            </div>
            <div className="hidden sm:block">•</div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>Over a Decade of Real Estate Expertise</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <Card className="p-12 text-center bg-gradient-to-br from-primary/10 via-purple-500/10 to-cyan-500/10 border-2 hover:shadow-2xl transition-all duration-300">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to Bring Clarity to Your Workflows?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join real estate professionals who are saving hours every week with AI-powered workflow management
            </p>
            <SignedOut>
              <SignUpButton mode="modal">
                <Button size="lg" className="h-16 px-12 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all">
                  <Sparkles className="mr-2 h-6 w-6" />
                  Start Free — No Credit Card Required
                </Button>
              </SignUpButton>
            </SignedOut>
            <p className="text-sm text-muted-foreground mt-6">
              1 free credit included • Set up in under 2 minutes
            </p>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground mb-3 flex items-center justify-center gap-1">
            © 2025 TC Helper App. Built with <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" /> in Missouri.
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

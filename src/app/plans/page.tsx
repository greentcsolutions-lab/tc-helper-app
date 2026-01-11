// src/app/plans/page.tsx

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Sparkles,
  Users,
  MessageSquare,
  Calendar,
  Home,
  BarChart3,
  Heart
} from "lucide-react";
import { SignUpButton, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

export default function PlansPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      {/* Header */}
      <section className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Sparkles className="h-4 w-4" />
            Simple, Transparent Pricing
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              Choose Your Plan
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Start free, scale as you grow. No credit card required to get started.
          </p>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8 mb-12">
            {/* FREE PLAN */}
            <Card className="p-8 border-2 hover:shadow-xl transition-all duration-300 relative">
              <Badge variant="outline" className="absolute -top-3 left-8">
                Available Now
              </Badge>
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
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span>Access to all core features</span>
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

            {/* BASIC PLAN */}
            <Card className="p-8 border-2 border-primary hover:shadow-xl transition-all duration-300 relative scale-105 lg:scale-110 z-10">
              <Badge className="absolute -top-3 right-8 bg-gradient-to-r from-cyan-600 to-blue-600">
                Most Popular
              </Badge>
              <Badge variant="outline" className="absolute -top-3 left-8">
                Available Now
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
                  <span>All core features included</span>
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

            {/* STANDARD PLAN */}
            <Card className="p-8 border-2 border-dashed border-muted-foreground/30 hover:shadow-xl transition-all duration-300 relative opacity-90">
              <Badge variant="secondary" className="absolute -top-3 right-8">
                Coming Soon
              </Badge>
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Standard</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold text-muted-foreground">—</span>
                </div>
                <p className="text-muted-foreground">Pricing to be announced</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span><strong>Higher usage limits</strong> on all features</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span>More AI parses per month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span>Increased transactions & tasks</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span>Unlimited task templates</span>
                </li>
                <li className="flex items-start gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span><strong>Communications Center unlocked</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <Calendar className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span><strong>Google Calendar integration</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <Home className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span><strong>Listing workflows</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span>Priority support</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full h-12 text-base" disabled>
                Coming Soon
              </Button>
            </Card>
          </div>

          {/* Second Row: Pro & Teams */}
          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* PRO PLAN */}
            <Card className="p-8 border-2 border-dashed border-muted-foreground/30 hover:shadow-xl transition-all duration-300 relative opacity-90">
              <Badge variant="secondary" className="absolute -top-3 right-8">
                Coming Soon
              </Badge>
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Pro</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold text-muted-foreground">—</span>
                </div>
                <p className="text-muted-foreground">Pricing to be announced</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Highest usage limits</strong> for power users</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <span>Maximum AI parses per month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <span>Unlimited transactions & tasks</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <span>Unlimited task templates</span>
                </li>
                <li className="flex items-start gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Advanced Communications unlocked</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <Calendar className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Advanced calendar features</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <Home className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Listing workflows</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Analytics dashboards & reporting</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <span>Dedicated priority support</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full h-12 text-base" disabled>
                Coming Soon
              </Button>
            </Card>

            {/* TEAMS PLAN */}
            <Card className="p-8 border-2 border-dashed border-muted-foreground/30 hover:shadow-xl transition-all duration-300 relative opacity-90">
              <Badge variant="secondary" className="absolute -top-3 right-8">
                Coming Soon
              </Badge>
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  Teams
                  <Users className="h-6 w-6 text-pink-600" />
                </h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold text-muted-foreground">—</span>
                </div>
                <p className="text-muted-foreground">Pricing to be announced</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <Users className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span><strong>3 team members</strong> to start</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span><strong>Up to 5 members</strong> at +$20/seat</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span>Shared workspace & quotas</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span>Team task assignment</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span>Role-based permissions</span>
                </li>
                <li className="flex items-start gap-2">
                  <MessageSquare className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span>Team Communications Center</span>
                </li>
                <li className="flex items-start gap-2">
                  <Calendar className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span><strong>Most advanced calendar features</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <Home className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span><strong>Listing workflows</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <BarChart3 className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span><strong>Analytics dashboards & reporting</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span>Team analytics & insights</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                  <span>Priority team support</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full h-12 text-base" disabled>
                Coming Soon
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature Comparison Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            What's Included in Every Plan
          </h2>
          <p className="text-xl text-muted-foreground text-center mb-12">
            All plans include these core features
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              "AI-powered contract extraction",
              "95% accuracy on handwriting",
              "Up to 100-page PDF support",
              "Smart task management",
              "Drag-and-drop kanban board",
              "Interactive calendar timeline",
              "Task templates",
              "Manual transaction creation",
              "Archive system",
              "Mobile-optimized interface",
              "Bank-level security",
              "Regular feature updates"
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Development Roadmap */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-6 text-base px-4 py-2">
            Our Roadmap
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Building the Future of Transaction Coordination
          </h2>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            We're actively developing Standard, Pro, and Teams plans with enhanced capabilities.
            Our focus is on higher usage limits, advanced communications features, and seamless team collaboration.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Badge variant="secondary" className="text-base px-4 py-2">
              <MessageSquare className="h-4 w-4 mr-2" />
              Communications Center
            </Badge>
            <Badge variant="secondary" className="text-base px-4 py-2">
              <Users className="h-4 w-4 mr-2" />
              Team Collaboration
            </Badge>
            <Badge variant="secondary" className="text-base px-4 py-2">
              <Calendar className="h-4 w-4 mr-2" />
              Google Calendar
            </Badge>
            <Badge variant="secondary" className="text-base px-4 py-2">
              <Home className="h-4 w-4 mr-2" />
              Listing Workflows
            </Badge>
            <Badge variant="secondary" className="text-base px-4 py-2">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics & Reporting
            </Badge>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-2">Can I switch plans later?</h3>
              <p className="text-muted-foreground">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-2">What happens to my data if I downgrade?</h3>
              <p className="text-muted-foreground">
                Your existing data remains safe. If you exceed the limits of your new plan, you'll need to archive some transactions or upgrade again to access them.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-2">Do AI parses roll over to the next month?</h3>
              <p className="text-muted-foreground">
                No, monthly AI parses reset at the start of each billing cycle. However, you can purchase additional credit packs that never expire.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-2">When will Standard, Pro, and Teams plans be available?</h3>
              <p className="text-muted-foreground">
                We're actively developing these plans and will announce availability soon. Sign up for our free plan to stay updated on new releases.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-2">Can I try the Basic plan before committing?</h3>
              <p className="text-muted-foreground">
                Absolutely! Start with our Free plan to test the platform with 1 AI parse. When you're ready, upgrade to Basic for full access.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="p-12 text-center bg-gradient-to-br from-primary/10 via-purple-500/10 to-cyan-500/10 border-2">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Start with our free plan and upgrade when you're ready
            </p>
            <SignedOut>
              <SignUpButton mode="modal">
                <Button size="lg" className="h-14 px-10 text-lg font-semibold">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Start Free Today
                </Button>
              </SignUpButton>
            </SignedOut>
            <p className="text-sm text-muted-foreground mt-4">
              No credit card required • 1 free credit included
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
          <div className="flex gap-6 justify-center text-sm">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
              Home
            </Link>
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

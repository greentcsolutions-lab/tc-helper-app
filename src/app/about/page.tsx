// src/app/about/page.tsx

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Heart,
  Zap,
  Code,
  Users,
  Clock,
  FileText,
  Brain,
  Check,
} from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      {/* Hero */}
      <section className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Heart className="h-4 w-4" />
            Built because I was tired of the alternatives
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              Hey, I'm Chris Green
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Been in real estate since 2012. Started when I was 17. Built TC Helper because the tools I was using were either too expensive or too painful to use every day.
          </p>
        </div>
      </section>

      {/* My Story */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">
                How this actually started
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                I got into real estate at 17. Paperwork has been part of my life ever since. Over the years I tried pretty much every transaction management tool out there.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Two things drove me crazy: 1) Copy-paste was basically impossible on most of them — you'd click and drag and hope for the best. 2) The prices were ridiculous for what you actually got.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Eventually I just thought: I have a laptop. I know how to code. Why am I paying hundreds a month for something I could build better myself?
              </p>
            </div>

            <Card className="p-8 border-2 bg-gradient-to-br from-cyan-500/5 to-purple-500/5">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">The daily pain</h3>
                    <p className="text-muted-foreground">
                      Fighting fillable PDFs that wouldn't let you select text properly. Spending way too long typing the same dates over and over.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Why AI extraction</h3>
                    <p className="text-muted-foreground">
                      I wanted something that actually took work off my plate. If the AI can pull 20+ fields in 30 seconds and build the timeline/tasks automatically, that's hours saved every week.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Philosophy */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">
            Keeping it dead simple
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-4xl mx-auto">
            I made sure every screen and every feature stays clear. Too many tools pile on so much stuff that you spend more time figuring out the software than doing your actual job.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: "Fast extraction",
                description: "Gets the important dates, parties, contingencies out of the PDF quickly — even if the handwriting is rough",
                color: "from-cyan-500 to-cyan-600",
              },
              {
                icon: Clock,
                title: "Workflow in seconds",
                description: "Turns those dates into a timeline and task list you can actually use right away",
                color: "from-blue-500 to-blue-600",
              },
              {
                icon: Check,
                title: "No clutter",
                description: "Built to be straightforward. You shouldn't need a manual to find what you need",
                color: "from-purple-500 to-purple-600",
              },
            ].map((item, i) => (
              <Card
                key={i}
                className="p-8 text-center hover:shadow-xl transition-all duration-300 border-0 bg-card/50 backdrop-blur"
              >
                <div className={`w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                  <item.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">
            Started for coordinators like me
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Transaction coordinators</h3>
                  <p className="text-muted-foreground">
                    People buried in paperwork who just want to get through their day without fighting bad software.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shrink-0">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Agents & teams too</h3>
                  <p className="text-muted-foreground">
                    As I kept building, agents and small teams started using it. Turns out simple and affordable works for more people than I originally thought.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <Card className="p-12 text-center bg-gradient-to-br from-primary/10 via-purple-500/10 to-cyan-500/10 border-2">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Want to try what I built for myself?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              One free parse to see how it handles your contracts. No monthly charge until you're ready.
            </p>
            <Button size="lg" className="h-14 px-10 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all" asChild>
              <Link href="/">
                <Sparkles className="mr-2 h-5 w-5" />
                Try It Free
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground mt-6">
              1 free credit • No card needed
            </p>
          </Card>
        </div>
      </section>

      {/* Footer */}
<footer className="py-12 border-t">
  <div className="max-w-6xl mx-auto px-4 text-center">
    <p className="text-sm text-muted-foreground mb-6 flex items-center justify-center gap-1">
      © 2026 TC Helper App. Built with <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" /> in Saint Robert, Missouri.
    </p>

    {/* CSS-only separator using divide-x */}
    <div className="flex items-center justify-center divide-x divide-muted-foreground/40 text-sm">
      <Link
        href="/"
        className="px-4 text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
      >
        Home
      </Link>
      <Link
        href="/plans"
        className="px-4 text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
      >
        Pricing
      </Link>
      <Link
        href="/privacy"
        className="px-4 text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
      >
        Privacy Policy
      </Link>
    </div>
  </div>
</footer>
    </main>
  );
}

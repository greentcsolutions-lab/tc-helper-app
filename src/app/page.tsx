import React from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Brain,
  CheckSquare,
  Rocket,
  Calendar,
  ArrowRight,
  Check,
  Shield,
  Award,
  Upload,
  Users,
  LucideIcon
} from "lucide-react";

 import { SignUpButton, SignedOut } from "@clerk/nextjs";
 import Link from "next/link";

 import { SiteFooter } from "@/components/layout/SiteFooter";

/**
 * TYPES: Added for strict TypeScript environments
 */
interface WorkflowStepProps {
  step: string;
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  isLast?: boolean;
}

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  items: string[];
  gradient: string;
}

interface PricingCardProps {
  title: string;
  price: string;
  description: string;
  features: string[];
  buttonText: string;
  highlighted?: boolean;
  comingSoon?: boolean;
}

const AnimatedWorkflowMockup = () => {
  const steps = [
    { label: 'Upload PDF', delay: 0, duration: 2 },
    { label: 'AI Processing', delay: 2, duration: 2 },
    { label: 'Extract Data', delay: 4, duration: 2 },
    { label: 'Results Ready', delay: 6, duration: 2 }
  ];

  return (
    <div className="relative max-w-4xl mx-auto mt-16">
      {/* Step Indicator */}
      <div className="flex justify-center mb-8 gap-4">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 animate-glow-pulse"
              style={{ animationDelay: `${step.delay}s`, animationDuration: '8s' }}
            />
            <span className="text-xs font-medium text-muted-foreground">{step.label}</span>
            {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/30" />}
          </div>
        ))}
      </div>

      {/* Unified Workflow Container */}
      <div className="relative rounded-3xl overflow-hidden border-2 border-blue-200/50 shadow-2xl bg-white">
        <div className="aspect-[16/10] relative">

          {/* State 1: Upload PDF (0-2s) */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 transition-opacity duration-500"
            style={{
              opacity: 'var(--upload-opacity, 1)',
              animation: 'stateTransition 8s infinite',
              animationDelay: '0s'
            }}
          >
            <div className="text-sm font-bold text-slate-600 mb-8">Drop Your PDF Contract</div>
            <div className="relative w-64 h-64 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center animate-file-drop"
                 style={{ animationDuration: '8s', animationIterationCount: 'infinite' }}>
              <Upload className="h-20 w-20 text-slate-400" />
              <div className="absolute -bottom-12 text-xs text-slate-500">contract.pdf</div>
            </div>
          </div>

          {/* State 2: AI Scan (2-4s) - EYE-CATCHING */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 opacity-0 transition-opacity duration-500"
            style={{
              animation: 'stateTransition 8s infinite',
              animationDelay: '2s'
            }}
          >
            <div className="text-sm font-bold text-white mb-8 flex items-center gap-2">
              <Brain className="h-5 w-5 animate-pulse" />
              AI Analyzing Contract
            </div>

            {/* Neural network visualization */}
            <div className="relative w-80 h-80">
              {/* Center brain icon with pulse */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <Brain className="h-24 w-24 text-white/90 relative z-10" />
                  {/* Pulsing circles */}
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="absolute inset-0 border-2 border-white/40 rounded-full"
                      style={{
                        animation: 'aiScanPulse 2s ease-out infinite',
                        animationDelay: `${i * 0.3 + 2}s`,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Sweeping beams */}
              {[0, 1, 2].map((i) => (
                <div
                  key={`beam-${i}`}
                  className="absolute inset-0 overflow-hidden"
                >
                  <div
                    className="absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-white/60 to-transparent blur-xl"
                    style={{
                      animation: 'aiBeamSweep 3s ease-in-out infinite',
                      animationDelay: `${2 + i * 0.5}s`,
                    }}
                  />
                </div>
              ))}

              {/* Floating particles */}
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * 30) * (Math.PI / 180);
                const distance = 100;
                const tx = Math.cos(angle) * distance;
                const ty = Math.sin(angle) * distance;

                return (
                  <div
                    key={`particle-${i}`}
                    className="absolute top-1/2 left-1/2 w-3 h-3 bg-white rounded-full"
                    style={{
                      animation: 'particleFloat 2s ease-out infinite',
                      animationDelay: `${2 + i * 0.1}s`,
                      ['--tx' as string]: `${tx}px`,
                      ['--ty' as string]: `${ty}px`,
                    }}
                  />
                );
              })}
            </div>

            <div className="mt-8 text-white/90 text-xs font-medium animate-pulse">
              Scanning 47 pages...
            </div>
          </div>

          {/* State 3: Data Extraction (4-6s) */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100 opacity-0 transition-opacity duration-500"
            style={{
              animation: 'stateTransition 8s infinite',
              animationDelay: '4s'
            }}
          >
            <div className="text-sm font-bold text-purple-600 mb-8">Extracting Structured Data</div>
            <div className="w-96 space-y-3">
              {[
                { label: 'Acceptance Date', width: '90%', delay: 4 },
                { label: 'Inspection Period', width: '85%', delay: 4.2 },
                { label: 'Buyer & Seller Info', width: '95%', delay: 4.4 },
                { label: 'Property Address', width: '80%', delay: 4.6 },
                { label: 'Closing Date', width: '88%', delay: 4.8 },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-purple-600 opacity-0 animate-data-extract"
                         style={{ animationDelay: `${item.delay}s`, animationDuration: '8s', animationIterationCount: 'infinite' }} />
                  <div className="flex-1">
                    <div className="h-7 bg-gradient-to-r from-purple-400 to-purple-600 rounded opacity-0 animate-data-extract"
                         style={{
                           animationDelay: `${item.delay}s`,
                           animationDuration: '8s',
                           animationIterationCount: 'infinite',
                           width: item.width
                         }}>
                      <span className="text-white text-xs px-3 leading-7">{item.label}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* State 4: Results (6-8s) */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 opacity-0 transition-opacity duration-500"
            style={{
              animation: 'stateTransition 8s infinite',
              animationDelay: '6s'
            }}
          >
            <div
              className="opacity-0 animate-results-pop flex flex-col items-center"
              style={{ animationDelay: '6s', animationDuration: '8s', animationIterationCount: 'infinite' }}
            >
              <CheckSquare className="h-24 w-24 text-green-600 mb-6" />
              <div className="text-xl font-bold text-green-700 mb-2">Contract Processed!</div>
              <div className="text-sm text-green-600">All dates and contacts extracted</div>
            </div>
          </div>

        </div>

        {/* Progress bar at bottom */}
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 via-purple-500 to-green-500"
             style={{
               animation: 'progressBar 8s linear infinite'
             }}
        />
      </div>

      {/* Loop Indicator */}
      <div className="text-center mt-6">
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span>Live demo • Automatically progresses through workflow</span>
        </div>
      </div>
    </div>
  );
};

const HeroSection = () => (
  <section className="pt-24 pb-16 px-4">
    <div className="max-w-6xl mx-auto text-center">
      <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8 animate-hero-badge-pulse">
        <Sparkles className="h-4 w-4" />
        AI-Powered Extraction
      </div>

      <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-left md:text-center animate-hero-fade-up stagger-delay-1">
        <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
          Stop Typing Your Contracts.
        </span>
        <br />
        <span className="text-foreground">Start Managing Them.</span>
      </h1>

      <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed text-left md:text-center animate-hero-fade-up stagger-delay-2">
        Upload any real estate contract. Our AI extracts every date, contact, and contingency in 60 seconds. You just execute.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 animate-hero-fade-up stagger-delay-3">
        <SignedOut>
          <SignUpButton mode="modal">
            <Button size="lg" className="h-14 px-10 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all hover-scale w-full sm:w-auto bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 hover-gradient-shift">
              <Sparkles className="mr-2 h-5 w-5" />
              Extract Your First Contract Free
            </Button>
          </SignUpButton>
        </SignedOut>
        <Button size="lg" variant="outline" className="h-14 px-8 text-lg w-full sm:w-auto hover-scale" asChild>
          <a href="#how-it-works">
            See the Extraction
            <ArrowRight className="ml-2 h-5 w-5" />
          </a>
        </Button>
      </div>

      <AnimatedWorkflowMockup />
    </div>
  </section>
);

const WorkflowStep = ({ step, icon: Icon, title, description, color, isLast }: WorkflowStepProps) => (
  <div className="relative">
    {!isLast && (
      <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-muted-foreground/20 to-transparent" />
    )}
    <Card className="p-6 text-center relative z-10 hover-card-lift hover-glow transition-all duration-300 border-0 bg-card/50 backdrop-blur">
      <div className="text-5xl font-bold text-muted-foreground/10 mb-2">{step}</div>
      <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center transition-transform hover-scale`}>
        <Icon className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </Card>
  </div>
);

const FeatureCard = ({ icon: Icon, title, subtitle, items, gradient }: FeatureCardProps) => (
  <Card className="p-8 border-0 bg-card/50 backdrop-blur hover-card-lift transition-all duration-300">
    <div className="flex items-start gap-4 mb-6">
      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 hover-scale`}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <div className="text-left">
        <h3 className="text-2xl font-bold mb-2">{title}</h3>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
    </div>
    <ul className="space-y-3 mb-6 text-left">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2">
          <Check className="h-5 w-5 text-cyan-600 shrink-0 mt-0.5" />
          <span className="text-muted-foreground">{item}</span>
        </li>
      ))}
    </ul>
  </Card>
);

const PricingCard = ({ title, price, description, features, buttonText, highlighted = false, comingSoon = false }: PricingCardProps) => (
  <Card className={`p-8 border-2 transition-all duration-300 relative ${highlighted ? 'border-primary shadow-xl scale-105 z-10' : comingSoon ? 'border-dashed border-muted-foreground/30 opacity-90' : 'hover:shadow-xl'}`}>
    {highlighted && (
      <Badge className="absolute -top-3 right-8 bg-gradient-to-r from-cyan-600 to-blue-600">
        Most Popular
      </Badge>
    )}
    {comingSoon && (
      <Badge variant="secondary" className="absolute -top-3 right-8">
        Coming Soon
      </Badge>
    )}
    <div className="mb-6 text-left">
      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-4xl font-bold ${comingSoon ? 'text-muted-foreground' : ''}`}>{price}</span>
        {price !== "$0" && price !== "—" && <span className="text-muted-foreground">/month</span>}
      </div>
      <p className="text-muted-foreground">{description}</p>
    </div>
    <ul className="space-y-3 mb-8 text-left">
      {features.map((feature, idx) => (
        <li key={idx} className="flex items-start gap-2">
          <Check className={`h-5 w-5 ${comingSoon ? 'text-blue-600' : 'text-green-600'} shrink-0 mt-0.5`} />
          <span className="text-sm">{feature}</span>
        </li>
      ))}
    </ul>
    {comingSoon ? (
      <Button variant="outline" className="w-full h-12 text-base" disabled>
        {buttonText}
      </Button>
    ) : (
      <SignedOut>
        <SignUpButton mode="modal">
          <Button variant={highlighted ? "default" : "outline"} className="w-full h-12 text-base">
            {buttonText}
          </Button>
        </SignUpButton>
      </SignedOut>
    )}
  </Card>
);

export default function Home() {
  const steps: Omit<WorkflowStepProps, 'isLast'>[] = [
    { step: "01", icon: Upload, title: "Drop Your PDF", description: "Drag in any contract or complex addenda. Even the handwritten ones.", color: "from-cyan-500 to-cyan-600" },
    { step: "02", icon: Brain, title: "AI Scans & Extracts", description: "Our engine identifies EMD, Inspection dates, and 20+ other data points.", color: "from-blue-500 to-blue-600" },
    { step: "03", icon: Calendar, title: "Timeline Built", description: "A color-coded, sortable timeline is generated based on contract dates.", color: "from-purple-500 to-purple-600" },
    { step: "04", icon: Rocket, title: "Review & Ship", description: "Add custom tasks, verify the data, and start your transaction with confidence.", color: "from-pink-500 to-pink-600" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      <HeroSection />

      {/* Problem Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Drowning in Data Entry?</h2>
          <p className="text-xl text-muted-foreground leading-relaxed text-left md:text-center">
            Stop squinting at blurry PDFs and manual counting dates. Missing a contingency shouldn't be the cost of doing business.
            <span className="block mt-4 font-medium text-foreground">
              TCHelper automates the boring stuff so you can handle more files with less stress.
            </span>
          </p>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Your New 60-Second Workflow</h2>
            <p className="text-xl text-muted-foreground">From PDF to a perfect timeline in four simple steps</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((item, i) => (
              <div key={i} className={`animate-card-slide-up stagger-delay-${i + 1}`}>
                <WorkflowStep {...item} isLast={i === steps.length - 1} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8">
            <FeatureCard 
              icon={Brain} 
              title="AI Extraction" 
              subtitle="The hook that starts it all"
              gradient="from-cyan-500 to-blue-600"
              items={["Handles PDFs up to 100 pages", "95% accuracy on handwriting", "Extracts 20+ data points", "Save 20+ minutes per file"]}
            />
            <FeatureCard 
              icon={CheckSquare} 
              title="Smart Tasks" 
              subtitle="The power of customization"
              gradient="from-blue-500 to-purple-600"
              items={["AI-generated workflows", "Kanban + Table views", "Custom templates"]}
            />
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="animate-stats-reveal stagger-delay-1">
              <div className="text-4xl font-bold text-primary mb-2">95%</div>
              <p className="text-muted-foreground">Extraction Accuracy</p>
            </div>
            <div className="animate-stats-reveal stagger-delay-2">
              <div className="text-4xl font-bold text-primary mb-2">20+ Min</div>
              <p className="text-muted-foreground">Saved Per Transaction</p>
            </div>
            <div className="animate-stats-reveal stagger-delay-3">
              <div className="text-4xl font-bold text-primary mb-2">10+ Years</div>
              <p className="text-muted-foreground">Industry Expertise</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-8 opacity-50 grayscale">
             <div className="flex items-center gap-2 font-semibold"><Shield className="h-5 w-5"/> Secure</div>
             <div className="flex items-center gap-2 font-semibold"><Award className="h-5 w-5"/> Trusted</div>
             <div className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5"/> Collaborative</div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">Simple Pricing</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <PricingCard
              title="Free" price="$0"
              description="No credit card required"
              features={["1 AI extraction lifetime", "1 concurrent transaction", "10 custom tasks"]}
              buttonText="Start Free"
            />
            <PricingCard
              title="Basic" price="$20"
              description="or $200/year (save $40)"
              features={["15 AI extractions per month", "Unlimited Transactions", "100 custom tasks", "Priority support"]}
              buttonText="Get Started"
              highlighted={true}
            />
            <PricingCard
              title="Standard" price="$50"
              description="or $500/year (save $100)"
              features={["60 AI extractions per month", "Unlimited Transactions", "Unlimited custom tasks", "50 task templates", "Calendar sync (coming soon)", "Communications (coming soon)"]}
              buttonText="Get Started"
            />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
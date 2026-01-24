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
}

const AnimatedWorkflowMockup = () => (
  <div className="relative max-w-6xl mx-auto mt-16 rounded-3xl overflow-hidden border-2 border-blue-200/50 shadow-2xl bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-8">

    {/* Step Indicator */}
    <div className="flex justify-between mb-8 relative">
      {['Upload', 'Process', 'Extract', 'Results'].map((label, i) => (
        <div key={i} className="flex flex-col items-center flex-1">
          <div
            className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 animate-glow-pulse"
            style={{ animationDelay: `${i * 2}s` }}
          />
          <span className="text-xs font-medium text-muted-foreground mt-2">{label}</span>
        </div>
      ))}
      <div className="absolute top-1.5 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-200 via-blue-200 to-purple-200 -z-10" />
    </div>

    {/* Animated Workflow */}
    <div className="grid md:grid-cols-4 gap-4 relative">

      {/* Step 1: Upload */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 relative overflow-hidden">
        <div className="text-xs font-bold text-slate-500 mb-2">1. Upload PDF</div>
        <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center relative">
          <div className="absolute inset-4 border-2 border-dashed border-slate-300 rounded-lg animate-file-drop"
               style={{ animationDelay: '0s', animationIterationCount: 'infinite', animationDuration: '8s' }}>
            <Upload className="absolute inset-0 m-auto h-8 w-8 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Step 2: AI Processing */}
      <div className="bg-white rounded-xl p-4 border border-blue-200 relative overflow-hidden">
        <div className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1">
          <Brain className="h-3 w-3" /> 2. AI Scan
        </div>
        <div className="aspect-square bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg relative overflow-hidden">
          {/* Scanning line effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/30 to-transparent h-8 animate-scanning-line"
                 style={{ animationDelay: '2s', animationIterationCount: 'infinite', animationDuration: '8s' }} />
            <div className="text-4xl font-mono text-blue-400/30">PDF</div>
          </div>
        </div>
      </div>

      {/* Step 3: Data Extraction */}
      <div className="bg-white rounded-xl p-4 border border-purple-200 relative overflow-hidden">
        <div className="text-xs font-bold text-purple-600 mb-2">3. Extract Data</div>
        <div className="aspect-square bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 flex flex-col justify-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-2 bg-gradient-to-r from-purple-400 to-purple-600 rounded animate-data-extract opacity-0"
              style={{
                animationDelay: `${4 + i * 0.2}s`,
                animationIterationCount: 'infinite',
                animationDuration: '8s',
                width: `${100 - i * 15}%`
              }}
            />
          ))}
        </div>
      </div>

      {/* Step 4: Results */}
      <div className="bg-white rounded-xl p-4 border border-green-200 relative overflow-hidden">
        <div className="text-xs font-bold text-green-600 mb-2 flex items-center gap-1">
          <Check className="h-3 w-3" /> 4. Done!
        </div>
        <div className="aspect-square bg-gradient-to-br from-green-50 to-green-100 rounded-lg flex items-center justify-center">
          <div className="animate-results-pop opacity-0"
               style={{ animationDelay: '6s', animationIterationCount: 'infinite', animationDuration: '8s' }}>
            <CheckSquare className="h-12 w-12 text-green-500" />
          </div>
        </div>
      </div>
    </div>

    {/* Loop Indicator */}
    <div className="text-center mt-6">
      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        <span>Live demo • Loops every 8 seconds</span>
      </div>
    </div>
  </div>
);

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

const PricingCard = ({ title, price, description, features, buttonText, highlighted = false }: PricingCardProps) => (
  <Card className={`p-8 border-2 transition-all duration-300 relative ${highlighted ? 'border-primary shadow-xl scale-105 z-10' : 'hover:shadow-xl'}`}>
    {highlighted && (
      <Badge className="absolute -top-3 right-8 bg-gradient-to-r from-cyan-600 to-blue-600">
        Most Popular
      </Badge>
    )}
    <div className="mb-6 text-left">
      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-4xl font-bold">{price}</span>
        {price !== "$0" && <span className="text-muted-foreground">/month</span>}
      </div>
      <p className="text-muted-foreground">{description}</p>
    </div>
    <ul className="space-y-3 mb-8 text-left">
      {features.map((feature, idx) => (
        <li key={idx} className="flex items-start gap-2">
          <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <span className="text-sm">{feature}</span>
        </li>
      ))}
    </ul>
    <SignedOut>
      <SignUpButton mode="modal">
        <Button variant={highlighted ? "default" : "outline"} className="w-full h-12 text-base">
          {buttonText}
        </Button>
      </SignUpButton>
    </SignedOut>
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
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">Simple Pricing</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <PricingCard 
              title="Free" price="$0" 
              description="No credit card required" 
              features={["1 AI parse lifetime", "1 concurrent transaction", "10 custom tasks"]}
              buttonText="Start Free"
            />
            <PricingCard 
              title="Basic" price="$20" 
              description="or $200/year (save $40)" 
              features={["5 AI parses per month", "5 concurrent transactions", "100 custom tasks", "Priority support"]}
              buttonText="Get Started"
              highlighted={true}
            />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
// src/app/compare/page.tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, Check, X } from "lucide-react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import Link from "next/link";
import { SignedOut, SignUpButton } from "@clerk/nextjs";

const HeroSection = () => (
  <section className="pt-24 pb-16 px-4">
    <div className="max-w-6xl mx-auto text-center">
      <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8">
        <Sparkles className="h-4 w-4" />
        Feature Comparison
      </div>

      <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-left md:text-center">
        <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
          TC Helper vs. The Rest
        </span>
        <br />
        <span className="text-foreground">See How We Stack Up.</span>
      </h1>

      <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed text-left md:text-center">
        A direct look at why TC Helper is the smarter, more efficient choice for transaction coordinators and real estate professionals.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
        <SignedOut>
          <SignUpButton mode="modal">
            <Button size="lg" className="h-14 px-10 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all hover-scale w-full sm:w-auto bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 hover-gradient-shift">
              <Sparkles className="mr-2 h-5 w-5" />
              Try TC Helper Free
            </Button>
          </SignUpButton>
        </SignedOut>
        <Button size="lg" variant="outline" className="h-14 px-8 text-lg w-full sm:w-auto hover-scale" asChild>
          <Link href="/plans">
            View Pricing Plans
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>
    </div>
  </section>
);

const ComparisonTable = () => {
  const features = [
    {
      name: "Pricing Model",
      tcHelper: "$20/month base",
      listedKit: "$9.99 per file (credits)",
      trackxi: "$39/month (Essential plan)",
      openToClose: "$99/month (Grow plan)",
    },
    {
      name: "AI Credits/Parses",
      tcHelper: "15 AI credits/month",
      listedKit: "One credit = one contract setup",
      trackxi: "AI-powered transaction management (Pro plan+)",
      openToClose: "doesn't provide",
    },
    {
      name: "Concurrent Active Files/Transactions",
      tcHelper: "20 files",
      listedKit: "1 file per credit",
      trackxi: "10 active transactions (Essential plan)",
      openToClose: "Unlimited",
    },
    {
      name: "Custom Tasks",
      tcHelper: "100 custom tasks + AI generated",
      listedKit: "Task Management (AI-powered)",
      trackxi: "Task Management",
      openToClose: "Yes (Task Management, Triggers)",
    },
    {
      name: "Task Checklists",
      tcHelper: "10 checklists for each task",
      listedKit: "AI-powered checklists only",
      trackxi: "doesn't provide",
      openToClose: "Sub-tasks, recurring tasks, task automation",
    },
    {
      name: "Calendar Sync",
      tcHelper: "In the works",
      listedKit: "Syncs with Google Calendar",
      trackxi: "Email/Calendar integration",
      openToClose: "API date invitations",
    },
    {
      name: "Communications Center",
      tcHelper: "In the works",
      listedKit: "AI assistant drafts and sends emails",
      trackxi: "Email integration, automated emails",
      openToClose: "Scheduled emails, Smart Blocks",
    },
    {
      name: "AI Data Usage for Model Training",
      tcHelper: "NOT used for AI model training",
      listedKit: "Implied: Uses user data to train Ava",
      trackxi: "doesn't specify",
      openToClose: "doesn't provide",
    },
    {
      name: "Contacts Management",
      tcHelper: "Building this (no hard limit)",
      listedKit: "doesn't provide",
      trackxi: "2,500 contacts (Essential plan), CRM",
      openToClose: "Contact roles/groups/businesses",
    },
    {
      name: "Documents Feature",
      tcHelper: "Developing this",
      listedKit: "Document Management, Compliance Check",
      trackxi: "File storage, document management, compliance",
      openToClose: "Google Drive sync, file roles, splitting/merging documents",
    },
    {
      name: "CRM Integration",
      tcHelper: "doesn't provide",
      listedKit: "doesn't provide",
      trackxi: "Yes (CRM included)",
      openToClose: "doesn't provide",
    },
    {
      name: "Custom Fields",
      tcHelper: "doesn't provide",
      listedKit: "doesn't provide",
      trackxi: "doesn't provide",
      openToClose: "Yes (Custom property fields, custom fields)",
    },
    {
      name: "Merge Fields",
      tcHelper: "doesn't provide",
      listedKit: "doesn't provide",
      trackxi: "doesn't provide",
      openToClose: "Yes",
    },
    {
      name: "Agent & Client Portals",
      tcHelper: "Not developing these currently",
      listedKit: "doesn't provide",
      trackxi: "Client/Partner Portals",
      openToClose: "Free agent and client portals",
    },
  ];

  const services = [
    { name: "TC Helper App", highlight: true, description: "AI-powered Transaction Coordination" },
    { name: "ListedKit", highlight: false, description: "AI Checklists & Email Assistant" },
    { name: "Trackxi", highlight: false, description: "Transaction & Contact Management" },
    { name: "Open to Close", highlight: false, description: "Comprehensive TC Platform" },
  ];

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Feature-by-Feature Breakdown
        </h2>

        {/* Comparison Table Header */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 font-semibold text-center">
          <div className="col-span-2 md:col-span-1 text-left md:text-center text-lg md:text-xl text-primary">Feature</div>
          {services.map((service, index) => (
            <Card
              key={index}
              className={`p-4 rounded-lg flex flex-col justify-center items-center h-full ${
                service.highlight ? "border-primary shadow-xl scale-105" : "border-transparent"
              } transition-all duration-300`}
            >
              <h3 className="text-lg md:text-xl font-bold mb-1">{service.name}</h3>
              <p className="text-sm text-muted-foreground hidden sm:block">{service.description}</p>
              {service.highlight && (
                <Badge className="mt-2 bg-gradient-to-r from-cyan-600 to-blue-600">Our Pick</Badge>
              )}
            </Card>
          ))}
        </div>

        {/* Comparison Table Body */}
        <div className="divide-y divide-muted-foreground/20 border-t border-b border-muted-foreground/20">
          {features.map((feature, featureIndex) => (
            <div key={featureIndex} className="grid grid-cols-2 md:grid-cols-5 gap-4 py-4 items-center hover:bg-muted/10 transition-colors">
              <div className="col-span-2 md:col-span-1 text-base md:text-lg font-medium text-left text-foreground">
                {feature.name}
              </div>
              <div className="text-center">
                {feature.tcHelper === "doesn't provide" || feature.tcHelper === "Not developing these currently" ? (
                    <X className="h-5 w-5 text-red-500 mx-auto" />
                  ) : feature.tcHelper === "In the works" || feature.tcHelper === "Building this (no hard limit)" || feature.tcHelper === "Developing this" ? (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">In Progress</Badge>
                  ) : (
                    <span className="text-sm md:text-base text-foreground">{feature.tcHelper}</span>
                  )}
              </div>
              <div className="text-center">
                {feature.listedKit === "doesn't provide" ? (
                    <X className="h-5 w-5 text-red-500 mx-auto" />
                  ) : (
                    <span className="text-sm md:text-base text-foreground">{feature.listedKit}</span>
                  )}
              </div>
              <div className="text-center">
                {feature.trackxi === "doesn't provide" ? (
                    <X className="h-5 w-5 text-red-500 mx-auto" />
                  ) : (
                    <span className="text-sm md:text-base text-foreground">{feature.trackxi}</span>
                  )}
              </div>
              <div className="text-center">
                {feature.openToClose === "doesn't provide" ? (
                    <X className="h-5 w-5 text-red-500 mx-auto" />
                  ) : (
                    <span className="text-sm md:text-base text-foreground">{feature.openToClose}</span>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};


export default function ComparePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      <HeroSection />
      <ComparisonTable />
      <SiteFooter />
    </main>
  );
}

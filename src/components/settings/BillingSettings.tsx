// src/components/settings/BillingSettings.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CreditCard } from "lucide-react";
import Link from "next/link";

export default function BillingSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing & Plan</CardTitle>
        <CardDescription>Manage your subscription and billing information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-4 p-4 border rounded-lg">
          <div className="p-3 bg-primary/10 rounded-lg">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">View Billing Details</h3>
            <p className="text-sm text-muted-foreground mb-3">
              View your current plan, usage metrics, and manage your subscription
            </p>
            <Link href="/dashboard/billing">
              <Button>
                Go to Billing
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

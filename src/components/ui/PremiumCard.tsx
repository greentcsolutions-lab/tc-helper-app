// src/components/ui/premium-card.tsx
import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PremiumCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export function PremiumCard({ 
  className, 
  children, 
  glow = false, 
  ...props 
}: PremiumCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-0 shadow-xl bg-gradient-to-br from-primary/5 via-background to-secondary/30 backdrop-blur-xl",
        className
      )}
      {...props}
    >
      {glow && (
        <div className="pointer-events-none absolute -inset-4 bg-gradient-to-r from-primary/20 to-purple-600/10 rounded-3xl blur-3xl -z-10 opacity-70" />
      )}
      {children}
    </Card>
  );
}

// Optional: Keep the original CardHeader/CardContent exports for convenience
PremiumCard.Header = CardHeader;
PremiumCard.Content = CardContent;
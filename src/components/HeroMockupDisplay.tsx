import React from 'react';
import { Upload, Brain } from "lucide-react";
import { cn } from "@/lib/utils"; // Assuming cn is available for clsx + twMerge

interface HeroMockupDisplayProps {
  className?: string;
}

export const HeroMockupDisplay = ({ className }: HeroMockupDisplayProps) => {
  return (
    <div className={cn("relative max-w-5xl mx-auto mt-12 rounded-2xl overflow-hidden border shadow-2xl bg-card", className)}>
      {/* Subtle radial gradient at the bottom for visual depth */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-10" />
      <div className="grid md:grid-cols-2 gap-0 text-left">
        <div className="p-4 bg-muted/50 border-r">
          <p className="text-xs font-bold text-muted-foreground uppercase mb-4">The Messy PDF</p>
          <div className="aspect-[4/3] bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 border border-slate-300">
             <Upload className="h-12 w-12 opacity-20" />
          </div>
        </div>
        <div className="p-4 bg-background relative flex flex-col justify-center">
          <div className="absolute inset-0 bg-blue-500/5 animate-pulse pointer-events-none" />
          <p className="text-xs font-bold text-blue-600 uppercase mb-4 flex items-center gap-1">
            <Brain className="h-3 w-3" /> TCHelper AI Output
          </p>
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-8 bg-muted rounded animate-pulse w-full" />
            <div className="h-32 border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center text-blue-500 text-sm font-medium italic bg-blue-50/30 text-center px-4">
              Extracting Dates, Parties, and Contingencies...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

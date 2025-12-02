// src/components/CategorySection.tsx — FINAL, BEAUTIFUL, BUTTERY SMOOTH
"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import CopyAllButton from "@/components/ui/CopyAllButton";
import CopyFieldRow from "@/components/ui/CopyFieldRow";
import { ReactNode } from "react";

interface CategorySectionProps {
  title: string;
  icon: ReactNode;
  fields: { label: string; value: any }[];
  defaultOpen?: boolean;
  categoryName?: string;
}

export default function CategorySection({
  title,
  icon,
  fields,
  defaultOpen = true,
  categoryName,
}: CategorySectionProps) {
  const categoryData = Object.fromEntries(
    fields.map((f) => [f.label, f.value])
  );

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger asChild>
        <CardHeader className="bg-muted/50 hover:bg-muted/70 transition-all duration-200 cursor-pointer rounded-lg -mb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon}
              <CardTitle className="text-lg">{title}</CardTitle>
              <Badge variant="secondary">{fields.length} fields</Badge>
            </div>

            <div className="flex items-center gap-3">
              <div onClick={(e) => e.stopPropagation()}>
                <CopyAllButton
                  data={categoryData}
                  categoryName={categoryName || title}
                />
              </div>

              {/* This now rotates perfectly */}
              <ChevronDown className="h-5 w-5 transition-transform duration-300 [[data-state=open]_&]:rotate-180" />
            </div>
          </div>
        </CardHeader>
      </CollapsibleTrigger>

      {/* Smooth, beautiful, built-in Radix animation */}
      <CollapsibleContent className="overflow-hidden transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:duration-200 data-[state=open]:duration-300">
        <CardContent className="p-6 pt-4 border border-border/50 rounded-b-lg bg-card">
          <div className="divide-y divide-border">
            {fields.map((field, i) => (
              <CopyFieldRow key={i} label={field.label} value={field.value} />
            ))}
          </div>
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
  );
}
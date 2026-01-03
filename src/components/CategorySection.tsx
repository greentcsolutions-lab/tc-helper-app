// src/components/CategorySection.tsx — FINAL, BEAUTIFUL, BUTTERY SMOOTH
// Version: 2.0.0 - 2026-01-03 - ENHANCED: Added edit mode support
"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import CopyAllButton from "@/components/ui/CopyAllButton";
import CopyFieldRow from "@/components/ui/CopyFieldRow";
import { ReactNode } from "react";

export interface FieldConfig {
  label: string;
  value: any;
  fieldKey?: string;
  type?: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'array';
  options?: { label: string; value: string; disabled?: boolean }[];
  onChange?: (value: any) => void;
}

interface CategorySectionProps {
  title: string;
  icon: ReactNode;
  fields: FieldConfig[];
  defaultOpen?: boolean;
  categoryName?: string;
  isEditing?: boolean;
}

export default function CategorySection({
  title,
  icon,
  fields,
  defaultOpen = true,
  categoryName,
  isEditing = false,
}: CategorySectionProps) {
  const categoryData = Object.fromEntries(
    fields.map((f) => [f.label, f.value])
  );

  const renderEditableField = (field: FieldConfig, index: number) => {
    if (!isEditing) {
      return <CopyFieldRow key={index} label={field.label} value={field.value} />;
    }

    const handleChange = (newValue: any) => {
      if (field.onChange) {
        field.onChange(newValue);
      }
    };

    return (
      <div key={index} className="py-3 first:pt-0 last:pb-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
          <label className="text-sm font-medium text-muted-foreground">
            {field.label}
          </label>
          <div onKeyDown={(e) => e.stopPropagation()}>
            {field.type === 'boolean' ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={field.value === true}
                  onCheckedChange={(checked) => handleChange(checked)}
                  disabled={!field.onChange}
                />
                <span className="text-sm">{field.value ? 'Yes' : 'No'}</span>
              </div>
            ) : field.type === 'select' && field.options ? (
              <Select
                value={field.value || ''}
                onValueChange={handleChange}
                disabled={!field.onChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      disabled={opt.disabled}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === 'array' ? (
              <Input
                type="text"
                value={Array.isArray(field.value) ? field.value.join(', ') : ''}
                onChange={(e) => {
                  const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  handleChange(arr);
                }}
                placeholder="Comma-separated values"
                disabled={!field.onChange}
              />
            ) : (
              <Input
                type={field.type || 'text'}
                value={field.value ?? ''}
                onChange={(e) => {
                  const val = field.type === 'number' ? parseFloat(e.target.value) || null : e.target.value;
                  handleChange(val);
                }}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                disabled={!field.onChange}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger asChild>
        <CardHeader className="bg-muted/50 hover:bg-muted/70 transition-all duration-200 cursor-pointer rounded-lg -mb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon}
              <CardTitle className="text-lg">{title}</CardTitle>
              <Badge variant="secondary">{fields.length} fields</Badge>
              {isEditing && <Badge variant="default">Editing</Badge>}
            </div>

            <div className="flex items-center gap-3">
              {!isEditing && (
                <div onClick={(e) => e.stopPropagation()}>
                  <CopyAllButton
                    data={categoryData}
                    categoryName={categoryName || title}
                  />
                </div>
              )}

              {/* This now rotates perfectly */}
              <ChevronDown className="h-5 w-5 transition-transform duration-300 [[data-state=open]_&]:rotate-180" />
            </div>
          </div>
        </CardHeader>
      </CollapsibleTrigger>

      {/* Smooth, beautiful, built-in Radix animation */}
      <CollapsibleContent className="overflow-hidden transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:duration-200 data-[state=open]:duration-300">
        <CardContent className="p-6 pt-4 border border-border/50 rounded-b-lg bg-card">
          <div className={isEditing ? "space-y-4" : "divide-y divide-border"}>
            {fields.map((field, i) => renderEditableField(field, i))}
          </div>
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
  );
}
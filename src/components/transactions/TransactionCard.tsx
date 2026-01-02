// src/components/transactions/TransactionCard.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Trash2, AlertCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import ExtractionCategories from "@/components/ExtractionCategories";
import { ParseResult } from "@/types";

interface TransactionCardProps {
  parse: ParseResult;
  isLatest: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function TransactionCard({
  parse,
  isLatest,
  isSelected,
  onToggleSelect,
  onDelete
}: TransactionCardProps) {
  const [isOpen, setIsOpen] = useState(isLatest);
  const [isDeleting, setIsDeleting] = useState(false);

  const address = parse.propertyAddress || "Address Not Found";

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(parse.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left hover:bg-muted/50 transition-colors"
      >
        <CardHeader className="bg-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div onClick={handleCheckboxClick}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(parse.id)}
                  className="h-5 w-5"
                />
              </div>
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <h3 className="text-xl font-semibold">{address}</h3>
                <p className="text-sm text-muted-foreground">
                  {parse.fileName} • {format(parse.createdAt, "PPP 'at' p")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {parse.missingSCOs && (
                <Badge variant="destructive">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Missing SCO
                </Badge>
              )}
              <ChevronDown
                className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </div>
          </div>
        </CardHeader>
      </button>

      <div className={isOpen ? "" : "h-0 overflow-hidden"}>
        <CardContent className="p-6 space-y-6 border-t">
          <div className={isOpen ? "animate-in slide-in-from-top-2 duration-300" : ""}>
            <ExtractionCategories data={parse} />
          </div>

          <div className="flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
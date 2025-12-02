// src/components/upload/actions-bar.tsx
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

type ActionsBarProps = {
  onConfirm: () => void;
  onCancel: () => void;
  pageCount: number;
  isExtracting?: boolean;
};

export function ActionsBar({ 
  onConfirm, 
  onCancel, 
  pageCount, 
  isExtracting = false 
}: ActionsBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-6 shadow-2xl z-50">
      <div className="max-w-5xl mx-auto flex items-center justify-between hidden sm:flex">
        <p className="text-lg">
          <strong>{pageCount}</strong> total pages •{" "}
          {isExtracting ? "Running AI extraction…" : "Ready"}
        </p>
        <div className="flex gap-4">
          <Button 
            size="lg" 
            variant="outline" 
            onClick={onCancel}
            disabled={isExtracting}
          >
            <AlertCircle className="mr-2 h-5 w-5" />
            Wrong file
          </Button>
          <Button 
            size="lg" 
            onClick={onConfirm}
            disabled={isExtracting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isExtracting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Extracting…
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-5 w-5" />
                Parse with AI →
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile version */}
      <div className="sm:hidden flex flex-col gap-3">
        <Button variant="outline" onClick={onCancel} disabled={isExtracting} className="w-full">
          Wrong file
        </Button>
        <Button 
          onClick={onConfirm} 
          disabled={isExtracting}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {isExtracting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Extracting…
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-5 w-5" />
              Parse with AI →
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
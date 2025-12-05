// components/ParsePreview.tsx
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface Props {
  parseId: string;
  previewPages: { pageNumber: number; base64: string }[];
  state: string;
  criticalPageCount: number;
  pageCount: number;
  onContinue: () => void;
  isExtracting: boolean;
}

export default function ParsePreview({
  parseId,
  previewPages,
  state,
  criticalPageCount,
  pageCount,
  onContinue,
  isExtracting,
}: Props) {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Document Ready for Extraction</h2>
        <p className="text-muted-foreground mt-2">
          We found <strong>{criticalPageCount}</strong> critical pages in your {pageCount}-page {state} packet.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {previewPages.map((page) => (
          <div key={page.pageNumber} className="space-y-2">
            <div className="relative aspect-[8.5/11] rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
              <Image
                src={page.base64}
                alt={`Page ${page.pageNumber}`}
                fill
                className="object-contain"
              />
            </div>
            <p className="text-center text-sm font-medium">Page {page.pageNumber}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={onContinue}
          disabled={isExtracting}
          className="px-12"
        >
          {isExtracting ? "Extracting Data..." : "Continue → Extract Price, Names & Dates"}
        </Button>
      </div>
    </div>
  );
}
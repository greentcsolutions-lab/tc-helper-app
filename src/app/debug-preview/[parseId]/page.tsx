// src/app/debug-preview/[parseId]/page.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Download, X, PlayCircle, AlertCircle } from "lucide-react";
import ImageModal from "@/components/ui/image-modal";

interface PageImage {
  pageNumber: number;
  base64: string;
  width: number;
  height: number;
}

export default function DebugPreview({ params }: { params: { parseId: string } }) {
  const [images, setImages] = useState<PageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<PageImage | null>(null);
  const router = useRouter();

  useEffect(() => {
    const evtSource = new EventSource(`/api/debug-render/${params.parseId}`);
    evtSource.onmessage = (e) => {
      if (e.data === "[DONE]") {
        evtSource.close();
        setLoading(false);
        return;
      }
      const page = JSON.parse(e.data);
      setImages(prev => [...prev, page]);
    };
    return () => evtSource.close();
  }, [params.parseId]);

  const downloadAll = () => {
    images.forEach(img => {
      const a = document.createElement("a");
      a.href = img.base64;
      a.download = `page-${String(img.pageNumber).padStart(3, "0")}.png`;
      a.click();
    });
  };

  const cancel = async () => {
    await fetch(`/api/debug-cancel/${params.parseId}`, { method: "POST" });
    router.push("/dashboard");
  };

  const proceedToGrok = () => {
    router.push(`/process-grok/${params.parseId}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <Card className="max-w-7xl mx-auto bg-gray-800 border-gray-700">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-4">
                <AlertCircle className="text-orange-500" />
                Final Check Before Grok
              </h1>
              <p className="text-gray-400 mt-3 text-lg">
                These are the EXACT images Grok will analyze. Click any to inspect.
              </p>
            </div>
            <div className="flex gap-4">
              <Button variant="destructive" size="lg" onClick={cancel}>
                <X className="mr-2" /> Cancel & Clear
              </Button>
              <Button variant="outline" size="lg" onClick={downloadAll} disabled={!images.length}>
                <Download className="mr-2" /> Download All
              </Button>
              <Button size="lg" className="bg-green-600 hover:bg-green-700" onClick={proceedToGrok} disabled={!images.length}>
                <PlayCircle className="mr-2" /> Send to Grok
              </Button>
            </div>
          </div>

          {loading && (
            <div className="text-center py-20">
              <Loader2 className="h-16 w-16 animate-spin mx-auto text-orange-500" />
              <p className="text-xl mt-6">Rendering with Ghostscript (210 DPI)... {images.length} pages done</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-8">
            {images.map((img) => (
              <div
                key={img.pageNumber}
                className="relative group cursor-pointer border-2 border-gray-700 rounded-lg overflow-hidden hover:border-orange-500 transition-all"
                onClick={() => setSelectedImage(img)}
              >
                <Image
                  src={img.base64}
                  alt={`Page ${img.pageNumber}`}
                  width={400}
                  height={520}
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-2xl font-bold">Page {img.pageNumber}</span>
                </div>
              </div>
            ))}
          </div>

          {images.length > 0 && !loading && (
            <div className="text-center mt-12 p-8 bg-green-900/50 rounded-lg">
              <p className="text-3xl font-bold text-green-400">
                ✓ All {images.length} pages rendered perfectly
              </p>
              <p className="text-xl mt-4">Grok will see exactly these images.</p>
            </div>
          )}
        </div>
      </Card>

      {selectedImage && (
        <ImageModal image={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  );
}
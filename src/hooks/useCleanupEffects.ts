// src/hooks/useCleanupEffects.ts
// Version: 1.0.0 - 2025-12-30
// Handles cleanup on window unload and component unmount

import { useEffect } from "react";
import { UploadView } from "@/components/ui/upload/types";

type UseCleanupEffectsProps = {
  parseId: string;
  view: UploadView;
};

export function useCleanupEffects({ parseId, view }: UseCleanupEffectsProps) {
  // Cleanup on window unload (user closes tab/browser)
  useEffect(() => {
    if (!parseId || view !== "done") return;

    const handleUnload = () => {
      console.log('[cleanup] Window unload detected, triggering cleanup via beacon');
      navigator.sendBeacon(
        `/api/parse/cleanup/${parseId}`, 
        JSON.stringify({ source: 'unload' })
      );
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [parseId, view]);

  // Cleanup on component unmount (user navigates away)
  useEffect(() => {
    return () => {
      if (parseId && view === "done") {
        console.log('[cleanup] Component unmounting, triggering cleanup');
        fetch(`/api/parse/cleanup/${parseId}`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'unmount' })
        }).catch(err => {
          console.warn('[cleanup] Cleanup on unmount failed:', err);
        });
      }
    };
  }, [parseId, view]);
}
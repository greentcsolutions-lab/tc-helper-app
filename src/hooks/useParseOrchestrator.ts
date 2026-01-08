// src/hooks/useParseOrchestrator.ts
// Version: 5.0.0 - 2026-01-08
// SIMPLIFIED: Removed classification step - extract directly from upload
// Extraction now processes all pages and filters by data quality
// Cleanup still manual (triggered by user)

"use client";

import { useState, useCallback } from "react";

export type ParsePhase =
  | "idle"
  | "extract"
  | "cleanup"
  | "complete"
  | "error";

export type ParseState = {
  phase: ParsePhase;
  message: string;
  pageCount?: number;
  substantivePageCount?: number;
  needsReview?: boolean;
  error?: string;
}

export function useParseOrchestrator() {
  const [state, setState] = useState<ParseState>({
    phase: 'idle',
    message: '',
  });

  const runPipeline = useCallback(async (parseId: string) => {
    try {
      // PHASE 1: EXTRACT (processes all pages, filters by data quality)
      setState({
        phase: 'extract',
        message: 'Extracting transaction data from all pages...',
      });

      const extractResult = await runExtract(parseId);

      if (!extractResult.success) {
        throw new Error(extractResult.error || 'Extraction failed');
      }

      console.log('[orchestrator] Extraction complete:', extractResult.substantivePageCount, 'substantive pages, needsReview:', extractResult.needsReview);

      // ═══════════════════════════════════════════════════════════════════════
      // CRITICAL CHANGE: DO NOT RUN CLEANUP HERE
      // ═══════════════════════════════════════════════════════════════════════
      // Cleanup will be triggered manually by:
      // 1. User clicking "Complete" button
      // 2. User navigating away (useEffect cleanup in upload-zone)
      // 3. Window unload event
      //
      // This preserves highResZipUrl for the preview gallery
      console.log('[orchestrator] ⏸️  Skipping auto-cleanup - preview images preserved');
      console.log('[orchestrator] 💡 Cleanup will run when user clicks Complete or exits');

      // COMPLETE (without cleanup)
      setState({
        phase: 'complete',
        message: extractResult.needsReview
          ? 'Extraction complete — review recommended'
          : 'Transaction extracted successfully',
        substantivePageCount: extractResult.substantivePageCount,
        pageCount: extractResult.totalPages,
        needsReview: extractResult.needsReview,
      });

      return { success: true, needsReview: extractResult.needsReview };
    } catch (error: any) {
      console.error('[orchestrator] Pipeline failed:', error);
      
      // CRITICAL: Still run cleanup on failure to avoid leaving temp files
      try {
        console.log('[orchestrator] Running cleanup after failure...');
        await runCleanup(parseId);
      } catch (cleanupError) {
        console.error('[orchestrator] Cleanup after failure also failed:', cleanupError);
      }
      
      setState({
        phase: 'error',
        message: error.message || 'Processing failed',
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }, []);

  // NEW: Manual cleanup function for user-triggered cleanup
  const triggerCleanup = useCallback(async (parseId: string) => {
    console.log('[orchestrator] 🧹 User-triggered cleanup starting...');
    
    setState((prev) => ({
      ...prev,
      phase: 'cleanup',
      message: 'Cleaning up temporary files...',
    }));

    const cleanupResult = await runCleanup(parseId);
    
    if (!cleanupResult.success) {
      console.warn('[orchestrator] Cleanup had issues:', cleanupResult.error);
      // Don't throw - cleanup issues shouldn't block the user
    } else {
      console.log('[orchestrator] ✓ Cleanup complete');
    }

    return cleanupResult;
  }, []);

  return { state, runPipeline, triggerCleanup };
}

// ============================================================================
// HELPER FUNCTIONS (REST)
// ============================================================================

async function runExtract(parseId: string): Promise<{
  success: boolean;
  needsReview?: boolean;
  substantivePageCount?: number;
  totalPages?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/parse/extract/${parseId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const error = await res.json();
      return { success: false, error: error.error || 'Extraction failed' };
    }

    const data = await res.json();
    return {
      success: true,
      needsReview: data.needsReview,
      substantivePageCount: data.substantivePageCount,
      totalPages: data.totalPages,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Extraction failed' };
  }
}

async function runCleanup(parseId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/parse/cleanup/${parseId}`, {
      method: 'POST',
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn('[cleanup] Failed but continuing:', text);
      return { success: false, error: text };
    }

    return { success: true };
  } catch (error: any) {
    console.warn('[cleanup] Failed but continuing:', error);
    return { success: false, error: error.message };
  }
}
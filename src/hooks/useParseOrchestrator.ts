// src/hooks/useParseOrchestrator.ts
// Version: 2.0.1 - 2025-12-29
// FIXED: Ensure cleanup always runs, even if there are issues

import { useState, useCallback } from 'react';

export type ParsePhase = 'idle' | 'render' | 'classify' | 'extract' | 'cleanup' | 'complete' | 'error';

interface ParseState {
  phase: ParsePhase;
  message: string;
  pageCount?: number;
  criticalPageCount?: number;
  detectedForms?: string[];
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
      // PHASE 1: RENDER
      setState({ phase: 'render', message: 'Starting dual-DPI rendering...' });
      
      const renderResult = await runRender(parseId, (msg) => {
        setState({ phase: 'render', message: msg });
      });

      if (!renderResult.success) {
        throw new Error(renderResult.error || 'Rendering failed');
      }

      console.log('[orchestrator] Render complete:', renderResult.pageCount, 'pages');

      // PHASE 2: CLASSIFY
      setState({ 
        phase: 'classify', 
        message: 'Analyzing document structure...',
        pageCount: renderResult.pageCount,
      });

      const classifyResult = await runClassify(parseId, (msg) => {
        setState((prev) => ({ ...prev, phase: 'classify', message: msg }));
      });

      if (!classifyResult.success) {
        throw new Error(classifyResult.error || 'Classification failed');
      }

      console.log('[orchestrator] Classification complete:', classifyResult.criticalPageCount, 'critical pages');

      // PHASE 3: EXTRACT (server reads from cache, no data passed)
      setState({
        phase: 'extract',
        message: 'Extracting transaction data...',
        pageCount: renderResult.pageCount,
        criticalPageCount: classifyResult.criticalPageCount,
        detectedForms: classifyResult.detectedForms,
      });

      const extractResult = await runExtract(parseId);

      if (!extractResult.success) {
        throw new Error(extractResult.error || 'Extraction failed');
      }

      console.log('[orchestrator] Extraction complete, needsReview:', extractResult.needsReview);

      // PHASE 4: CLEANUP (ALWAYS RUN, EVEN IF EXTRACTION HAD ISSUES)
      setState({
        phase: 'cleanup',
        message: 'Cleaning up temporary files...',
        pageCount: renderResult.pageCount,
        criticalPageCount: classifyResult.criticalPageCount,
        detectedForms: classifyResult.detectedForms,
        needsReview: extractResult.needsReview,
      });

      const cleanupResult = await runCleanup(parseId);
      
      if (!cleanupResult.success) {
        console.warn('[orchestrator] Cleanup had issues but continuing:', cleanupResult.error);
        // Don't throw - cleanup issues shouldn't block the user
      } else {
        console.log('[orchestrator] Cleanup complete');
      }

      // COMPLETE
      setState({
        phase: 'complete',
        message: extractResult.needsReview 
          ? 'Extraction complete — review recommended'
          : 'Transaction extracted successfully',
        pageCount: renderResult.pageCount,
        criticalPageCount: classifyResult.criticalPageCount,
        detectedForms: classifyResult.detectedForms,
        needsReview: extractResult.needsReview,
      });

      return { success: true, needsReview: extractResult.needsReview };
    } catch (error: any) {
      console.error('[orchestrator] Pipeline failed:', error);
      
      // CRITICAL: Run cleanup even on failure
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

  return { state, runPipeline };
}

// ============================================================================
// HELPER FUNCTIONS (SSE + REST)
// ============================================================================

async function runRender(
  parseId: string,
  onProgress: (message: string) => void
): Promise<{ success: boolean; pageCount?: number; error?: string }> {
  return new Promise((resolve) => {
    const eventSource = new EventSource(`/api/parse/render/${parseId}`);

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'progress') {
          onProgress(data.message);
        } else if (data.type === 'complete') {
          eventSource.close();
          resolve({ success: true, pageCount: data.pageCount });
        } else if (data.type === 'error') {
          eventSource.close();
          resolve({ success: false, error: data.message });
        }
      } catch (e) {
        console.error('[render] Failed to parse SSE event:', e);
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
      resolve({ success: false, error: 'Connection lost' });
    };
  });
}

async function runClassify(
  parseId: string,
  onProgress: (message: string) => void
): Promise<{ 
  success: boolean; 
  criticalPageCount?: number; 
  detectedForms?: string[];
  error?: string;
}> {
  return new Promise((resolve) => {
    const eventSource = new EventSource(`/api/parse/classify/${parseId}`);

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'progress') {
          onProgress(data.message);
        } else if (data.type === 'complete') {
          eventSource.close();
          resolve({
            success: true,
            criticalPageCount: data.criticalPageCount,
            detectedForms: data.detectedForms || [],
          });
        } else if (data.type === 'error') {
          eventSource.close();
          resolve({ success: false, error: data.message });
        }
      } catch (e) {
        console.error('[classify] Failed to parse SSE event:', e);
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
      resolve({ success: false, error: 'Connection lost' });
    };
  });
}

async function runExtract(parseId: string): Promise<{ 
  success: boolean; 
  needsReview?: boolean; 
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
    return { success: true, needsReview: data.needsReview };
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
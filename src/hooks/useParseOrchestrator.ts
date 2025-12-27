// src/hooks/useParseOrchestrator.ts
// Version: 1.0.0 - 2025-12-27
// Client-side orchestration hook for the parse pipeline: render → classify → extract → cleanup

import { useState, useCallback } from 'react';

export type ParsePhase = 'idle' | 'render' | 'classify' | 'extract' | 'cleanup' | 'complete' | 'error';

interface ParseState {
  phase: ParsePhase;
  message: string;
  pageCount?: number;
  criticalPageCount?: number;
  needsReview?: boolean;
  error?: string;
}

interface ClassificationResult {
  criticalImages: any[];
  metadata: any;
  criticalPageNumbers: number[];
  state: string;
  highDpiPages: { pageNumber: number; base64: string }[];
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

      if (!classifyResult.success || !classifyResult.data) {
        throw new Error(classifyResult.error || 'Classification failed');
      }

      console.log('[orchestrator] Classification complete:', classifyResult.data.criticalPageNumbers.length, 'critical pages');

      // PHASE 3: EXTRACT
      setState({
        phase: 'extract',
        message: 'Extracting transaction data...',
        pageCount: renderResult.pageCount,
        criticalPageCount: classifyResult.data.criticalPageNumbers.length,
      });

      const extractResult = await runExtract(parseId, classifyResult.data);

      if (!extractResult.success) {
        throw new Error(extractResult.error || 'Extraction failed');
      }

      console.log('[orchestrator] Extraction complete, needsReview:', extractResult.needsReview);

      // PHASE 4: CLEANUP
      setState({
        phase: 'cleanup',
        message: 'Cleaning up temporary files...',
        pageCount: renderResult.pageCount,
        criticalPageCount: classifyResult.data.criticalPageNumbers.length,
        needsReview: extractResult.needsReview,
      });

      await runCleanup(parseId);

      console.log('[orchestrator] Cleanup complete');

      // COMPLETE
      setState({
        phase: 'complete',
        message: extractResult.needsReview 
          ? 'Extraction complete — review recommended'
          : 'Transaction extracted successfully',
        pageCount: renderResult.pageCount,
        criticalPageCount: classifyResult.data.criticalPageNumbers.length,
        needsReview: extractResult.needsReview,
      });

      return { success: true, needsReview: extractResult.needsReview };
    } catch (error: any) {
      console.error('[orchestrator] Pipeline failed:', error);
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
): Promise<{ success: boolean; data?: ClassificationResult; error?: string }> {
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
            data: {
              criticalImages: data.criticalImages,
              metadata: data.metadata,
              criticalPageNumbers: data.criticalPageNumbers,
              state: data.state,
              highDpiPages: data.highDpiPages,
            },
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

async function runExtract(
  parseId: string,
  classificationData: ClassificationResult
): Promise<{ success: boolean; needsReview?: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/parse/extract/${parseId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(classificationData),
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

async function runCleanup(parseId: string): Promise<void> {
  try {
    const res = await fetch(`/api/parse/cleanup/${parseId}`, {
      method: 'POST',
    });

    if (!res.ok) {
      console.warn('[cleanup] Failed but continuing:', await res.text());
    }
  } catch (error) {
    console.warn('[cleanup] Failed but continuing:', error);
  }
}
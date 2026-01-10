'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function TestingBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Check if we're on a non-main branch
    const branch = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;

    // Only show banner if:
    // 1. Not on main branch
    // 2. User hasn't dismissed it
    if (branch && branch !== 'main') {
      const dismissed = localStorage.getItem(`banner-dismissed-${branch}`);
      if (!dismissed) {
        setIsVisible(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    const branch = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;
    if (branch) {
      localStorage.setItem(`banner-dismissed-${branch}`, 'true');
    }
    setIsVisible(false);
  };

  // Avoid hydration mismatch by not rendering until mounted
  if (!isMounted || !isVisible) {
    return null;
  }

  return (
    <div className="relative bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                🧪 We&apos;re testing out new features!
              </span>
              <span className="hidden sm:inline text-sm text-blue-700 dark:text-blue-300">
                Let us know if you experience any issues.
              </span>
            </div>
            <a
              href="https://github.com/greentcsolutions-lab/tc-helper-app/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline underline-offset-2 transition-colors"
            >
              Report Issue
            </a>
          </div>
          <button
            onClick={handleDismiss}
            className="inline-flex items-center justify-center rounded-md p-1 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

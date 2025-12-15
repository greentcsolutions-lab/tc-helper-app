// src/components/ui/TopLoader.tsx
// Version: 1.0.0 - Slim top loading bar for route transitions
"use client";

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';
import { useTheme } from 'next-themes';

export default function TopLoader() {
  const { resolvedTheme } = useTheme();

  // Use primary color from your theme
  const color = resolvedTheme === 'dark'
    ? '#60a5fa' // blue-400 for dark mode
    : '#3b82f6'; // blue-500 for light mode

  return (
    <ProgressBar
      height="3px"
      color={color}
      options={{
        showSpinner: false,
        easing: 'ease',
        speed: 200,
      }}
      shallowRouting
    />
  );
}

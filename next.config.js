// next.config.js — 2025 Clean Edition (pdfRest + Grok-4-vision only)

const nextConfig = {
  // No more native packages — we're pure serverless now
  serverExternalPackages: [],

  // Keep these if you want fast local dev (safe to remove later)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // All experimental canvas/pdfjs hacks — GONE FOREVER
  experimental: {
    // No more excluding native binaries from tracing
    // outputFileTracingExcludes: {} — not needed
  },

  // No more Webpack rules, aliases, or warnings for pdfjs-dist
  webpack: (config) => {
    // Optional: keep only if you still have any json imports from old deps
    // Otherwise this can be completely empty
    return config;
  },

  // Turbopack alias no longer needed
  turbopack: {
    // resolveAlias: {} — removed
  },
};

module.exports = nextConfig;
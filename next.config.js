// next.config.js — 2025 Clean Edition (pdfRest + Grok-4-vision only) + 413 FIX

const nextConfig = {
  // No more native packages — we're pure serverless now
  serverExternalPackages: [],

  // Keep these if you want fast local dev (safe to remove later)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // THIS IS THE ONLY NEW BLOCK — kills the 413 error forever
  experimental: {
    serverActions: {
      // Your nuclear-flattened California RPAs are ~2–2.5 MB → 30 MB gives plenty of headroom
      bodySizeLimit: "30mb",
    },
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
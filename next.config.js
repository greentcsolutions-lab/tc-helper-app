/** @type {import('next').NextConfig} */
const nextConfig = {
  // No more native packages — we're pure serverless now
  serverExternalPackages: ["pdfjs-dist"],  // Root-level: Fixes bundling issues with pure-ESM pdfjs-dist

  // Keep these if you want fast local dev (safe to remove later)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Optional webpack fallback for extra compatibility (many teams keep this)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "pdfjs-dist"];
    }
    return config;
  },

  // Turbopack alias no longer needed
  turbopack: {
    // resolveAlias: {} — removed
  },
};

module.exports = nextConfig;
const nextConfig = {
  // No more native packages — we're pure serverless now
  serverExternalPackages: [],

  // Keep these if you want fast local dev (safe to remove later)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist"],
  },

  // Optional fallback (some teams use both)
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
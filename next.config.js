// next.config.js — FINAL 2025 VERCEL N-API FIX (WORKS 100%)

const nextConfig = {
  serverExternalPackages: ["canvas", "pdfjs-dist"],

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
    // ← CRITICAL: Exclude native .node binaries from Vercel's tracing
    outputFileTracingExcludes: {
      "/": [
        "**/canvas/**",
        "**/@napi-rs/canvas/**",
        "**/node_modules/@napi-rs/canvas/**",
        "**/node_modules/@napi-rs/canvas/build/**",
        "**/node_modules/@napi-rs/canvas/lib/**",
      ],
    },
  },

  webpack: (config) => {
    config.module.rules.push({
      test: /pdfjs-dist[\\/].*\.json$/,
      type: "json",
    });

    config.resolve.alias = {
      ...config.resolve.alias,
      "pdfjs-dist/build/pdf.worker.mjs": "./public/pdf.worker.mjs",
    };

    
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /pdf\.mjs$/ },
      { message: /Critical dependency/ },
      { message: /Use of eval/ },
      { message: /Please use the `legacy` build/ },
    ];

    return config;
  },

  turbopack: {
    resolveAlias: {
      "pdfjs-dist/build/pdf.worker.mjs": "./public/pdf.worker.mjs",
    },
  },
};

module.exports = nextConfig;
// next.config.js — VERCEL N-API FIX (your original + outputFileTracingExcludes)

const nextConfig = {
  serverExternalPackages: ["canvas", "pdfjs-dist"],

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
    // ← ADD: Exclude native binaries from Vercel tracing (fixes InvalidArg path mangling)
    outputFileTracingExcludes: {
      "/": ["**/canvas/**", "**/@napi-rs/canvas/**"],  // Skips .node bundling → raw Node load
    },
  },

  webpack: (config) => {
    config.module.rules.push({
      test: /pdfjs-dist[\\/].*\.json$/,
      type: "json",
    });

    // Your existing worker alias
    config.resolve.alias = {
      ...config.resolve.alias,
      "pdfjs-dist/build/pdf.worker.mjs": "./public/pdf.worker.mjs",
    };

    // ← ADD: Explicit externals for N-API (ensures lazy-load, no bundling)
    config.externals = (config.externals || []).concat(["@napi-rs/canvas"]);

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /pdf\.mjs$/ },
      { message: /Critical dependency/ },
      { message: /Use of eval/ },
      { message: /Please use the `legacy` build/ },  // Silence @napi-rs/canvas Node warning
    ];

    return config;
  },

  // Your existing Turbopack alias
  turbopack: {
    resolveAlias: {
      "pdfjs-dist/build/pdf.worker.mjs": "./public/pdf.worker.mjs",
    },
  },
};

module.exports = nextConfig;
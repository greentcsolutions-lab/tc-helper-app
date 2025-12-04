// next.config.js — TURBOPACK + VERCEL ESM WORKER ALIAS

/** @type {import('next').NextConfig} */
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
  },

  // ← NEW: Turbopack/Webpack unified alias (fixes ?raw + worker 404)
  webpack: (config) => {
    config.module.rules.push({
      test: /pdfjs-dist[\\/].*\.json$/,
      type: "json",
    });

    // Alias for Webpack (build/deploy)
    config.resolve.alias = {
      ...config.resolve.alias,
      "pdfjs-dist/build/pdf.worker.mjs": "./public/pdf.worker.mjs",  // Raw source string
    };

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /pdf\.mjs$/ },
      { message: /Critical dependency/ },
      { message: /Use of eval/ },
    ];

    return config;
  },

  // Turbopack alias (dev + build --turbo)
  turbopack: {
    resolveAlias: {
      "pdfjs-dist/build/pdf.worker.mjs": "./public/pdf.worker.mjs",  // Same raw source
    },
  },
};

module.exports = nextConfig;
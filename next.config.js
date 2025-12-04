// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep this for canvas/pdfjs-dist natives (your server routes)
    serverComponentsExternalPackages: ["canvas", "pdfjs-dist"],
  },

  webpack: (config) => {
    // Keep this for pdfjs-dist JSON assets
    config.module.rules.push({
      test: /pdfjs-dist[\\/].*\.json$/,
      type: "json",
    });

    // FIX: Exclude broken goober.d.ts (ESM/CommonJS clash) — standard 2025 patch
    config.module.rules.push({
      test: /goober\.d\.ts$/,
      loader: "ignore-loader",
    });

    // Force ESM interop for Radix deps (prevents transitive CJS leaks)
    config.experiments = {
      ...config.experiments,
      outputModule: true,
    };

    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    return config;
  },

  // Optional: Ignore type errors in node_modules during build (safety net)
  typescript: {
    ignoreBuildErrors: false, // Keep strict, but add if needed: true
  },
};

module.exports = nextConfig;
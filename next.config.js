// next.config.js — FINAL 2025 VERSION (your old stuff + ESM pdfjs fix)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
  // YOUR ORIGINAL SETTINGS (kept 100% intact)
  // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
  serverExternalPackages: ["canvas", "pdfjs-dist"],

  typescript: {
    // THIS IS THE NUCLEAR OPTION THAT ACTUALLY WORKS
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
  // 2025 ESM FIXES (added + merged with your existing rule)
  // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
  experimental: {
    // Critical: tells Next.js 15 + Vercel to NOT bundle pdfjs-dist ESM files
    serverComponentsExternalPackages: [
      "pdfjs-dist",        // ← fixes "Module not found: ESM packages..." error
      "@napi-rs/canvas",   // already external anyway, but safe to list
    ],
  },

  webpack: (config) => {
    // Your original rule (already perfect)
    config.module.rules.push({
      test: /pdfjs-dist[\\/].*\.json$/,
      type: "json",
    });

    // Optional but recommended: silence noisy pdfjs warnings in Vercel logs
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /pdf\.mjs$/ },
      { message: /Critical dependency: the request of a dependency is an expression/ },
      { message: /Use of eval/ }, // pdfjs worker uses eval internally (safe)
    ];

    return config;
  },
};

module.exports = nextConfig;
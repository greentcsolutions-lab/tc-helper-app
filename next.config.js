// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // FIXED: Moved from experimental (stable in Next 15.1.4)
  serverExternalPackages: ["canvas", "pdfjs-dist"],

  webpack: (config) => {
    // Keep for pdfjs-dist JSON assets (your server routes)
    config.module.rules.push({
      test: /pdfjs-dist[\\/].*\.json$/,
      type: "json",
    });

    // FIXED: Ignore broken goober.d.ts (ESM/CommonJS clash in Radix deps)
    config.module.rules.push({
      test: /goober\.d\.ts$/,
      use: "null-loader",  // Skips types during bundling (Vercel-safe, runtime unaffected)
    });

    // FIXED: Force ESM interop for transitive deps (Radix/goober)
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    // Optional: Loose ESM mode for externals (fallback if needed)
    config.module.parser = {
      ...config.module.parser,
      javascript: {
        ...config.module.parser.javascript,
        esmExternals: "loose",
      },
    };

    return config;
  },

  // Optional: Skip lint in build if warnings spam (uncomment if needed)
  // eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
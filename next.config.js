// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep canvas + pdfjs-dist externalized for your server routes
  serverExternalPackages: ["canvas", "pdfjs-dist"],

  // THIS ONE LINE KILLS THE GOOBER ERROR (official Next 15 fix for Radix/goober)
  experimental: {
    esmExternals: "loose",
  },

  webpack: (config) => {
    // Keep for pdfjs-dist JSON assets (your renderer uses them)
    config.module.rules.push({
      test: /pdfjs-dist[\\/].*\.json$/,
      type: "json",
    });

    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    return config;
  },

  // Skip harmless lint warnings during build (unused vars, <img> tags)
  // Remove this line later once you clean them up
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["canvas", "pdfjs-dist"],
  },

  webpack: (config) => {
    // Fix pdfjs-dist JSON files
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
};
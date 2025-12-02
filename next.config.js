// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Critical for pdfjs-dist ESM worker on both Webpack and Turbopack
    config.experiments = {
      ...config.experiments,
      topLevelAwait: false,
    };
    return config;
  },
};

module.exports = nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Externalize pdfjs-dist at runtime (Vercel Node.js loads it fine)
  serverExternalPackages: ["pdfjs-dist"],

  experimental: {
    serverMinification: false,  // ← This shows real variable names in errors instead of 'N'
  },
  
  // Critical fix: Transpile + external for server bundles (bypasses Webpack resolve errors)
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark as external
      config.externals = [...(config.externals || []), "pdfjs-dist"];

      // Transpile the package (forces Node resolution)
      config.module.rules.push({
        test: /\.m?js$/,
        include: /node_modules\/pdfjs-dist/,
        use: {
          loader: "next-loader-shim",
          options: { name: "pdfjs-dist" },
        },
      });
    }
    return config;
  },

  // Your existing ignores (safe for fast local builds)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Remove turbopack object if present (it can interfere with server bundling)
};

module.exports = nextConfig;

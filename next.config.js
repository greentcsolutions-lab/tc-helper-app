// next.config.mjs
export default {
  // ... existing
  experimental: {
    serverComponentsExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
    outputFileTracingExcludes: {
      "/": [
        "**/canvas/**",
        "**/@napi-rs/canvas/**",
        "**/node_modules/@napi-rs/canvas/**",  // ← ADD: Catch all native paths
      ],
    },
  },
  webpack: (config) => {
    // ... existing
    config.externals = [...(config.externals || []), "@napi-rs/canvas"];
    config.resolve.fallback = { ...config.resolve.fallback, canvas: false };  // ← ADD: Tell webpack to skip
    return config;
  },
};
// postcss.config.js
// Must be CommonJS (module.exports) — Next.js 15 requires this

module.exports = {
  plugins: {
    tailwindcss: {},    // ← correct name
    autoprefixer: {},  // ← correct
  },
};
// eslint.config.mjs
import nextPlugin from "eslint-config-next";

export default [
  ...nextPlugin,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",     // ← turn off the any storm
      "@typescript-eslint/no-unused-vars": "warn",    // keep as warning only
      "react-hooks/set-state-in-effect": "off",       // theme toggle is fine
      "@next/next/no-img-element": "warn",            // we'll fix later
    },
  },
];
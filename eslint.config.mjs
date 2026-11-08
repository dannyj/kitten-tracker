import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // These standalone Node.js helper scripts use CommonJS.
    files: ["scripts/**/*.cjs", "style_guide/build-style-guide.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Tests run via Node's type stripping and import with .ts extensions.
    "**/*.test.ts",
    "e2e-*.mjs",
    "seed-*.cjs",
    "make-*.cjs",
  ]),
]);

export default eslintConfig;

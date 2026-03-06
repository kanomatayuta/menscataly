import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees & coverage
    ".claude/worktrees/**",
    "coverage/**",
  ]),
  // Allow unused variables/args prefixed with _ (standard convention)
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  // Test files: allow `any` and sync-scripts (JSDOM test utilities)
  {
    files: [
      "src/__tests__/**/*.{ts,tsx}",
      "src/**/__tests__/**/*.{ts,tsx}",
      "e2e/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@next/next/no-sync-scripts": "off",
    },
  },
  // Scripts: allow require() imports
  {
    files: ["scripts/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;

import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { temporaryExceptions } from "./eslint.exceptions.mjs";

const nodeScriptGlobals = {
  process: "readonly",
  console: "readonly",
  Buffer: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
};

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "webview/preview-data.json",
      "**/*.vsix",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mjs,cjs}"],
    ...eslint.configs.recommended,
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: nodeScriptGlobals,
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...nodeScriptGlobals,
        require: "readonly",
        module: "readonly",
        exports: "writable",
      },
    },
  },
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),
  ...tseslint.configs.stylisticTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Exported functions carry an explicit return type. See docs/coding-standards.md.
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": [
        "error",
        { max: 60, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      complexity: ["error", { max: 10 }],
      "max-depth": ["error", 3],
      "max-params": ["error", { max: 4 }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message: "Use a named export. Default exports are only allowed in tool configs that require them.",
        },
      ],
    },
  },
  {
    files: ["webview/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  // Vite and Vitest load these files as their config entry and require a default export.
  {
    files: ["vite.config.ts", "vitest.config.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // TODO(coding-standards): delete each entry after that file is split to meet the rule.
  // The follow-up is a separate PR. Doing it here rewrites the same files as open PRs
  // #11, #12, #13, #15, and #16. Do not add eslint-disable comments in source.
  ...Object.entries(temporaryExceptions).map(([file, rules]) => ({
    files: [file],
    rules: Object.fromEntries(rules.map((rule) => [rule, "off"])),
  })),
);

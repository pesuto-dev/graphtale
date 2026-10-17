import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

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
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
);

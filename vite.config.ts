import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: "webview",
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  server: {
    port: 5173,
    open: "/preview.html?view=flow",
  },
  build: {
    outDir: path.resolve(__dirname, "dist/webview"),
    emptyOutDir: true,
    cssCodeSplit: false,
    // The webview is emitted as one IIFE, so Rollup cannot code-split it.
    // Keep Vite's warning aligned with the intended single-file bundle size.
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      input: path.resolve(__dirname, "webview/index.html"),
      output: {
        format: "iife",
        name: "skillViewer",
        entryFileNames: "main.js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: (info) =>
          info.name?.endsWith(".css") ? "assets/main.css" : "assets/[name][extname]",
      },
    },
  },
});

import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

/**
 * Browser harness for Flow / Catalog without F5.
 * No StrictMode — avoids @xyflow fitView race in Vite HMR (see AGENTS.md).
 */
const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root");
}

createRoot(root).render(<App />);

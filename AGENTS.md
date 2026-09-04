# AGENTS.md

## Cursor Cloud specific instructions

This repo is a **Cursor / VS Code extension** (Graphtale, package name `graphtale`). It has two build targets:

- **Extension host** (`src/**`) — bundled by esbuild to `dist/extension.js` (see `esbuild.mjs`).
- **Webview** (`webview/**`) — a React + `@xyflow/react` app bundled by Vite to `dist/webview/` (see `vite.config.ts`).

Shared types live in `src/shared/protocol.ts` and are aliased as `@shared` in the webview.

### Standard commands (already defined in `package.json`)

- Install: `npm install`
- Type-check (host + webview): `npm run check`
- Tests: `npm test` (vitest, runs `src/**/*.test.ts`)
- Validate skill fixtures: `npm run validate`
- Build both bundles: `npm run compile` (or `npm run watch:host` / `npm run watch:webview` for dev)

Node 22 works; `engines` only pins `vscode ^1.90.0`, not Node.

### Running / verifying the app in the cloud VM (non-obvious)

- Normal dev is **F5 → "Run Extension"** (`.vscode/launch.json`), which opens a VS Code Extension Development Host. That GUI host is **not** available headlessly in the cloud VM, so you cannot exercise the extension the usual way here.
- To verify the **webview UI** without the extension host, run the browser preview (no F5):

  ```bash
  npm run preview
  ```

  Opens `/preview.html?view=flow` with real parser output (default
  `fixtures/analyse-ticket-pn`). Catalog:

  ```bash
  # or open http://localhost:5173/preview.html
  PREVIEW_SKILL=fixtures/analyse-ticket npm run preview
  ```

  Gotchas:
  - `webview/vscode.ts` needs `acquireVsCodeApi` before module load — `preview.html` installs the stub.
  - Host posts `graph` on `ready` / `refresh` (same as `GraphtalePanel`).
  - Preview skips React `StrictMode` to avoid `@xyflow/react` `fitView` races in Vite.
  - `.graph-pane` is flex (not a 3-row grid): an optional diagnosis banner must not steal the `1fr` row from the canvas.
  - Skills on disk are never modified; preview is read-only like the extension.


Product direction lives in [PLAN.md](PLAN.md). Current slice is viewer polish; flow editor and later items are parked.

### Tests / fixtures (non-obvious)

- Test fixtures under `fixtures/` rely on **dot-directories** (e.g. `fixtures/project/.claude/skills/...`), which are hidden from a plain `ls`. Use `ls -a` / `find` when inspecting them.
- `fixtures/empty-home` is used as a fake `homedir` in tests so user-level skill discovery stays deterministic.

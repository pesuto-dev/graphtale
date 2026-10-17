# AGENTS.md

## Developer notes

This repo is a Cursor and VS Code extension (Graphtale, package name `graphtale`). It has two build targets:

- **Extension host** (`src/**`) — bundled by esbuild to `dist/extension.js` (see `esbuild.mjs`).
- **Webview** (`webview/**`) — a React + `@xyflow/react` app bundled by Vite to `dist/webview/` (see `vite.config.ts`).

Shared types live in `src/shared/protocol.ts` and are aliased as `@shared` in the webview.

### Commands

- Install: `npm install`
- Type-check (host + webview): `npm run check`
- Tests: `npm test` (vitest, `src/**/*.test.ts` and `webview/**/*.test.ts`)
- Validate skill fixtures: `npm run validate`
- Build both bundles: `npm run compile` (or `npm run watch:host` / `npm run watch:webview` for dev)

Node 22 works. `engines` pins `vscode ^1.125.0` and does not pin Node. CI also runs Node 24.

### Editor and preview

**F5 → Run Extension** (`.vscode/launch.json`) opens a VS Code Extension Development Host. A headless environment has no desktop host, so the webview can be checked in a browser:

```bash
npm run preview
```

Opens `/preview.html?view=flow` with real parser output (default `fixtures/analyse-ticket-pn`). Catalog:

```bash
# or open http://localhost:5173/preview.html
PREVIEW_SKILL=fixtures/analyse-ticket npm run preview
```

Notes:

- `webview/vscode.ts` needs `acquireVsCodeApi` before module load. `preview.html` installs the stub.
- The host posts `graph` on `ready` / `refresh` (same as `GraphtalePanel`).
- Preview skips React `StrictMode` to avoid `@xyflow/react` `fitView` races in Vite.
- `.graph-pane` is flex (not a 3-row grid): an optional diagnosis banner must not steal the `1fr` row from the canvas.
- Skills on disk are never modified. Preview is read-only, like the extension.

The public product is the read-only viewer. The flow editor and later items stay parked.

### Tests and fixtures

- Test fixtures under `fixtures/` rely on dot-directories (for example `fixtures/project/.claude/skills/...`), which are hidden from a plain `ls`. Use `ls -a` or `find` when inspecting them.
- `fixtures/empty-home` is a fake `homedir` in tests so user-level skill discovery stays deterministic.

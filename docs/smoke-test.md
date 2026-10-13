# Release smoke test

Run this checklist against a freshly built `.vsix` in a clean Cursor or VS Code
profile. It is a manual release check, not a claim that CI exercises an
extension host.

1. Install the `.vsix` with **Extensions: Install from VSIX...** and reload.
2. Open a workspace with a skill under `.cursor/skills`, `.claude/skills`,
   `.codex/skills`, or `.agents/skills`.
3. Open the skill from the sidebar or `SKILL.md` action; confirm Flow is first
   and Catalog is available.
4. Confirm a supported numbered demo shows its ordered steps and an ambiguous
   or prose-only skill shows an honest partial or empty diagnosis.
5. Open a source file from a node, edit the skill, refresh, and confirm the
   view updates without changing the skill on disk.
6. Check an empty workspace, a narrow panel, keyboard focus, and light/dark themes.

Record editor name and version, operating system, fixture used, and any
unexpected source or relationship shown. Do not include private skill contents
in an issue report.

## Automated command smoke

`scripts/extension-smoke.cjs` can run as an editor `--extensionTestsPath` with
`--extensionDevelopmentPath` pointing at the extracted VSIX `extension/` folder.
Use isolated `--user-data-dir` and `--extensions-dir`, and set
`GRAPHTALE_SMOKE_ROOT` to a disposable copy of a skill plus
`GRAPHTALE_SMOKE_RESULT` to an output JSON path. The test briefly modifies and
restores that disposable SKILL.md. It verifies command-level activation/open/
refresh/recovery; it does not claim to click through the webview.

For browser UI checks, start `npm run preview` and run
`PREVIEW_URL='http://localhost:5173/preview.html?view=flow&compact=1' npx tsx scripts/verify-webview.ts`.
The script temporarily supplies its own fixture data and restores the original.
Screenshots are written to ignored `artifacts/webview-check/`.

Also test source and external resource actions, delete/restore SKILL.md and use
Retry, copy the optional clarification prompt, and navigate using only the
keyboard in both editors. Keep that record with the release notes for the
version you tested.

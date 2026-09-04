# Changelog

## 0.0.1

First release of **Graphtale**: a read-only Agent Skill Flow viewer inside Cursor / VS Code.

- **Flow**: ordered steps derived from the skill markdown (first tab, opens with the skill). When Flow is missing or thin, a short banner says when a chat prompt is needed; the prompt stays on the clipboard, not on the canvas.
- **Catalog**: inventory of files and references that belong to the skill (not runtime order).
- Open from the Command Palette (skill picker), the Graphtale sidebar, or a `SKILL.md` editor/explorer action. Open files with double-click or **Open file**; **Refresh** after editor changes. The graph never writes the flow or modifies skill files.

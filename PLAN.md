# Plan

First release is a **viewer** inside Cursor / VS Code. Markdown is edited in the
editor (human or AI). The graph does **not** write the flow or modify skill files.

Target positioning: **Graphtale — Visual review for Agent Skills.** Explore the
steps and supporting files described in SKILL.md, with traceable sources and
visible uncertainty. Updating the listing and UI wording is part of release hardening.

Domain decisions: [docs/adr/](docs/adr/).
Locations: [docs/skill-locations.md](docs/skill-locations.md).

## Done

- Catalog view: skill file inventory from `SKILL.md` + folders (noise filtered).
- Flow view: detector ladder (P/N ASCII, numbered workflow, First Steps,
  Instructions, operations.md) with hybrid confidence. Banner says when a
  chat prompt is needed; clipboard prompt asks for numbered First Steps
  without inventing work.
- Intended-flow layers (read-only): `SKILL.md` → flow source → runtime steps →
  dashed support refs / handoffs when evidenced in text.
- Double-click / **Open file** edits markdown in Cursor or VS Code.
- **Refresh** reloads the open skill and keeps the selected node; lights up when
  watched files change.
- CSS for the webview (`dist/webview/assets/main.css`); graph fit-to-view.
- Golden fixture `fixtures/analyse-ticket-pn/` (synthetic P/N graph) + public-style fixtures under
  `fixtures/public-skills/` + optional corpus under `fixtures/user-skills/`.
- Catalog survives malformed YAML frontmatter; `npm run validate` + CI.
- Codex / Claude / Cursor / Agents roots documented; no auto-migrate of
  `~/.claude/skills` duplicates. Optional `agents/openai.yaml` listed in Catalog.
- Apache-2.0 + Pesuto publisher metadata; product name **Graphtale**.

Key files: `src/parseSkill.ts`, `src/parseProcedure.ts`, `src/discover.ts`,
`src/validate.ts`, `src/panel.ts`, `src/shared/watch.ts`, `webview/App.tsx`.

## Current slice: release hardening

The public product is the read-only viewer described in the README. Parser
limits are in [docs/parser-coverage.md](docs/parser-coverage.md). The checklist
below is historical implementation status. It does not by itself establish
parser correctness on unfamiliar skills.

Previous release preparation:

1. Listing sentence + README match the product (no manager / editor claim).
2. First-run on public-style fixtures: Flow useful **or** honest `none`.
3. Validation command + CI stay green on committed fixtures.
4. **Done**: product name **Graphtale** (listing `Graphtale - Agent Skill Flow`, package `graphtale`).
5. **Done this slice**: lean `.vsix` packaging (`npm run package`, CI artifact); marketplace
   screenshots under `assets/marketplace/` (`npm run screenshots`); listing metadata
   (`icon`, `galleryBanner`, README embeds, `CHANGELOG.md`); Related-skills attach chrome
   removed from the viewer UI.

6. **Out of scope**: flow editor writes, sidecar as source of truth, marketplace-
   perfect every vendor skill, bundled repair skill.

## Parked: flow editor

Only after the viewer is in daily use. Attach / rearrange / delete edges that
**write** into `SKILL.md`. Canvas mock: `poc/skill-flow-vision.canvas.tsx`.

## Parked later

- Deeper visual Inspiration pass.
- Optional auto-refresh; sidecar `flow.json` cache; Ollama edges; observed flow.

## How to pick this up

```bash
npm install
npm test
npm run check
npm run validate
npm run compile
./scripts/sync-user-skills.sh   # optional local corpus
```

**Run Extension** (`F5`) → open a skill → Flow / Catalog. Skills on disk
are never modified by the viewer.

Intended-flow reference: [poc/analyse-ticket-target-flow.md](poc/analyse-ticket-target-flow.md).
Cloud notes: [AGENTS.md](AGENTS.md).

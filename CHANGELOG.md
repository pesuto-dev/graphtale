# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Marketplace icon is the Pesuto sticker graph: an ink tile with lime, warm, and green nodes and a lime mascot badge. The gallery banner is `#0F0F0E` on the dark theme.
- Listing title is “Graphtale – Agent Skill Flow Viewer (SKILL.md)”. The description states the local, read-only SKILL.md flow and names Cursor, Claude Code, and Codex. Category `AI` is added next to `Visualization`. Keywords keep the previous terms and add the listing phrases (skill viewer, skill flow, claude code, codex skills, and related), deduplicated, 23 in total.
- README header uses the new banner (icon, tagline, agent/skill/reference tags, and “by pesuto”).
- The activity bar icon is the same three-node graph, drawn in `currentColor` and without the mascot badge.

### Fixed

- Flow diagnosis reports SKILL.md frontmatter problems that previously stayed silent. A missing closing `---` warns, and the instructions after that block are still read. Invalid YAML is reported with a file line when the parser provides one, without a source excerpt. Frontmatter that is not a mapping, including a single value or a list, warns. A byte-order mark before the frontmatter keeps the skill name, including on CRLF files.

## [0.1.1] - 2026-10-17

Maintenance release. No change to Flow, Catalog, diagnosis, or discovery.

### Changed

- Removed the parked `poc/` notes, the design prototypes `docs/design/moodboard.html` and `docs/design/prototype.html`, and `scripts/sync-user-skills.sh`. The `.gitignore` note for local notes is neutral, and `AGENTS.md` is ordinary developer notes.
- Split the webview shell, the skill parser, and compact layout into smaller modules. `App.tsx` composes view state, host messages, and edges. `parseSkill` delegates links, paths, and text. `compactLayout` is a facade over filter, columns, and geometry.
- This release also appears on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=pesuto.graphtale). The release workflow publishes the same VSIX there when the `VSCE_PAT` repository secret is set. A missing token or a Marketplace error does not block Open VSX or the GitHub Release.

## [0.1.0] - 2026-10-13

First public release of Graphtale. `0.0.1` was an unpublished development
version; it was not released to npm, the Visual Studio Marketplace, or Open VSX.

### Changed

- Minimum VS Code version is `^1.125.0`, the same version as the installed `@types/vscode` types the extension is compiled against.

### Added

- Read-only Cursor and VS Code extension that reviews an Agent Skill from the files already on disk. It does not edit, install, or execute the skill.
- **Flow** view of supported instruction structure: numbered lists and headings, plus explicit P/N rows and arrows. Each detected step keeps a source path and line range. **Compact** shows the same graph in wrapped rows.
- **Catalog** view: a grouped inventory of skill files and references. Catalog does not claim runtime order.
- Diagnosis when structure is missing or only partly recognized, with an optional clarification prompt copied to the clipboard on request.
- Open a skill from the Command Palette, the Graphtale sidebar, or a `SKILL.md` editor or explorer action. **Refresh** reloads the open skill. **Open instruction**, **Open referenced resource**, and **Open file** return to the source.
- Discovery of workspace and user skill roots used by Cursor, Claude Code, Codex, and `.agents/skills`, including skills recorded in Claude’s installed-plugins file.

[Unreleased]: https://github.com/pesuto-dev/graphtale/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/pesuto-dev/graphtale/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pesuto-dev/graphtale/releases/tag/v0.1.0

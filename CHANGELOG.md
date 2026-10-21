# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-10-21

### Security

- Long lines no longer slow parsing down. The heading, link, bare-path, P/N and diagram matchers were quadratic in line length, so a crafted 120 KB skill could block the extension host for close to a minute. A line longer than 1,000 characters is not read as a P/N row, arrow statement or diagram marker.
- A linked file or agent definition outside the skill, workspace, skills and agent folders (for example `~/.aws/credentials`, also through a symlink) is listed in Catalog but no longer read for its summary, and a `workflow.md` linked from there is not used for Flow. Selecting the file still previews it, with a notice. See [parser coverage](docs/parser-coverage.md#linked-files-outside-the-skill).

### Changed

- The release workflow runs the full CI checks before it publishes, and publishes the VSIX those checks built. `ovsx` is a locked dev dependency instead of an `npx` download, and a manual run is a dry run that stops before publishing.

## [0.3.0] - 2026-10-18

### Added

- [Skill structure standard](docs/skill-standard.md): where a skill states its order, how to write conditional steps, choices, alternatives and modes, the P/N format, and how to repair a skill without changing its meaning. See [ADR 0011](docs/adr/0011-repair-skills-to-a-standard.md).
- The fix prompt leads with one repair Graphtale chose for that skill: rename one heading, write a prefilled `references/workflow.md` skeleton plus the line in SKILL.md that links it, or ask whether the skill has an order at all. Routers, references and modes count as valid shapes.
- The fix prompt names who owns the skill file: a link to its real path, a skill installed by the skills CLI with its upstream source, and another copy with the same name.
- Plans that edit a file end with a verifier: record file hashes, allow only the planned changes, check the P/N format and ids, and trace every row and label to a source line.
- The fix prompt has the AI tool back up the skill folder itself before any edit, to `~/.graphtale/backups/<skill>/<date-time>/`, check the copy, and report how to restore it. The backup stays outside every skills folder so it never loads as a second skill.
- A fix prompt that would pass the copy limit leaves out the skeleton instead of failing to copy.

### Changed

- A partial numbered flow names its cause: each conditional step with the word and its line, and separate step lists that Flow does not connect.
- The heading diagnosis names numbered lists under headings Flow does not read as steps, with their lines, instead of saying the skill has no numbered list.
- The fix prompt states how Flow reads order: a step heading must start with a recognized name, which whole words make a step conditional, and that separate lists are not connected.

## [0.2.0] - 2026-10-18

### Added

- **Catalog** search filters the inventory by file name, path, and description. An empty state appears when nothing matches.
- **Go to step** in Flow finds a step by title or number, centers and selects that node, and opens the inspector. Ctrl or Cmd+F focuses the field.
- Flow and Catalog are a tab list. Arrow keys move between them, and the selected tab exposes `aria-selected`.
- The selected Catalog row sets `aria-current`.
- Compact nodes expose their full name, kind plus label, to assistive technology. The visible chip can stay shortened.
- Keyboard focus runs from the toolbar to the graph steps, then the inspector. Enter or Space selects the focused step without a pointer click. Edges are no longer tab stops.
- Flow diagnosis names a P/N cycle and the edge left out of the graph, a duplicate P/N id and the lines where it appears, an arrow to a missing id with that arrow’s source line, and a self-loop with its source line. Other partial flows still say that some relationships are unresolved.
- A flow longer than 500 steps warns with the total number of steps and the number shown.
- Prose skills with no numbered list and no P/N steps show `##` and `###` headings as unordered steps. Each step keeps the heading’s source line. The diagnosis is `heuristic: headings, no order`, and the Flow banner includes a short rewrite example (prose headings to numbered steps). The same example is in [parser coverage](docs/parser-coverage.md). A skill with no `##` or `###` heading still has an empty Flow. More than 500 headings warn `Flow shows 500 of N steps.`
- A SKILL.md that routes to separate local files from a table or bullet list (a router skill) shows each route as an unordered branch linked to its file. The diagnosis is `router: routes to files, no order`. This check reads structure and paths, not words, so it works in any language.
- `~/.graphtale/languages.json` adds step and skip section headings for languages other than English. A registered language applies to every skill. A malformed file is ignored with a Flow warning. English stays the default; no other language ships built in.
- **Open SKILL.md** in the Flow diagnosis banner.
- README demo of opening a `SKILL.md`, showing Flow, clicking a step, and highlighting that source line in the editor (`docs/media/demo.gif`). `.vscodeignore` keeps `docs/media` out of the VSIX.

### Changed

- The Flow diagnosis banner leads with **Copy fix prompt** and says in one line what happens next. The prompt names the skill file, warns when it is an installed plugin copy that an update overwrites, lists the recognized headings, asks the AI tool for a diff and approval before saving, and offers two options: repair the skill with English structure, or register the skill's language in `~/.graphtale/languages.json`. See [ADR 0010](docs/adr/0010-fix-path-primary-languages-on-demand.md).
- Flow refreshes on its own shortly after a watched skill file or `languages.json` changes. Windows paths are compared case-insensitively, so changes reported as `c:\` match a skill found under `C:\`.

- Marketplace icon is the Pesuto sticker graph: an ink tile with lime, warm, and green nodes and a lime mascot badge. The gallery banner is `#0F0F0E` on the dark theme.
- Listing title is “Graphtale – Agent Skill Flow Viewer (SKILL.md)”. The description states the local, read-only SKILL.md flow and names Cursor, Claude Code, and Codex. Category `AI` is added next to `Visualization`. Keywords keep the previous terms and add the listing phrases (skill viewer, skill flow, claude code, codex skills, and related), deduplicated, 23 in total.
- README header uses the new banner (icon, tagline, agent/skill/reference tags, and “by pesuto”).
- The activity bar icon is the same three-node graph, drawn in `currentColor` and without the mascot badge.
- Webview styles are split by domain: tokens, toolbar, graph canvas, legend, node card, badges, expand, edges, graph controls, compact nodes, inventory, inspector, and high-contrast.

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

[Unreleased]: https://github.com/pesuto-dev/graphtale/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/pesuto-dev/graphtale/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/pesuto-dev/graphtale/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/pesuto-dev/graphtale/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/pesuto-dev/graphtale/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pesuto-dev/graphtale/releases/tag/v0.1.0

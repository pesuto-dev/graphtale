[![CI](https://github.com/pesuto-dev/graphtale/actions/workflows/ci.yml/badge.svg)](https://github.com/pesuto-dev/graphtale/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.125.0-007ACC?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)

<p align="center">
  <a href="https://pesuto.dev/">
    <img src="https://raw.githubusercontent.com/pesuto-dev/graphtale/main/assets/readme-header.png" alt="graphtale — See your SKILL.md as a step-by-step flow. Local, read-only, no LLM. Tags: agent, skill, reference. by pesuto" width="1200">
  </a>
</p>

<p align="center">
  <img src="docs/media/demo.gif" alt="Open a SKILL.md, show Graphtale Flow, click a step, and the source line is highlighted in the editor" width="800">
</p>

# Graphtale

Graphtale shows a `SKILL.md` as a step-by-step flow linked to source lines. It
is a local, read-only Cursor and VS Code extension for skills used by Cursor,
Claude Code, and Codex. It does not edit, install, or execute the skill, and
it does not call a backend or an LLM.

## Install

Install Graphtale from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=pesuto.graphtale).
In VS Code, open Extensions and search for `graphtale`, or run:

```bash
code --install-extension pesuto.graphtale
```

Install it from [Open VSX](https://open-vsx.org/extension/pesuto/graphtale) as well.
You can also download the `.vsix` attached to the
[GitHub release](https://github.com/pesuto-dev/graphtale/releases) and install it
with **Extensions: Install from VSIX...**.

The package targets VS Code `^1.125.0` and compatible Cursor builds. Graphtale is not an npm library: do not
`import` it. Details are in [docs/install.md](docs/install.md).

## Usage

Open a folder that contains a skill and run **Graphtale: Open Agent Skill Flow**
from the Command Palette. If several skills are found, pick one. Flow opens
first. Catalog lists the skill’s files.

Paste this skill into `.cursor/skills/review-change/SKILL.md` (the same layout
works under `.claude/skills`, `.codex/skills`, or `.agents/skills`):

```markdown
---
name: review-change
description: Review a change using its source evidence.
---

## Instructions
1. Read request
2. Gather files
3. Compare edits
4. Check evidence
5. Write findings
6. Return review
```

Open that `SKILL.md` and choose **Open Agent Skill Flow**. The six numbered
instructions become six source-linked steps. Select a step and choose **Open
instruction** to jump to the source line. Flow refreshes on its own after you
save the file. The viewer never writes the skill.

![Complete six-step review in Compact view](assets/marketplace/procedure-analyse-ticket.png)

Supported locations are listed in [docs/skill-locations.md](docs/skill-locations.md).

## Commands and views

These contributed commands are the public interface:

| Command | Title | Where it appears |
| --- | --- | --- |
| `graphtale.openViewer` | Open Agent Skill Flow | Command Palette, `SKILL.md` editor title, explorer context menu |
| `graphtale.refresh` | Refresh open skill | Command Palette |
| `graphtale.refreshTree` | Refresh Skills | Command Palette and the Skills view title |

The activity bar container **Graphtale** has one view, **Skills**
(`graphtale.skills`). It lists discovered skills. Opening one shows the webview.

Inside the webview:

- **Flow** is the supported instruction graph. **Go to step** finds a step by title or number, centers it, and opens the inspector. Ctrl or Cmd+F focuses that field. **Compact** packs the same graph into wrapped rows. Outside Compact, **Layout** switches between top-to-bottom and left-to-right. Nodes are not draggable and edges are not editable.
- **Catalog** is a grouped file inventory. Search filters by file name, path, and description. It does not imply execution order.
- The inspector shows the selected step’s source text. **Open instruction** (or **Open file** when the node has no instruction range) and **Open referenced resource** open the editor. Double-click a node to open its file.
- A diagnosis banner appears when coverage is partial or missing. **Copy fix prompt** copies a prompt for your AI chat to the clipboard. It names the skill file and who owns it, gives one concrete repair towards the [skill structure standard](docs/skill-standard.md) with checks for the AI tool to run, asks for a diff and your approval, and offers registering the skill's language as an alternative. **Open SKILL.md** opens the file. High confidence means the recognized structure has supported relationships. It is not a probability that every sentence was understood.

There is no `configuration` contribution and no account or API key. Section headings are English by default. To recognize headings in another language, list them in `~/.graphtale/languages.json`; the fix prompt explains the format.

### Package entry

The extension host entry is `main`: `./dist/extension.js` (`activate` and
`deactivate`). The host bundle is built with esbuild and the webview with Vite.
This package does not emit `.d.ts` files and does not declare `exports` or
`types`, because there is no supported import API. The host/webview message
shapes in `src/shared/protocol.ts` are an internal contract for this extension.

`npm publish` would run `prepublishOnly` (`npm run compile`) and pack what
`.npmignore` allows. The VSIX uses `.vscodeignore` instead, and that file
leaves `docs/media` out of the package. Publishing runs from the release workflow on a
`v*` tag, after the full CI checks pass; see [docs/release.md](docs/release.md).

## What the parser understands

Flow recognizes numbered Markdown headings and numbered lists in common
instruction sections, plus explicit P/N rows and arrows. The full rules and
limits are in [parser coverage](docs/parser-coverage.md). Catalog is an
inventory, not a second flow.

The parser is conservative. Prose with `##` or `###` headings and no numbered
list or P/N graph is shown as unordered steps (`heuristic: headings, no order`),
with a short rewrite example in the diagnosis. Prose without those headings,
examples, choices, loops, unsupported relationships, and ambiguous ordering can
produce an empty or partial diagnosis. Read limits are in [file limits](docs/file-limits.md).

## Privacy

The extension reads skills in the workspace and in home skill directories, plus
local resources those skills reference. A linked file outside the skill,
workspace, skills and agent folders is listed but only read when you select it;
see [parser coverage](docs/parser-coverage.md#linked-files-outside-the-skill).
It has no backend, telemetry service, or skill execution. Clipboard writes happen only when you request them.
Symlinked skill roots are deduplicated by real path. Recursive Catalog
inventory does not follow symlinks.

This is a hobby project with best-effort support and no response-time promise.
Report a small, anonymized reproduction with the [issue templates](.github/ISSUE_TEMPLATE/incorrect-flow.md).

## Development

Start with the [contributor guide](CONTRIBUTING.md).

```bash
npm install
npm run lint
npm test
npm run check
npm run validate
npm run compile
npm run package
```

`npm run preview` opens a browser preview of the webview on fixture data. It
does not load the extension host.

Flow editing is out of scope for this release. Release notes are in
[CHANGELOG.md](CHANGELOG.md).

## License

[Apache License 2.0](LICENSE). Copyright 2026 Ben van den Berge. See
[NOTICE](NOTICE) for the copyright line and third-party license names.

The Pesuto and Graphtale names and logos are not covered by Apache-2.0. You may
fork the code. You may not use those names or logos to imply that you are the
official source, except to describe origin (“based on Graphtale”). See
[TRADEMARK.md](TRADEMARK.md).

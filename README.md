<p><a href="https://pesuto.dev/">a pesuto tool</a></p>

# Graphtale

Graphtale is a read-only Cursor / VS Code extension for visual review of an Agent Skill from the files you already wrote. It shows supported
instruction structure and the files a skill refers to, without editing or
executing the skill.

Graphtale is open source under Apache-2.0. The Pesuto and Graphtale names and
logos are protected marks; see [NOTICE](NOTICE) and [TRADEMARK.md](TRADEMARK.md).

## Install and try it in 60 seconds

Build a local `.vsix` with `npm ci && npm run package`, or download one when
available from [GitHub Releases](https://github.com/pesuto-dev/graphtale/releases). Then run
**Extensions: Install from VSIX...** in Cursor or VS Code. Open a folder that
contains a skill and run **Graphtale: Open Agent Skill Flow** from the Command
Palette. Choose the skill if prompted; Flow opens first and Catalog shows its
files.

Paste this small skill into `.cursor/skills/review-change/SKILL.md` (or the equivalent
skill directory):

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

Open the file, choose **Open Agent Skill Flow**, and inspect the six steps.
Edit a step, then use **Refresh**. Double-click a node or choose **Open instruction**
to return to the source. The viewer never writes the skill.

![Complete six-step review in Compact view](assets/marketplace/procedure-analyse-ticket.png)

The six numbered instructions become six source-linked steps. Use **Compact**
for an overview, select a step for its text, and **Open instruction** for the
exact source line. Referenced resources have a separate open action.

## What Graphtale understands

Flow recognizes numbered Markdown headings and numbered lists in common
instruction sections, plus explicit P/N rows and arrows described in
[parser coverage](docs/parser-coverage.md). It preserves source paths and
line ranges for detected steps. Catalog is a grouped inventory of skill files
and references; it does not claim runtime order.

The parser is deliberately conservative. Prose-only instructions, examples,
choices, loops, unsupported relationships, and ambiguous ordering can produce
an empty or partial diagnosis. “High confidence” describes supported structure
and relationships; it is not a probability that every instruction was found.
Graphtale does not execute skills, observe sessions, install skills, edit flow
edges, or call a backend/API. It reads local files through the editor and
workspace APIs, and clipboard actions happen only when you request them.

Supported skill locations are listed in [skill locations](docs/skill-locations.md).

## Privacy and support

The extension reads skills in the workspace and home skill directories, plus
local resources referenced by those skills. It has no backend, API key requirement,
telemetry service, or skill execution. Read limits and truncation are documented
in [file limits](docs/file-limits.md). Symlinked skill discovery and arbitrary
unlinked asset folders are not supported yet.

This is a hobby project with best-effort support and no response-time promise.
Report a small, anonymized reproduction using the issue templates.

## Development

Start with the [contributor guide](CONTRIBUTING.md), then:

```bash
npm install
npm test
npm run check
npm run validate
npm run compile
npm run package
```

For a browser-only preview, run `npm run preview`; it uses fixture data and
does not exercise extension-host integration. The package command runs the
same `vscode:prepublish` build used when VS Code packages the extension.

See [CHANGELOG.md](CHANGELOG.md) and [product direction](https://github.com/pesuto-dev/graphtale/blob/main/PLAN.md) for project history and
direction. Flow editing remains out of scope for this release.

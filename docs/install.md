# Install

Install Graphtale from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=pesuto.graphtale).
In VS Code, open Extensions and search for `graphtale`, or run `code --install-extension pesuto.graphtale`.

Install it from [Open VSX](https://open-vsx.org/extension/pesuto/graphtale) as well.
Or download the `.vsix` attached to the [GitHub release](https://github.com/pesuto-dev/graphtale/releases)
and use **Extensions: Install from VSIX...** in Cursor or VS Code. Reload the editor if it asks.

Building a package from a checkout is covered in the [contributor guide](../CONTRIBUTING.md) (`npm ci && npm run package`).
Install that `.vsix` the same way.

Open a workspace containing a supported skill location, or open its `SKILL.md`
directly. Use **Graphtale: Open Agent Skill Flow** from the Command Palette,
the Graphtale activity bar, or the editor/explorer action on a `SKILL.md` file.

The extension runs locally. It reads skill files through the editor and
workspace APIs and does not require an account, backend, network service, or
API key. It does not execute skills or modify them.

The package targets VS Code `^1.125.0` and compatible Cursor builds. The parser
supports the structures listed in [parser coverage](parser-coverage.md). Prose
with only `##` or `###` headings is an unordered partial flow. An empty
diagnosis remains for prose with no such headings, and a partial diagnosis
remains for ambiguous skills.
This is a hobby project with community support expectations rather than a
guaranteed production support channel.

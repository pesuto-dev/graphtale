# Install the preview

Build a local preview with `npm ci && npm run package`, or download the artifact
when available from the repository’s GitHub Releases. Then use **Extensions: Install from VSIX...** in
Cursor or VS Code. Reload the editor if it asks.

Open a workspace containing a supported skill location, or open its `SKILL.md`
directly. Use **Graphtale: Open Agent Skill Flow** from the Command Palette,
the Graphtale activity bar, or the editor/explorer action on a `SKILL.md` file.

The preview is local. The extension reads skill files through the editor and
workspace APIs and does not require an account, backend, network service, or
API key. It does not execute skills or modify them.

The package targets VS Code `^1.90.0` and compatible Cursor builds. The parser
supports the structures listed in [parser coverage](parser-coverage.md); an
empty or partial diagnosis is expected for prose-only or ambiguous skills.
This is a hobby project with community support expectations rather than a
guaranteed production support channel.

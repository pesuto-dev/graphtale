# Catalog survives bad frontmatter; Codex copies stay separate

YAML parse errors in `SKILL.md` must not empty the catalog. Codex’s canonical
user root is `~/.codex/skills`. Legacy `~/.claude/skills` (and Cursor / Agents
roots) stay discoverable. Same folder name in two roots is two catalog entries —
no auto-merge, no migration.

`agents/openai.yaml` is an optional Codex sidecar. The viewer lists it when
present. It never writes that file.

## Status

accepted

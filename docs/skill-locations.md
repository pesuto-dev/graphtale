# Skill locations

The viewer only reads. It never moves or writes skill files.

## Workspace

| Directory | Typical host |
| --- | --- |
| `.cursor/skills/` | Cursor |
| `.claude/skills/` | Claude Code |
| `.codex/skills/` | Codex |
| `.agents/skills/` | Marketplace / vendor installs |

## User home

| Directory | Role |
| --- | --- |
| `~/.codex/skills/` | **Canonical Codex location** |
| `~/.cursor/skills/` | Cursor user skills |
| `~/.claude/skills/` | Claude Code user skills (still listed) |
| `~/.agents/skills/` | Vendor / marketplace user skills |

A skill that exists as both `~/.codex/skills/foo` and `~/.claude/skills/foo` is
listed twice. Prefer one root and delete or stop maintaining the other. This
viewer does not migrate copies.

## Optional Codex sidecar

Codex may add `agents/openai.yaml` next to `SKILL.md`. Catalog shows that file
when it exists. Flow still comes from markdown (numbered steps, P/N graph,
First Steps / Instructions, or `workflow.md` / `operations.md`).

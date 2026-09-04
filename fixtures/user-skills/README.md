# User skills corpus (local test copies)

Copied **from** the machine (not moved). Sources:

| Bucket | Source | Purpose |
| --- | --- | --- |
| `claude/` | `~/.claude/skills/` | Author skills — messy, real shape variation |
| `agents/` | `~/.agents/skills/` | Marketplace / vendor skills — other conventions |

Regenerate:

```bash
./scripts/sync-user-skills.sh
```

`MANIFEST.json` is a structural overview (file counts, workflow flags, sample headings).

These copies are for local parser/viewer tests. They are gitignored. Committed fixtures live under `fixtures/demo-skills/`, `fixtures/public-skills/`, and the emptied `fixtures/analyse-ticket` / `fixtures/analyse-ticket-pn` stand-ins.

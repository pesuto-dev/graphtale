# Public-style skill fixtures

Committed stand-ins for marketplace skills. Used by first-run tests.

| Folder | Expectation |
| --- | --- |
| `prose-only/` | Flow confidence `none` (honest empty) |
| `first-steps/` | High-confidence Flow from **First Steps** |
| `instructions-plain/` | High-confidence Flow from plain numbered Instructions |
| `codex-openai/` | Catalog includes `agents/openai.yaml` |
| `malformed-yaml/` | Catalog still lists the folder; validator reports YAML. Skipped by `npm run validate`. |

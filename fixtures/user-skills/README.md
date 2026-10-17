# User skills corpus (local test copies)

Optional local copies of skill trees. They are gitignored. Nothing in the test
suite, package scripts, or CI requires them; tests that can read this corpus
skip it when the folders are absent.

| Bucket | Typical contents |
| --- | --- |
| `claude/` | Author skills with varied shapes |
| `agents/` | Vendor-style skills with other conventions |

`MANIFEST.json`, when present, is a structural overview (file counts, workflow flags, sample headings).

Committed fixtures live under `fixtures/demo-skills/`, `fixtures/public-skills/`, and the emptied `fixtures/analyse-ticket` / `fixtures/analyse-ticket-pn` stand-ins.

# Compact / Flow demo skills

Synthetic skills that hit layout shapes the golden `analyse-ticket-pn` fixture does not cover on its own. Parser input only; Graphtale never writes these files. Compact must stay generic: same DAG as Flow LR, no invented edges, no overlapping chips.

| Folder | Shape | What to look at |
| --- | --- | --- |
| `long-linear/` | 12 numbered First Steps | Wrap across three runtime rows; entry is SKILL.md only |
| `odd-wrap/` | 5 First Steps | Wrap with a short last row (4 + 1) |
| `pn-chain/` | Long P/N script chain | Wrap that starts from SKILL → workflow.md |
| `agents-chain/` | Sequential this-loop / agent | Agent chips, no script spine |
| `pair-fanout/` | Two N2 branches → merge | Smallest stack (2) |
| `wide-fanout/` | Five N2 branches → merge → wrap | Tall stack, then wrap to pack |
| `fanout-open/` | N2 branches, no merge | Stack as last runtime column |
| `gate-skip/` | Question gate, no N2 | `Question` skip vs `Bug \| Change` |
| `gate-and-fanout/` | N2 pair + Question gate | Stack and skip on one graph |
| `support-handoff/` | Schema + template + N5v + handoff | Right-side arrows into N6, dashed handoff |
| `pair-support/` | Schema + N5v only | Two-high support stack still joins N6 |

Preview (read-only, same as the extension):

```bash
PREVIEW_SKILL=fixtures/demo-skills/long-linear npm run preview
# then open /preview.html?view=flow and /preview.html?view=flow&compact=1
```

Replace the folder name to switch skills. Catalog tab should still list the files.

Visual pass (Compact, top-to-bottom, left-to-right) for every folder above:

```bash
npm run screenshots:demos
```

Writes PNGs under `assets/demo-skills/` (not a marketplace listing asset).

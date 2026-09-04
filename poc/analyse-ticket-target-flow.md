# Target Flow shape (all skills)

Viewer-only reference. Skills on disk are never rewritten — the extension only
parses and displays.

Interaction mock: [skill-flow-vision.canvas.tsx](skill-flow-vision.canvas.tsx).

## Structure principles

```
SKILL.md  →  flow source (workflow.md / operations.md / SKILL.md)
          →  runtime steps (P/N graph, numbered list, or linear First Steps)
          -.-> support docs (schema, template, …) when named in the procedure text
          -.-> handoff skills when handoff language + catalog match
```

Dashed edges = conditional, support, or handoff. Solid = runtime order.

## Golden example

`fixtures/analyse-ticket-pn/` is a synthetic P/N graph for CI. Demo shapes live under `fixtures/demo-skills/`.

## Out of scope

- Writing edges back into SKILL.md (flow editor — parked)
- Inventing steps not present in the skill text
- Bundled fix-skill

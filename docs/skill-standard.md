# Skill structure standard

This standard describes how an Agent Skill states the order of its work, so that an agent running the
skill and Graphtale's Flow read the same steps in the same order. Graphtale's fix prompt repairs skills
towards this standard. [ADR 0011](adr/0011-repair-skills-to-a-standard.md) records why.

What the parser can read, including fallbacks for skills that do not follow this standard, is in
[parser coverage](parser-coverage.md). This document is the target, not the list of everything that parses.

## Goal

- The order lives in the skill itself, where agents read it. Graphtale keeps no copy of a skill's order.
- A repair changes structure, never meaning. Every step and every condition traces to text the skill
  already has.
- A small model can apply a repair and check it without exploring the codebase.

## Where the order lives

Use one of two places.

| Skill shape | Where the order lives |
| --- | --- |
| One ordered list, no branches | `## Workflow` in SKILL.md, as a numbered list |
| Conditional steps, choices, alternatives, modes, or several lists that connect | `references/workflow.md` with P/N rows and a Connections block, linked from SKILL.md |
| No fixed order (a reference, a mode, or a router whose routes are independent) | Nowhere. Do not add an order the skill does not have |

A step section heading must start with a recognized name: Workflow, First Steps, Procedure, Bootstrap,
How it runs, Operations, Instructions, Usage, Steps, or Getting started. `## Workflow: gate (new art)`
works; `## Gate workflow (new art)` does not. Add a qualifier after a colon when a skill has more than one
section.

When the order lives in `references/workflow.md`, SKILL.md links to it with this line, directly under the
`#` title:

```text
Step order: [references/workflow.md](references/workflow.md)
```

Without that link, agents never read the file and only Graphtale sees the order.

## Plain ordered steps in SKILL.md

<!-- example-file: plain/SKILL.md -->
````markdown
---
name: plain-example
description: Writes a release note. Use when the user asks for release notes.
---

# Plain steps

## Workflow

1. Read the merged pull requests.
2. Group them by area.
3. Write the release note.
````

A numbered step that contains one of these whole words gets no edge into or out of it: if, otherwise,
unless, parallel, concurrently, alternatively, choose one, one of, go to, skip, repeat, until. That is deliberate: Graphtale does not guess what a
condition means. Do not reword a step to avoid these words, because that changes what the agent does.
Move the order to `references/workflow.md` instead and put the condition on an arrow.

## Branches in references/workflow.md

<!-- example-file: branches/SKILL.md -->
````markdown
---
name: branches-example
description: Prepares art handoffs and wires returned art in. Use for production pixel art.
---

# Art lanes

Step order: [references/workflow.md](references/workflow.md)

## Workflow: gate (new art)

1. Stop creating production pixels.
2. Write a handoff file. If docs/art/ is missing, use a temporary path.
3. Wait for returned sources, then the integration lane.

## Workflow: integration (art already made)

1. Place the sources.
2. Run bake if present.
3. Run the audits.
````

<!-- example-file: branches/references/workflow.md -->
````markdown
# Workflow

Step order of [SKILL.md](../SKILL.md) for branches-example. The rules stay in SKILL.md; this file only states the order.

```
P   pick lane              this loop
N1  stop pixel creation    this loop
N2  write handoff          this loop
N3  wait for sources       this loop
N4  place sources          this loop
N5  run bake               this loop
N6  run audits             this loop
```

## Connections

```text
P -> N1 (new or replacement art)
P -> N4 (sources already made)
N1 -> N2
N2 -> N3
N3 -> N4
N4 -> N5 (bake present)
N4 -> N6 (no bake)
N5 -> N6
```
````

Rules for the file:

- Rows go in the first plain fence; arrows go in a `text` fence under `## Connections`.
- Each row is one line: id, title, two or more spaces, then what runs the step (`this loop`, an agent
  name, or a script the skill already has). A row title never contains `->` or `→`; Graphtale skips
  such a row.
- The first row is `P`. Every other row is `N` plus a number, optionally with a letter (`N1`, `N12`,
  `N2a`). Ids do not need to be consecutive, and each id is used once.
- Every row appears in at least one arrow, and every arrow uses ids that exist as rows.
- No other line in the file starts with `P` or `N` followed by a space or a number. Graphtale reads such a
  line as a row. Explanations belong in SKILL.md or in the review, not here.
- Arrow labels may use any words, including if and unless.

## Writing each kind of step

| Kind | How to write it |
| --- | --- |
| A step that always runs | An arrow from the step before it, without a label |
| A step that runs only under a condition | A labelled arrow into it, and an arrow around it with the opposite condition |
| A condition inside a step (a fallback path, a detail) | Nothing extra. The step always runs; the condition stays in SKILL.md |
| A conditional first step | The condition in the `P` row's title, because nothing points into `P` |
| A choice between lanes (a decision tree) | One row for the choice, with one labelled arrow to the first row of each lane |
| Steps that share a number (3a, 3b) | Alternatives: an arrow from the step before to each and from each to the step after. Sub-steps in order: chain them |
| Alternative modes of the whole skill (first run, incremental run) | `P` picks the mode, with one labelled arrow to the first row of each mode. Do not chain the modes |
| Two lists where one leads to the other | One arrow from the last row of the first list to the first row of the next, labelled with the sentence in SKILL.md that says so |

Known limitation: Flow skips everything under a heading that contains Examples, Alternatives, Options,
Appendix, Notes, Reference or Choices as a whole word, and that includes the `#` title. A skill titled
`# Release notes` or a workflow file headed `# Workflow: options-pricing` shows no steps. Keep those words
out of titles and step headings until the parser stops applying skip words to titles.

## What is not a step

Rules, principles, pitfalls, hard rejects, output sections, templates and examples are not steps, even
when they are numbered. Leave them where they are and do not give them rows. Put them under a heading
such as Notes, Reference or Examples when they would otherwise be read as steps.

## Repairing without changing meaning

- Allowed: renaming a heading so it starts with a recognized name, adding the link line, adding
  `references/workflow.md`, or registering a heading in another language in `~/.graphtale/languages.json`.
- Not allowed: rewording, adding or removing instructions, or adding steps the text does not imply.
- Every row and every arrow label traces to a line in SKILL.md. Whatever does not is new work, and an agent
  would now follow it.
- Repair at the source. A plugin install under `~/.claude/plugins/cache/` and a skill installed by the
  skills CLI under `~/.agents/skills/` are copies that an update overwrites. Repair the plugin's source
  repository or the upstream skill, then update. A linked skill is repaired at its real path.
- Check the result: record the hash of every file in the skill folder first, then confirm that only the
  allowed changes appear in the diff. Graphtale's fix prompt lists these checks for each repair.

## Other languages

Existing text may stay in its own language. Anything a repair adds for structure (headings, the workflow
file name, the link line) is English. When a skill already has numbered steps under a heading in another
language, register that heading in `~/.graphtale/languages.json` instead of renaming it; see
[parser coverage](parser-coverage.md#languages).

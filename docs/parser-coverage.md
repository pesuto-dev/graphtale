# Parser evidence for the public preview

Slice 1, 2026-09-05. Graphtale draws supported instruction structure; it does not
observe execution. Parsing never writes skill files.

## Supported structure

- Numbered Markdown headings at levels 2–6. Sibling headings form a sequence;
  nested headings belong to their enclosing step. Unnumbered section boundaries
  end that sequence. Separate groups stay disconnected and receive partial coverage.
- Unindented numbered lists under Instructions, First Steps, Workflow, Procedure,
  Operations, Steps, Bootstrap, How it runs, Usage, or Getting started. A bare list
  before any heading is also supported. Nested list items remain instruction text.
- Repeated Markdown `1.` items have separate internal IDs and retain their displayed
  numbers. Titles and source order are preserved.
- P/N rows in workflow.md, operations.md, or a document with a Workflow heading.
  Plain text and unlabelled/text/plaintext/workflow fences are accepted. Programming
  and Markdown example fences are ignored. P/N rows alone have unresolved order:
  identifiers, indentation, roles and resource names never imply a branch.
- Exact standalone arrow statements such as `N1 -> N2` or
  `N3 -> N5 (Question)` express P/N relationships. Multiple outgoing arrows express
  a fork; labels belong to their stated arrows. Arrows to absent or duplicate IDs,
  unsupported arrow expressions, disconnected components and cycles give partial
  coverage. Cyclic edges are omitted because the viewer lays out a DAG. The
  diagnosis names that cycle and the omitted edge, a duplicate step id and its
  lines, an arrow to a missing id with the arrow's source line, and a self-loop
  with its source line. A disconnected component stays partial and keeps the
  generic unresolved sentence when none of those findings apply.
- Numbered steps name why they are partial: each conditional step with the word
  and the line it is on (at most four, then a count), separate step lists with
  their first lines, and a list introduced as a choice.
- P/N diagram fences can state routes with visual markers: `parallel` and `barrier`
  create a fan-out and rejoin; a labeled `↓` or `┐` creates a labeled branch; `join`
  reconnects it. Ordinary rows form a sequence only inside such a marked diagram.
  Each derived edge refers to its marker or displayed target row. P/N tables without
  diagram markers remain unresolved.

Examples, alternatives, choices, options, notes and appendix sections are excluded,
along with skip headings registered in `~/.graphtale/languages.json` (see below).
Matching fence characters and lengths are respected; frontmatter retains its line
positions but is not scanned for steps. A leading byte-order mark is ignored, so
the frontmatter name still applies on LF and CRLF files. When the closing `---`
is missing, Flow warns and still reads the following instructions: the first
heading, numbered item, P/N row, or fence ends the unclosed block. Invalid YAML
is reported in the Flow diagnosis with the parser's file line when it has one.
The message names `SKILL.md` and omits source excerpts. Frontmatter that is not
a mapping, including a scalar or a list, warns as well. Any of these warnings keeps Flow confidence below
high. Conditional/looping language or a "choose one" introduction prevents
confident sequencing of the affected list. This conservative vocabulary is not a
general natural-language parser.

## Router heuristic

When none of the supported structures above match, a table or bullet list in
SKILL.md whose items point to at least two distinct local `.md` files (markdown
links or bare paths such as `recipes/day.md`) is shown as unordered branches.
Each branch is labeled with the first table cell or the link text, its summary is
the following text, its source range is that row, and the routed file is its
`resourcePath`. Only files inside the skill folder that exist count; SKILL.md
itself never does. Edges from SKILL.md are inferred and low confidence. The
diagnosis is `router: routes to files, no order`. The first qualifying block wins;
blocks under excluded headings are skipped. This check reads structure and paths,
not words, so it works in any language. It runs before the heading heuristic.

## Heading heuristic

When none of the supported structures above match, level-2 and level-3 headings
(`##` / `###`) are shown as unordered steps. Each step’s source range is that
heading line. The diagnosis is `heuristic: headings, no order`. Edges from the
source file to those steps are inferred; no edge between the steps states an
execution order. Examples, alternatives, choices, options, notes, reference,
and appendix headings are skipped, including headings nested under them.
Headings in frontmatter and code fences are ignored, as are `#` titles and
headings deeper than level 3. A document with no `##` or `###` heading keeps
the empty diagnosis. When numbered lists sit under headings that are not step
sections, the diagnosis names those headings with their lines and item counts
instead of saying there is no numbered list, and says when those lists contain
conditional wording.

A numbered list or P/N graph still wins, including when it is found in a later
candidate than a heading-only file. The Flow banner shows this rewrite so an
author can turn the same prose into an ordered flow:

```text
Prose headings are not a procedure. Number the same work to get an ordered flow.

Before:
## Gather
Read the ticket and note the product area.

## Classify
Decide whether this is a bug or a question.

After:
## First Steps
1. Gather: read the ticket and note the product area.
2. Classify: decide whether this is a bug or a question.
```

## Languages

Step and skip section names are English by default. `~/.graphtale/languages.json`
adds other languages for every skill on the machine:

```json
{
  "languages": {
    "nl": { "steps": ["Werkwijze"], "skip": ["Voorbeelden", "Opmerkingen"] }
  }
}
```

A step heading matches when the section title starts with it; a skip heading
matches as a whole word anywhere in the title. Both are case-insensitive and
handle accented letters. An unreadable or malformed file is ignored with a Flow
warning, and English still applies. Graphtale only reads this file; the fix
prompt asks the AI tool to create or extend it when the user chooses that option.

## Fix prompt and repair plan

A partial or missing Flow carries a fix prompt. It states how Flow reads order and,
before the general options, one repair chosen from the skill's structure: rename one
heading, write a prefilled `references/workflow.md` skeleton with the link line that
makes agents read it, or ask whether the skill has an order at all (prose, mode and
router skills). It names who owns the file (plugin copy, skills CLI install, link,
another copy with the same name) and ends edits with a verifier: file hashes, only
the planned changes, P/N format and ids, and a source line for every row and label.
The target structure is the [skill structure standard](skill-standard.md); see
[ADR 0011](adr/0011-repair-skills-to-a-standard.md).

## Source and relationship evidence

Every detected step has an instruction path and inclusive, one-based line range.
A resolved script/agent/document is stored separately as `resourcePath`. Markdown
resource links resolve relative to the instruction document. Existing P/N resource
paths resolve from the skill root. The selected fallback source is always retained.

Explicit edges carry source ranges. Entry/source connections are inferred and
marked as such; they do not claim that a linked document executes on invocation.
Unresolved relationships are omitted, with a partial diagnosis. Merely referring
to a schema, output template or another skill does not make it a runtime step;
those files remain available through Catalog where discovered.

High confidence means the recognized structure has supported relationships, not a
probability or a guarantee that every instruction in arbitrary prose was understood.
The inspector opens the exact instruction line and exposes a separate action
for resolved resources.

## Verification

The four original defect fixtures live in `fixtures/parser-regressions` and are
included in normal fixture validation. These are original synthetic reproductions.
Additional tests cover section/fence boundaries, repeated numbering, choices,
explicit branches, cycles, disconnected relationships, missing files, read-only
behavior and instruction/resource attribution. Demo fan-outs now state their
arrows explicitly. The original `analyse-ticket-pn` fixture remains a partial-flow
regression: its indentation and ticket names do not justify drawn relationships.

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
  coverage. Cyclic edges are omitted because the viewer lays out a DAG.
- P/N diagram fences can state routes with visual markers: `parallel` and `barrier`
  create a fan-out and rejoin; a labeled `↓` or `┐` creates a labeled branch; `join`
  reconnects it. Ordinary rows form a sequence only inside such a marked diagram.
  Each derived edge refers to its marker or displayed target row. P/N tables without
  diagram markers remain unresolved.

Examples, alternatives, choices, options, notes and appendix sections are excluded.
Matching fence characters and lengths are respected; frontmatter retains its line
positions but is not scanned for steps. A leading byte-order mark is ignored, so
the frontmatter name still applies on LF and CRLF files. When the closing `---`
is missing, Flow warns and still reads the following instructions: the first
heading, numbered item, P/N row, or fence ends the unclosed block. Invalid YAML
is reported in the Flow diagnosis with the parser's file line when it has one.
The message names `SKILL.md` and omits source excerpts. Frontmatter that is only
a scalar value warns as well. Any of these warnings keeps Flow confidence below
high. Conditional/looping language or a "choose one" introduction prevents
confident sequencing of the affected list. This conservative vocabulary is not a
general natural-language parser.

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
